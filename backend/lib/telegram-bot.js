// =====================================================
// Telegram bot — long-polling for inline button callbacks.
//   - Receives callback_query when admin taps order-status buttons
//   - Updates the order's tracking_status in DB
//   - Edits the original message to reflect the new status
//   - Sends a small toast back to the admin via answerCallbackQuery
//
// Long polling means the bot works on localhost (no webhook needed).
// =====================================================

const dbApi = require('./db');

const API = 'https://api.telegram.org';
const POLL_TIMEOUT_S = 25;

let _running = false;
let _offset = 0;
let _abortCtrl = null;

function token() { return process.env.TELEGRAM_BOT_TOKEN; }
function chatId() { return process.env.TELEGRAM_CHAT_ID; }
function isConfigured() { return !!(token() && chatId()); }

let _botUsername = null;
async function botUsername() {
  if (process.env.TELEGRAM_BOT_USERNAME) return process.env.TELEGRAM_BOT_USERNAME.replace(/^@/, '');
  if (_botUsername !== null) return _botUsername;
  if (!token()) return null;
  try {
    const me = await tg('getMe', {});
    _botUsername = me.username || null;
    if (_botUsername) console.log(`[telegram] bot username: @${_botUsername}`);
    return _botUsername;
  } catch (err) {
    return null;
  }
}

async function tg(method, body) {
  if (!token()) throw new Error('TELEGRAM_BOT_TOKEN not set');
  const res = await fetch(`${API}/bot${token()}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok || !data?.ok) {
    const reason = data?.description || `${res.status}`;
    throw new Error(`Telegram ${method}: ${reason}`);
  }
  return data.result;
}

/**
 * Build the inline keyboard for an order. Buttons let the owner
 * change tracking_status with one tap from Telegram.
 */
function orderKeyboard(orderId, current) {
  const mark = (val) => current === val ? '✅ ' : '';
  return {
    inline_keyboard: [
      [
        { text: `${mark('preparing')}👩‍🍳 Preparing`,
          callback_data: `s:${orderId}:preparing` },
        { text: `${mark('out_for_delivery')}🛵 Out for delivery`,
          callback_data: `s:${orderId}:out_for_delivery` },
      ],
      [
        { text: `${mark('delivered')}🎉 Delivered`,
          callback_data: `s:${orderId}:delivered` },
        { text: '❌ Cancel',
          callback_data: `s:${orderId}:cancelled` },
      ],
    ],
  };
}

const TRACKING_LABEL_EN = {
  received: 'Received',
  preparing: 'Preparing',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};
const TRACKING_LABEL_AR = {
  received: 'تم الاستلام',
  preparing: 'قيد التحضير',
  out_for_delivery: 'في الطريق إليك',
  delivered: 'تم التسليم',
  cancelled: 'تم الإلغاء',
};

/** Render an order as a bilingual message text (HTML formatting) */
function renderOrderMessage(order) {
  const items = (() => { try { return JSON.parse(order.items_json || '[]'); } catch { return []; } })();
  const itemLines = items.map(i => {
    // Try to find AR name from products table for richer line
    const p = dbApi.getProductById(i.id);
    const nameAr = p?.name_ar || '';
    const nameEn = p?.name || i.name || i.id;
    const arBlock = nameAr ? `\n   🇪🇬 <i>${nameAr}</i>` : '';
    return `• <b>${nameEn}</b> × ${i.qty}${arBlock}`;
  }).join('\n');

  const fmt = (cents) => {
    const v = (cents || 0) / 100;
    return `${Number.isInteger(v) ? v : v.toFixed(2)} EGP`;
  };

  const tStatusEn = TRACKING_LABEL_EN[order.tracking_status] || 'Received';
  const tStatusAr = TRACKING_LABEL_AR[order.tracking_status] || 'تم الاستلام';

  const depositLine = (order.payment_mode === 'deposit' && order.deposit_cents)
    ? `\n💎 Deposit / مقدم: <b>${fmt(order.deposit_cents)}</b> (${order.deposit_pct}%)\n💰 Remaining / المتبقي: <b>${fmt(order.remaining_cents)}</b>`
    : '';

  return `🍫 <b>NEW ORDER / طلب جديد</b>
📦 Order: <code>${order.id}</code>
📊 Status / الحالة: <b>${tStatusEn} · ${tStatusAr}</b>

👤 <b>${escapeHtml(order.customer_name || '')}</b>
📞 ${escapeHtml(order.customer_phone || '')}
✉️ ${escapeHtml(order.customer_email || '')}
📍 ${escapeHtml(order.address || '—')}
${order.notes ? `📝 ${escapeHtml(order.notes)}\n` : ''}
🛍 <b>Items / المنتجات:</b>
${itemLines}

💵 Total / الإجمالي: <b>${fmt(order.total_cents)}</b>${depositLine}
💳 ${order.payment_method.toUpperCase()} · ${order.status}`;
}

function escapeHtml(s = '') {
  return String(s)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

/** Build the t.me deep link a customer can tap to receive their code. */
async function verifyDeepLink(code) {
  const username = await botUsername();
  if (!username || !code) return null;
  return `https://t.me/${username}?start=v${code}`;
}

/**
 * Send a fresh order alert with inline buttons.
 * Saves the message_id so we can edit it later when status changes.
 */
async function sendOrderAlert(order) {
  if (!isConfigured()) return null;
  try {
    const text = renderOrderMessage(order);
    const result = await tg('sendMessage', {
      chat_id: chatId(),
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: orderKeyboard(order.id, order.tracking_status || 'received'),
    });
    // Persist the message_id so we can edit later
    try {
      dbApi.db.prepare(
        `UPDATE orders SET telegram_msg_id = ? WHERE id = ?`
      ).run(result.message_id, order.id);
    } catch (e) {
      // Add column on the fly if it doesn't exist
      try {
        dbApi.db.exec(`ALTER TABLE orders ADD COLUMN telegram_msg_id INTEGER`);
        dbApi.db.prepare(`UPDATE orders SET telegram_msg_id = ? WHERE id = ?`).run(result.message_id, order.id);
      } catch (e2) { console.error('[telegram] msg_id save failed:', e2.message); }
    }
    return result;
  } catch (err) {
    console.error('[telegram] sendOrderAlert failed:', err.message);
    return null;
  }
}

/**
 * Refresh the existing Telegram message for an order so its
 * tracking-status block + button highlights stay current.
 */
async function refreshOrderMessage(orderId) {
  if (!isConfigured()) return;
  try {
    const row = dbApi.db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!row || !row.telegram_msg_id) return;
    const text = renderOrderMessage(row);
    await tg('editMessageText', {
      chat_id: chatId(),
      message_id: row.telegram_msg_id,
      text,
      parse_mode: 'HTML',
      reply_markup: orderKeyboard(row.id, row.tracking_status || 'received'),
    });
  } catch (err) {
    // Common: "message is not modified" — harmless
    if (!String(err.message).includes('not modified')) {
      console.error('[telegram] refresh failed:', err.message);
    }
  }
}

