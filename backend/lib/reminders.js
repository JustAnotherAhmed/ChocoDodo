// =====================================================
// Telegram delivery reminders — runs hourly, fires twice a day:
//
//   08:00 Cairo  →  "Today's deliveries" digest
//   18:00 Cairo  →  "Tomorrow's deliveries" digest
//
// Both fire ONCE per day. State is persisted via the settings table
// (reminders_last_today / reminders_last_tomorrow) so a server restart
// doesn't cause a duplicate send.
// =====================================================

const dbApi = require('./db');
const notify = require('./notify');
const path = require('path');
const fs = require('fs');
const os = require('os');

const HOUR_TODAY    = 8;   // 08:00 Cairo — today's deliveries
const HOUR_TOMORROW = 18;  // 18:00 Cairo — tomorrow's deliveries
const HOUR_BACKUP   = 3;   // 03:00 Cairo — daily DB backup to owner's email
const TIMEZONE = 'Africa/Cairo';

let _interval = null;

/** Returns { year, month, day, hour } for the current Cairo wall clock. */
function cairoParts() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', hour12: false,
  }).formatToParts(new Date()).reduce((a, p) => {
    if (p.type !== 'literal') a[p.type] = p.value;
    return a;
  }, {});
  return {
    iso: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
  };
}

/** Returns YYYY-MM-DD for "today + offsetDays" in Cairo. */
function cairoDateOffset(offsetDays) {
  const today = cairoParts().iso;
  const [y, m, d] = today.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + offsetDays);
  const pad = n => String(n).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

const WINDOW_LABEL = {
  morning:   '🌅 Morning · 10:00–13:00',
  afternoon: '☀️ Afternoon · 14:00–17:00',
  evening:   '🌙 Evening · 18:00–21:00',
};

