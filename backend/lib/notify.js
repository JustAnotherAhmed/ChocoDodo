// Unified notification layer.
//   1. Telegram bot — for owner alerts on phone (free, no Meta setup)
//   2. CallMeBot WhatsApp — optional fallback for owner WhatsApp
//   3. wa.me click-to-WhatsApp links returned to client (for customer-side)
//   4. Email — silent fallback only
//
// Env config:
//   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID            — owner alerts
//   CALLMEBOT_PHONE,    CALLMEBOT_API_KEY            — owner WhatsApp via CallMeBot
//   WHATSAPP_OWNER_NUMBER                            — used in wa.me links given to customer
//   SMTP_*                                           — email fallback (already exists)

const path = require('path');
const fs = require('fs');

let nodemailer = null;
try { nodemailer = require('nodemailer'); } catch {}

let smtpTransporter = null;
const haveSmtp =
  process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;
if (haveSmtp && nodemailer) {
  smtpTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

// ---------- helpers ----------
function fmtMoney(cents, currency = 'egp') {
  const v = cents / 100;
  const num = Number.isInteger(v) ? v : v.toFixed(2);
  return `${num} ${currency.toUpperCase()}`;
}

function frontendUrl() {
  return process.env.FRONTEND_URL || `http://localhost:${process.env.PORT || 4242}`;
}

function ownerWhatsappNumber() {
  // E.164 without + for wa.me URLs (e.g. 201012345678)
  let n = process.env.WHATSAPP_OWNER_NUMBER || '';
  return String(n).replace(/[^\d]/g, '');
}

/** Customer-facing: returns wa.me URL the customer can click to message you */
function customerWaMeLink(orderId, customerName) {
  const num = ownerWhatsappNumber();
  if (!num) return null;
  const text = encodeURIComponent(
    `Hi ChocoDoDo! 🍫\nThis is ${customerName || 'a customer'} — order ${orderId}.\nJust placed it — wanted to say hi & confirm.`
  );
  return `https://wa.me/${num}?text=${text}`;
}

// ---------- transports ----------

async function sendTelegram(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { ok: false, reason: 'telegram-not-configured' };
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      return { ok: false, reason: `telegram-${res.status}-${t}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: 'telegram-error: ' + err.message };
  }
}

async function sendCallMeBotWhatsApp(message) {
  const phone = process.env.CALLMEBOT_PHONE;
  const apikey = process.env.CALLMEBOT_API_KEY;
  if (!phone || !apikey) return { ok: false, reason: 'callmebot-not-configured' };
  try {
    const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(message)}&apikey=${apikey}`;
    const res = await fetch(url);
    if (!res.ok) return { ok: false, reason: `callmebot-${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: 'callmebot-error: ' + err.message };
  }
}

async function sendEmail({ to, subject, html, attachments }) {
  if (!smtpTransporter) {
    console.log(`📧 [email-stub] to=${to} subject="${subject}"`);
    return { ok: false, reason: 'smtp-not-configured' };
  }
  try {
    const from = process.env.EMAIL_FROM || 'ChocoDoDo <noreply@chocododo.local>';
    const payload = { from, to, subject, html };
    if (Array.isArray(attachments) && attachments.length) payload.attachments = attachments;
    const info = await smtpTransporter.sendMail(payload);
    return { ok: true, messageId: info?.messageId };
  } catch (err) {
    return { ok: false, reason: 'smtp-error: ' + err.message };
  }
}

// ---------- high-level notifications ----------

async function notifyOwnerNewOrder(order) {
  // Use the rich bilingual Telegram bot module (with inline buttons)
  // when configured; fall back to plain sendTelegram otherwise.
  const tgBot = require('./telegram-bot');
  const items = JSON.parse(order.items_json || '[]');
  const itemList = items.map(i => `· ${i.name} × ${i.qty}`).join('\n');
  const total = fmtMoney(order.total_cents, order.currency);
  const deposit = order.payment_mode === 'deposit' && order.deposit_cents
    ? `\n💎 Deposit paid: ${fmtMoney(order.deposit_cents, order.currency)} (${order.deposit_pct}%)\n💰 Remaining: ${fmtMoney(order.remaining_cents, order.currency)}`
    : '';
  const waMessage =
`🍫 NEW ORDER ${order.id}\n${order.customer_name} (${order.customer_phone})\n${itemList}\nTotal: ${total}${deposit}`;

  const tgResult = tgBot.isConfigured()
    ? await tgBot.sendOrderAlert(order).then(r => r ? { ok: true } : { ok: false, reason: 'send failed' })
    : await sendTelegram(`🍫 NEW ORDER ${order.id}\n${order.customer_name}\n${itemList}\nTotal: ${total}`);

  const [waResult, emailResult] = await Promise.all([
    sendCallMeBotWhatsApp(waMessage),
    process.env.EMAIL_TO_OWNER
      ? sendEmail({
          to: process.env.EMAIL_TO_OWNER,
          subject: `🔔 New order ${order.id} (${total})`,
          html: `<pre>${waMessage}</pre>`,
        })
      : Promise.resolve({ ok: false, reason: 'no-email-recipient' }),
  ]);
  return { telegram: tgResult, whatsapp: waResult, email: emailResult };
}

async function notifyCustomerOrder(order) {
  // Customer notification is mostly the wa.me link returned to the frontend,
  // but we also send a confirmation email if SMTP is configured.
  if (!process.env.SMTP_HOST || !smtpTransporter) {
    return { email: { ok: false, reason: 'smtp-not-configured' } };
  }
  const items = JSON.parse(order.items_json || '[]');
  const lines = items.map(i => `<tr><td>${i.name} × ${i.qty}</td><td style="text-align:right;">${fmtMoney(i.price_cents * i.qty, order.currency)}</td></tr>`).join('');
  const intro = order.payment_mode === 'full'
    ? `We got your order and we're already firing up the ovens.`
    : `We got your deposit and your order is in! Remaining balance is due on delivery.`;
  const depositRows = (order.payment_mode === 'deposit' && order.deposit_cents) ? `
    <tr><td style="padding-top:8px;color:#1B5E20;"><strong>Deposit paid (${order.deposit_pct}%)</strong></td>
        <td style="padding-top:8px;text-align:right;color:#1B5E20;"><strong>${fmtMoney(order.deposit_cents, order.currency)}</strong></td></tr>
    <tr><td style="color:#E65100;"><strong>Remaining on delivery</strong></td>
        <td style="text-align:right;color:#E65100;"><strong>${fmtMoney(order.remaining_cents, order.currency)}</strong></td></tr>
  ` : '';
  const trackUrl = `${frontendUrl()}/pages/track.html?id=${encodeURIComponent(order.id)}`;
  const html = `
    <div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#FFF8E7;color:#3E2723;">
      <h1 style="font-family:Georgia,serif;color:#3E2723;">Thank you, ${order.customer_name}! 🍩</h1>
      <p>${intro}</p>
      <p><strong>Order:</strong> ${order.id} · <a href="${trackUrl}">Track your order</a></p>
      <table style="width:100%;border-collapse:collapse;margin-top:16px;">
        ${lines}
        <tr><td style="padding-top:12px;">Subtotal</td><td style="padding-top:12px;text-align:right;">${fmtMoney(order.subtotal_cents, order.currency)}</td></tr>
        <tr><td>Delivery</td><td style="text-align:right;">${fmtMoney(order.delivery_cents, order.currency)}</td></tr>
        ${order.tax_cents ? `<tr><td>Tax</td><td style="text-align:right;">${fmtMoney(order.tax_cents, order.currency)}</td></tr>` : ''}
        <tr><td style="border-top:2px dashed #F5B7B1;padding-top:12px;"><strong>Total</strong></td>
            <td style="border-top:2px dashed #F5B7B1;padding-top:12px;text-align:right;"><strong>${fmtMoney(order.total_cents, order.currency)}</strong></td></tr>
        ${depositRows}
      </table>
      <p style="margin-top:24px;">Delivery to: ${order.address || '—'}</p>
      <p style="color:#6B4423;">From our kitchen to you 🍫</p>
    </div>`;
  return { email: await sendEmail({ to: order.customer_email, subject: `🍫 Order confirmed — ${order.id}`, html }) };
}

async function notifyOrder(order) {
  const [owner, customer] = await Promise.all([
    notifyOwnerNewOrder(order),
    notifyCustomerOrder(order),
  ]);
  return { owner, customer };
}

async function notifyVerification({ to, name, token }) {
  const link = `${frontendUrl()}/pages/verify-email.html?token=${token}`;
  const safeName = String(name || 'there').replace(/[<>]/g, '');
  return sendEmail({
    to, subject: '🍫 Verify your ChocoDoDo email',
    html: `
      <div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#FFF8E7;color:#3E2723;border-radius:16px;">
        <h1 style="font-family:Georgia,serif;color:#3E2723;margin:0 0 16px;">🍫 Welcome to ChocoDoDo</h1>
        <p style="margin:0 0 16px;font-size:16px;">Hi ${safeName},</p>
        <p style="margin:0 0 24px;">Thanks for signing up! Verify your email so we can save your orders, send delivery updates, and reset your password if you ever need it.</p>

        <p style="margin:0 0 12px;"><strong>Option 1 — Click this button:</strong></p>
        <p style="margin:0 0 28px;">
          <a href="${link}" style="display:inline-block;background:#3E2723;color:#FFF8E7;padding:14px 32px;border-radius:999px;text-decoration:none;font-weight:700;font-size:15px;">Verify my email →</a>
        </p>

        <p style="margin:0 0 8px;"><strong>Option 2 — Enter this code on the verify page:</strong></p>
        <p style="margin:0 0 28px;font-family:'Courier New',monospace;font-size:32px;font-weight:700;letter-spacing:6px;color:#C2185B;background:#fff;padding:16px;border-radius:12px;text-align:center;border:2px dashed #F5B7B1;">${token}</p>

        <hr style="border:none;border-top:2px dashed #F5B7B1;margin:24px 0;"/>
        <p style="font-size:12px;color:#6B4423;margin:0 0 4px;">If the button doesn't work, copy this link into your browser:</p>
        <p style="font-size:12px;color:#6B4423;word-break:break-all;margin:0 0 16px;"><code>${link}</code></p>
        <p style="font-size:12px;color:#6B4423;margin:0;">Didn't sign up? You can ignore this email — we won't follow up.</p>
      </div>`,
  });
}

async function notifyPasswordReset({ to, name, token }) {
  const link = `${frontendUrl()}/pages/reset-password.html?token=${token}`;
  return sendEmail({
    to, subject: '🔐 Reset your ChocoDoDo password',
    html: `<p>Hi ${name || 'there'},</p>
           <p>Reset your password:</p>
           <p><a href="${link}">${link}</a></p>
           <p>Link expires in 1 hour.</p>`,
  });
}

async function notifyStaffReset({ to, name, token }) {
  const link = `${frontendUrl()}/pages/staff-reset-password.html?token=${token}`;
  return sendEmail({
    to, subject: '🔐 Reset your ChocoDoDo staff password',
    html: `<p>Hi ${name || 'there'},</p>
           <p>Reset your staff password:</p>
           <p><a href="${link}">${link}</a></p>`,
  });
}

async function notifyStaffInvite({ to, name, token, role, inviter }) {
  const link = `${frontendUrl()}/pages/staff-accept-invite.html?token=${token}`;
  const tg = `👥 New ${role} invited: ${to}\nInvited by: ${inviter}\nLink: ${link}`;
  await sendTelegram(tg);
  return sendEmail({
    to, subject: `🍫 You're invited to join ChocoDoDo as ${role}`,
    html: `<p>Hi ${name || 'there'},</p>
           <p>${inviter} invited you to join ChocoDoDo as a <strong>${role}</strong>.</p>
           <p><a href="${link}">Accept your invite & set your password →</a></p>
           <p>Or copy: <code>${link}</code></p>`,
  });
}

module.exports = {
  // generic transports
  sendTelegram, sendCallMeBotWhatsApp, sendEmail,
  // wa.me link
  customerWaMeLink, ownerWhatsappNumber,
  // high-level
  notifyOrder, notifyOwnerNewOrder, notifyCustomerOrder,
  notifyVerification, notifyPasswordReset, notifyStaffReset, notifyStaffInvite,
  // status
  isTelegramConfigured: () => !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
  isCallMeBotConfigured: () => !!(process.env.CALLMEBOT_PHONE && process.env.CALLMEBOT_API_KEY),
  isOwnerWhatsappSet: () => !!ownerWhatsappNumber(),
  isSmtpConfigured: () => !!smtpTransporter,
};