// ---------- Long polling ----------

async function start() {
  if (_running) return;
  if (!isConfigured()) {
    console.log('[telegram] long-polling skipped — TELEGRAM_BOT_TOKEN not set');
    return;
  }
  _running = true;
  console.log('[telegram] long-polling started');
  // Drain backlog quickly first time
  try {
    const updates = await tg('getUpdates', { offset: 0, timeout: 0, limit: 100 });
    if (updates.length) _offset = updates[updates.length - 1].update_id + 1;
  } catch {}
  pollLoop();
}

function stop() {
  _running = false;
  if (_abortCtrl) try { _abortCtrl.abort(); } catch {}
}

async function pollLoop() {
  while (_running) {
    try {
      const updates = await tg('getUpdates', { offset: _offset, timeout: POLL_TIMEOUT_S });
      for (const u of updates) {
        _offset = u.update_id + 1;
        if (u.callback_query) {
          handleCallback(u.callback_query).catch(e => console.error('[telegram] cb error:', e.message));
        }
        if (u.message && u.message.text) {
          handleMessage(u.message).catch(e => console.error('[telegram] msg error:', e.message));
        }
      }
    } catch (err) {
      // Network blip / Telegram restart — wait and retry
      console.error('[telegram] poll error:', err.message);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

/**
 * Handle a regular text message to the bot.
 *
 * Account verification on Choco Dodo is EMAIL ONLY — the bot does NOT verify
 * customers who send their code here. We just point them to their inbox so
 * everyone uses the same single channel.
 */
async function handleMessage(msg) {
  const text = (msg.text || '').trim();
  const chatIdFrom = String(msg.chat?.id || '');

  // /start (with or without param) — friendly hello, redirect to email
  if (/^\/start\b/i.test(text)) {
    await tg('sendMessage', {
      chat_id: chatIdFrom,
      text:
`👋 Welcome to ChocoDoDo!

Account verification now runs through email. Open the verification email we sent you and tap the "Verify my email" button (or paste the 6-digit code on the website).

📧 Check your inbox — and your spam folder, just in case.`,
    });
    return;
  }

  // If the customer sends a 6-digit code, gently redirect them to email
  if (/\b\d{6}\b/.test(text)) {
    await tg('sendMessage', {
      chat_id: chatIdFrom,
      text:
`📧 Verification is now email-only.

Open the verification email we sent you and either tap the link or paste the 6-digit code on the verify page.`,
    });
    return;
  }
}

async function handleCallback(cb) {
  const data = cb.data || '';
  const fromId = String(cb.from?.id || '');
  // Authorize: only the configured chat owner can change orders
  if (chatId() && fromId !== String(chatId())) {
    await tg('answerCallbackQuery', {
      callback_query_id: cb.id, text: 'Not authorized', show_alert: true,
    });
    return;
  }

  // data shape: "s:<orderId>:<newStatus>"
  if (!data.startsWith('s:')) return;
  const [, orderId, newStatus] = data.split(':');
  const valid = ['received', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];
  if (!valid.includes(newStatus)) {
    await tg('answerCallbackQuery', { callback_query_id: cb.id, text: 'Invalid status' });
    return;
  }

  const order = dbApi.db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) {
    await tg('answerCallbackQuery', { callback_query_id: cb.id, text: 'Order not found', show_alert: true });
    return;
  }

  dbApi.db.prepare(`UPDATE orders SET tracking_status = ? WHERE id = ?`).run(newStatus, orderId);

  // If marked delivered, also flip payment status if currently pending
  if (newStatus === 'delivered' && order.status === 'pending') {
    dbApi.setOrderStatus(orderId, 'paid');
  }
  if (newStatus === 'cancelled') {
    dbApi.setOrderStatus(orderId, 'cancelled');
  }

  const labelEn = TRACKING_LABEL_EN[newStatus];
  const labelAr = TRACKING_LABEL_AR[newStatus];

  await tg('answerCallbackQuery', {
    callback_query_id: cb.id,
    text: `Updated to ${labelEn} · ${labelAr}`,
  });

  // Re-render message to highlight new state
  await refreshOrderMessage(orderId);
}

module.exports = {
  isConfigured,
  botUsername,
  verifyDeepLink,
  start, stop,
  sendOrderAlert,
  refreshOrderMessage,
  TRACKING_LABEL_EN, TRACKING_LABEL_AR,
};
