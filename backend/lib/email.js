// Email helper.
// Uses nodemailer if SMTP creds are present, else logs to console.
// Plug in Resend / SendGrid / Mailgun by swapping the transport.

const nodemailer = require('nodemailer');

let transporter = null;
const haveSmtp =
  process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

if (haveSmtp) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

function fmtMoney(cents, currency = 'egp') {
  const num = cents / 100;
  // Whole-number prices look cleaner without trailing .00
  const v = Number.isInteger(num) ? num.toString() : num.toFixed(2);
  const code = currency.toUpperCase();
  if (code === 'USD') return `$${v}`;
  if (code === 'EGP') return `${v} EGP`;
  return `${v} ${code}`;
}

function depositLines(order) {
  if (!order.payment_mode || order.payment_mode === 'full') return '';
  if (!order.deposit_cents || order.deposit_cents === order.total_cents) return '';
  return `
    <tr><td style="padding-top:8px;color:#1B5E20;"><strong>Deposit paid (${order.deposit_pct || 50}%)</strong></td>
        <td style="padding-top:8px;text-align:right;color:#1B5E20;"><strong>${fmtMoney(order.deposit_cents, order.currency)}</strong></td></tr>
    <tr><td style="color:#E65100;"><strong>Remaining on delivery</strong></td>
        <td style="text-align:right;color:#E65100;"><strong>${fmtMoney(order.remaining_cents, order.currency)}</strong></td></tr>
  `;
}

function customerEmail(order) {
  const items = JSON.parse(order.items_json);
  const lines = items.map(i => `<tr><td>${i.name} × ${i.qty}</td><td style="text-align:right;">${fmtMoney(i.price_cents * i.qty, order.currency)}</td></tr>`).join('');
  const depositRows = depositLines(order);
  const intro = order.payment_mode === 'full'
    ? `We got your order and we're already firing up the ovens.`
    : `We got your deposit and your order is officially in! The remaining balance is due on delivery.`;
  return {
    subject: `🍫 Order confirmed — ${order.id}`,
    html: `
      <div style="font-family: -apple-system, Segoe UI, sans-serif; max-width:560px; margin:0 auto; padding:24px; background:#FFF8E7; color:#3E2723;">
        <h1 style="font-family:Georgia,serif; color:#3E2723;">Thank you, ${order.customer_name}! 🍩</h1>
        <p>${intro}</p>
        <p><strong>Order:</strong> ${order.id}</p>
        <table style="width:100%; border-collapse:collapse; margin-top:16px;">
          ${lines}
          <tr><td style="padding-top:12px;">Subtotal</td><td style="padding-top:12px; text-align:right;">${fmtMoney(order.subtotal_cents, order.currency)}</td></tr>
          <tr><td>Delivery</td><td style="text-align:right;">${fmtMoney(order.delivery_cents, order.currency)}</td></tr>
          ${order.tax_cents ? `<tr><td>Tax</td><td style="text-align:right;">${fmtMoney(order.tax_cents, order.currency)}</td></tr>` : ''}
          <tr><td style="border-top:2px dashed #F5B7B1; padding-top:12px;"><strong>Total</strong></td>
              <td style="border-top:2px dashed #F5B7B1; padding-top:12px; text-align:right;"><strong>${fmtMoney(order.total_cents, order.currency)}</strong></td></tr>
          ${depositRows}
        </table>
        <p style="margin-top:24px;">Delivery address: ${order.address || '—'}</p>
        <p style="color:#6B4423;">From our kitchen to you 🍫</p>
      </div>
    `,
  };
}

function ownerEmail(order) {
  const items = JSON.parse(order.items_json);
  const lines = items.map(i => `<li>${i.name} × ${i.qty} (${fmtMoney(i.price_cents * i.qty, order.currency)})</li>`).join('');
  return {
    subject: `🔔 New order — ${order.id} (${fmtMoney(order.total_cents, order.currency)})`,
    html: `
      <div style="font-family:-apple-system, Segoe UI, sans-serif;">
        <h2>New order: ${order.id}</h2>
        <p><strong>Customer:</strong> ${order.customer_name} — ${order.customer_email} — ${order.customer_phone || ''}</p>
        <p><strong>Address:</strong> ${order.address || '—'}</p>
        <p><strong>Notes:</strong> ${order.notes || '—'}</p>
        <p><strong>Payment:</strong> ${order.payment_method} (status: ${order.status})</p>
        <ul>${lines}</ul>
        <p><strong>Total: ${fmtMoney(order.total_cents, order.currency)}</strong></p>
      </div>
    `,
  };
}