function escapeHtml(s = '') {
  return String(s)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function fmtMoney(cents) {
  const v = (cents || 0) / 100;
  return `${Number.isInteger(v) ? v : v.toFixed(2)} EGP`;
}

/** Find orders scheduled for a given YYYY-MM-DD that aren't cancelled. */
function ordersForDate(isoDate) {
  return dbApi.db.prepare(`
    SELECT id, customer_name, customer_phone, address, items_json, total_cents,
           deposit_cents, remaining_cents, payment_mode, payment_method,
           delivery_window, status, tracking_status
      FROM orders
     WHERE delivery_date = ?
       AND COALESCE(status, '') != 'cancelled'
       AND COALESCE(tracking_status, '') != 'cancelled'
     ORDER BY delivery_window, created_at ASC
  `).all(isoDate);
}

function renderOrderLine(o, idx) {
  let itemSummary = '';
  try {
    const items = JSON.parse(o.items_json || '[]');
    itemSummary = items.map(i => `${i.name || i.id} × ${i.qty}`).join(', ');
  } catch {}
  const win = WINDOW_LABEL[o.delivery_window] || (o.delivery_window || 'no time chosen');
  const balance = (o.payment_mode === 'deposit' && o.remaining_cents)
    ? ` · 💰 ${fmtMoney(o.remaining_cents)} on delivery`
    : '';
  return `${idx + 1}. <code>${escapeHtml(o.id)}</code> · ${win}
👤 <b>${escapeHtml(o.customer_name || '')}</b> · 📞 ${escapeHtml(o.customer_phone || '—')}
📍 ${escapeHtml(o.address || '—')}
🛍 ${escapeHtml(itemSummary || '(no items)')}
💵 ${fmtMoney(o.total_cents)}${balance}`;
}

async function sendDigest(label, isoDate) {
  if (!notify.isTelegramConfigured()) return { skipped: 'telegram not configured' };
  const orders = ordersForDate(isoDate);
  if (orders.length === 0) {
    // Quiet day — single short heads-up so the owner knows the reminder fired
    await notify.sendTelegram(`📅 <b>${label} (${isoDate})</b>\nNo orders scheduled.`);
    return { sent: 0 };
  }
  const lines = orders.map(renderOrderLine);
  const totalEgp = orders.reduce((s, o) => s + (o.total_cents || 0), 0);
  const dueEgp   = orders.reduce((s, o) => {
    return s + ((o.payment_mode === 'deposit' && o.remaining_cents) ? o.remaining_cents : 0);
  }, 0);
  const summary = `📦 <b>${orders.length}</b> order${orders.length === 1 ? '' : 's'} · 💵 Total: <b>${fmtMoney(totalEgp)}</b>${dueEgp ? `\n💰 To collect on delivery: <b>${fmtMoney(dueEgp)}</b>` : ''}`;

  const message = `📅 <b>${label} · ${isoDate}</b>\n${summary}\n\n${lines.join('\n\n')}`;
  // Telegram caps messages at 4096 chars; split if needed
  const MAX = 3800;
  if (message.length <= MAX) {
    await notify.sendTelegram(message);
  } else {
    // Send header alone, then each order line as its own message
    await notify.sendTelegram(`📅 <b>${label} · ${isoDate}</b>\n${summary}`);
    for (const line of lines) {
      await notify.sendTelegram(line);
    }
  }
  return { sent: orders.length };
}

// ---------- Daily SQLite backup ----------
// At 03:00 Cairo, snapshot the live DB to a temp file (SQLite online-backup API,
// safe while the DB is being written to) and email it to EMAIL_TO_OWNER as an
// attachment. Tiny by definition for a small bakery — well under the 25 MB
// Gmail attachment ceiling for years of orders.
async function sendDailyDbBackup() {
  const ownerEmail = process.env.EMAIL_TO_OWNER;
  if (!ownerEmail) return { skipped: 'EMAIL_TO_OWNER not set' };
  if (!notify.isSmtpConfigured()) return { skipped: 'SMTP not configured' };

  const stamp = cairoParts().iso;
  const tmpDir = os.tmpdir();
  const fileName = `chocododo-backup-${stamp}.db`;
  const tmpPath = path.join(tmpDir, fileName);

  // better-sqlite3 offers a safe live-backup API. It blocks no writers and
  // gives us a consistent snapshot file.
  try {
    await dbApi.db.backup(tmpPath);
  } catch (err) {
    console.error('[backup] sqlite snapshot failed:', err.message);
    // Fallback: dumb file copy (still works since the WAL keeps reads consistent)
    try {
      const livePath = dbApi.db.name;
      fs.copyFileSync(livePath, tmpPath);
    } catch (err2) {
      return { error: 'backup snapshot failed: ' + err2.message };
    }
  }

  const sizeKb = Math.round(fs.statSync(tmpPath).size / 1024);
  try {
    await notify.sendEmail({
      to: ownerEmail,
      subject: `🗄️ ChocoDoDo daily backup — ${stamp}`,
      html: `
        <div style="font-family:sans-serif;padding:24px;background:#FFF8E7;color:#3E2723;border-radius:14px;">
          <h2 style="font-family:Georgia,serif;">🗄️ Daily database backup</h2>
          <p>Attached: <code>${fileName}</code> (~${sizeKb} KB) — a complete snapshot of the live SQLite database as of ${stamp} Cairo time.</p>
          <p style="font-size:13px;color:#6B4423;">Keep these somewhere safe. To restore, drop this file into <code>backend/data/orders.db</code> on a fresh deploy.</p>
          <p style="font-size:12px;color:#6B4423;">— ChocoDoDo backend, automated</p>
        </div>`,
      attachments: [{ filename: fileName, path: tmpPath, contentType: 'application/octet-stream' }],
    });
    return { sent: true, sizeKb };
  } catch (err) {
    return { error: 'email send failed: ' + err.message };
  } finally {
    // Cleanup the temp snapshot
    try { fs.unlinkSync(tmpPath); } catch {}
  }
}

async function tick() {
  try {
    const { iso, hour } = cairoParts();

    if (hour === HOUR_TODAY) {
      const last = dbApi.getSetting('reminders_last_today', null);
      if (last !== iso) {
        const todayIso = cairoDateOffset(0);
        const result = await sendDigest("🌅 Today's deliveries", todayIso);
        dbApi.setSetting('reminders_last_today', iso);
        console.log(`[reminders] today digest sent for ${todayIso}:`, result);
      }
    }

    if (hour === HOUR_TOMORROW) {
      const last = dbApi.getSetting('reminders_last_tomorrow', null);
      if (last !== iso) {
        const tomorrowIso = cairoDateOffset(1);
        const result = await sendDigest("🌙 Tomorrow's deliveries (prep tonight)", tomorrowIso);
        dbApi.setSetting('reminders_last_tomorrow', iso);
        console.log(`[reminders] tomorrow digest sent for ${tomorrowIso}:`, result);
      }
    }

    if (hour === HOUR_BACKUP) {
      const last = dbApi.getSetting('backup_last_sent', null);
      if (last !== iso) {
        const result = await sendDailyDbBackup();
        dbApi.setSetting('backup_last_sent', iso);
        console.log(`[backup] daily backup ran (${iso}):`, result);
      }
    }
  } catch (err) {
    console.error('[reminders] tick error:', err.message);
  }
}

function start() {
  if (_interval) return;
  // Run once at startup (covers post-restart catch-up if we missed an hour)
  tick();
  // Then every 15 minutes — small enough to be precise, big enough to not spam
  _interval = setInterval(tick, 15 * 60 * 1000);
  console.log(`[reminders] scheduled: 08:00 Cairo (today) + 18:00 Cairo (tomorrow)`);
}

function stop() {
  if (_interval) clearInterval(_interval);
  _interval = null;
}

/** Manually fire a reminder — exposed for the admin "Send test" button. */
async function sendNow(which = 'today') {
  const offset = which === 'tomorrow' ? 1 : 0;
  const label = which === 'tomorrow' ? "🌙 Tomorrow's deliveries (manual test)" : "🌅 Today's deliveries (manual test)";
  return sendDigest(label, cairoDateOffset(offset));
}

module.exports = { start, stop, sendNow, sendDailyDbBackup };