async function send({ to, subject, html }) {
  const from = process.env.EMAIL_FROM || 'ChocoDoDo <noreply@chocododo.local>';
  if (!transporter) {
    console.log('\n📧 [email-stub] SMTP not configured. Email would have been sent:');
    console.log('  to:', to);
    console.log('  subject:', subject);
    console.log('  body (text):', html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300), '...\n');
    return { stubbed: true };
  }
  return transporter.sendMail({ from, to, subject, html });
}

async function notifyOrder(order) {
  const c = customerEmail(order);
  const o = ownerEmail(order);
  await send({ to: order.customer_email, subject: c.subject, html: c.html });
  if (process.env.EMAIL_TO_OWNER) {
    await send({ to: process.env.EMAIL_TO_OWNER, subject: o.subject, html: o.html });
  }
}

function brandWrap(title, body) {
  return `
    <div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#FFF8E7;color:#3E2723;border-radius:16px;">
      <h1 style="font-family:Georgia,serif;color:#3E2723;margin:0 0 16px;">🍫 ChocoDoDo</h1>
      <h2 style="margin:0 0 12px;color:#6B4423;">${title}</h2>
      ${body}
      <hr style="border:none;border-top:2px dashed #F5B7B1;margin:24px 0;"/>
      <p style="color:#6B4423;margin:0;font-size:13px;">From our kitchen to you 🍫</p>
    </div>
  `;
}

async function sendVerificationEmail({ to, name, link }) {
  const html = brandWrap('Verify your email', `
    <p>Hi ${name || 'there'},</p>
    <p>Welcome to ChocoDoDo! Please confirm your email by clicking the link below:</p>
    <p><a href="${link}" style="display:inline-block;background:#3E2723;color:#FFF8E7;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:700;">Verify my email</a></p>
    <p style="font-size:13px;color:#6B4423;">Or paste this link in your browser:<br/><code style="word-break:break-all;">${link}</code></p>
    <p style="font-size:13px;color:#6B4423;">If you didn't sign up, just ignore this email.</p>
  `);
  return send({ to, subject: '🍫 Verify your ChocoDoDo email', html });
}

async function sendPasswordResetEmail({ to, name, link }) {
  const html = brandWrap('Reset your password', `
    <p>Hi ${name || 'there'},</p>
    <p>We got a request to reset your ChocoDoDo password. Click below to set a new one (link expires in 1 hour):</p>
    <p><a href="${link}" style="display:inline-block;background:#C2185B;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:700;">Reset my password</a></p>
    <p style="font-size:13px;color:#6B4423;">Or paste this link in your browser:<br/><code style="word-break:break-all;">${link}</code></p>
    <p style="font-size:13px;color:#6B4423;">If you didn't request this, just ignore this email — your password stays the same.</p>
  `);
  return send({ to, subject: '🔐 Reset your ChocoDoDo password', html });
}

async function sendInvitationEmail({ to, name, role, link, inviter }) {
  const roleLabel = role === 'admin' ? 'as an admin' : '';
  const html = brandWrap("You've been invited!", `
    <p>Hi ${name || 'there'},</p>
    <p><strong>${inviter}</strong> has invited you to join ChocoDoDo ${roleLabel}.</p>
    <p>Click the button below to set your password and finish creating your account:</p>
    <p><a href="${link}" style="display:inline-block;background:#3E2723;color:#FFF8E7;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:700;">Accept invitation</a></p>
    <p style="font-size:13px;color:#6B4423;">Or paste this link in your browser:<br/><code style="word-break:break-all;">${link}</code></p>
    <p style="font-size:13px;color:#6B4423;">If you weren't expecting this, just ignore the email.</p>
  `);
  return send({ to, subject: '🍫 You\'re invited to join ChocoDoDo', html });
}

module.exports = { send, notifyOrder, sendVerificationEmail, sendPasswordResetEmail, sendInvitationEmail };
