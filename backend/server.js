// =====================================================
// ChocoDoDo Backend
//   Auth + customer accounts + admin panel
//   Manual-confirmation payments only: InstaPay, Vodafone Cash, COD
// =====================================================

require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const dbApi = require('./lib/db');
const productApi = require('./lib/products');
const auth = require('./lib/auth');
const { priceCart, currentDeliveryMinor, currentTaxRate, currentDepositPct } = require('./lib/pricing');

const authRoutes = require('./routes/auth');
const staffAuthRoutes = require('./routes/staff-auth');
const adminRoutes = require('./routes/admin');
const productsRoutes = require('./routes/products');
const uploadRoutes = require('./routes/upload');
const reviewsRoutes = require('./routes/reviews');
const slotsRoutes = require('./routes/slots');
const notify = require('./lib/notify');
const telegramBot = require('./lib/telegram-bot');

const PORT          = Number(process.env.PORT || 4242);
const FRONTEND_URL  = process.env.FRONTEND_URL || `http://localhost:${PORT}`;
const CURRENCY      = (process.env.CURRENCY || 'egp').toLowerCase();
const ADMIN_KEY     = process.env.ADMIN_KEY || 'change-me';

const app = express();
app.set('trust proxy', 1);

// ---------- CORS ----------
const IS_PROD = process.env.NODE_ENV === 'production';
const allowedOrigins = FRONTEND_URL.split(',').map(s => s.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);  // same-origin requests have no Origin header
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) return cb(null, true);
    if (IS_PROD) {
      // Strict: reject any origin not in FRONTEND_URL (comma-separated whitelist).
      return cb(new Error(`CORS: ${origin} not allowed`));
    }
    // Dev: permissive so localhost tools / Live Server / file:// can hit the API.
    cb(null, true);
  },
  credentials: true,
}));

// ---------- Body + cookies ----------
app.use(express.json({ limit: '64kb' }));
app.use(cookieParser());
app.use(auth.attachBoth);  // attaches req.customer + req.staff (separate domains)

// ---------- SEO: dynamic sitemap + robots ----------
// Sitemap is generated at request time using FRONTEND_URL, so once you switch
// domains in Railway env, the sitemap auto-updates. Search engines see only
// public, indexable pages — never the staff/admin endpoints.
app.get('/sitemap.xml', (req, res) => {
  const base = (process.env.FRONTEND_URL || `https://${req.headers.host}`).replace(/\/$/, '');
  const pages = [
    { path: '/',                       changefreq: 'weekly',  priority: '1.0' },
    { path: '/menu.html',              changefreq: 'weekly',  priority: '0.9' },
    { path: '/pages/track.html',       changefreq: 'monthly', priority: '0.6' },
    { path: '/pages/login.html',       changefreq: 'yearly',  priority: '0.3' },
    { path: '/pages/signup.html',      changefreq: 'yearly',  priority: '0.3' },
    { path: '/pages/privacy.html',     changefreq: 'yearly',  priority: '0.2' },
    { path: '/pages/terms.html',       changefreq: 'yearly',  priority: '0.2' },
    { path: '/pages/returns.html',     changefreq: 'yearly',  priority: '0.2' },
    { path: '/pages/faq.html',         changefreq: 'monthly', priority: '0.3' },
    { path: '/pages/shipping.html',    changefreq: 'yearly',  priority: '0.2' },
  ];
  const today = new Date().toISOString().slice(0, 10);
  const urls = pages.map(p =>
    `  <url>\n    <loc>${base}${p.path}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>`
  ).join('\n');
  res.set('Content-Type', 'application/xml; charset=utf-8');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`);
});

app.get('/robots.txt', (req, res) => {
  const base = (process.env.FRONTEND_URL || `https://${req.headers.host}`).replace(/\/$/, '');
  res.set('Content-Type', 'text/plain; charset=utf-8');
  res.send([
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /pages/admin.html',
    'Disallow: /pages/staff-login.html',
    'Disallow: /pages/staff-accept-invite.html',
    'Disallow: /pages/staff-forgot-password.html',
    'Disallow: /pages/staff-reset-password.html',
    'Disallow: /pages/account.html',
    'Disallow: /pages/checkout.html',
    'Disallow: /pages/confirmation.html',
    'Disallow: /pages/verify-account.html',
    'Disallow: /pages/verify-email.html',
    'Disallow: /pages/reset-password.html',
    'Disallow: /pages/forgot-password.html',
    '',
    `Sitemap: ${base}/sitemap.xml`,
  ].join('\n'));
});

// ---------- Health ----------
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    smtp: notify.isSmtpConfigured(),
    telegram: notify.isTelegramConfigured(),
    whatsapp: notify.isCallMeBotConfigured(),
    wa_link:  notify.isOwnerWhatsappSet(),
    products: dbApi.productCount(),
    customers: dbApi.customerCount(),
    staff: dbApi.staffCount(),
    time: new Date().toISOString(),
  });
});

// ---------- Public ----------
app.get('/api/config', (req, res) => {
  res.json({
    currency: CURRENCY,
    delivery_minor: currentDeliveryMinor(),
    tax_rate: currentTaxRate(),
    deposit_pct: currentDepositPct(),
    notifications: {
      telegram: notify.isTelegramConfigured(),
      whatsapp: notify.isCallMeBotConfigured(),
      wa_link:  notify.isOwnerWhatsappSet(),
      smtp:     notify.isSmtpConfigured(),
    },
  });
});

// Public config — read-only, used by theme detector & store info
app.get('/api/config-public', async (req, res) => {
  res.json({
    theme_override: dbApi.getSetting('theme_override', 'auto'),
    store_name:        dbApi.getSetting('store_name', 'ChocoDoDo'),
    whatsapp_number:   notify.ownerWhatsappNumber() || null,
    instapay_handle:   dbApi.getSetting('instapay_handle', ''),
    instagram_handle:  dbApi.getSetting('instagram_handle', ''),
    telegram_bot_username: await telegramBot.botUsername(),
  });
});
app.use('/api/products', productsRoutes);
app.use('/api/categories', productsRoutes.categoriesRouter);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/slots', slotsRoutes);

// ---------- Customer Auth ----------
app.use('/api/auth', authRoutes);

// ---------- Staff Auth ----------
app.use('/api/staff', staffAuthRoutes);

// ---------- Admin (gated) ----------
app.use('/api/admin', auth.requireAdmin, adminRoutes);
app.use('/api/admin/upload', auth.requireAdmin, uploadRoutes);

// ---------- CHECKOUT ----------
// Deposit % is now read at request time via currentDepositPct() — admin can
// change it from the Settings panel without restarting the server.

function isEgPhone(s) {
  if (!s) return false;
  const cleaned = String(s).replace(/[\s\-()]/g, '');
  // Egyptian mobile: optional +20 or 0 prefix, then 1[0125] + 8 digits
  return /^(\+?20|0)?1[0125]\d{8}$/.test(cleaned);
}

// Rate-limit order placement to deter spammy POSTs that would fill the orders
// table and flood Telegram. 10 orders / 5 min / IP is generous for real customers
// (most place one order at a time) and tight against scripts.
const checkoutLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many checkout attempts from this connection. Please wait a few minutes and try again.' },
});

app.post('/api/checkout', checkoutLimiter, async (req, res) => {
  try {
    const { items, customer, payment_method, payment_mode, delivery_slot_id } = req.body || {};
    if (!customer?.name || !customer?.email) {
      return res.status(400).json({ error: 'Name and email required' });
    }
    if (!isEgPhone(customer.phone)) {
      return res.status(400).json({ error: 'A valid Egyptian mobile number is required (e.g. 01012345678)' });
    }
    if (!customer.address || customer.address.trim().length < 4) {
      return res.status(400).json({ error: 'Delivery address is required' });
    }

    // Default to deposit; only allow 'full' explicitly
    const mode = payment_mode === 'full' ? 'full' : 'deposit';

    // Validate slot if provided
    let slotId = null;
    if (delivery_slot_id) {
      const slot = dbApi.getSlot(Number(delivery_slot_id));
      if (!slot || !slot.enabled) return res.status(400).json({ error: 'Selected delivery slot is unavailable' });
      if (slot.booked >= slot.capacity) return res.status(400).json({ error: 'Selected delivery slot is full' });
      slotId = slot.id;
    }

    const priced = priceCart(items);
    const orderId = 'CD-' + Date.now().toString(36).toUpperCase();
    const customerId = req.customer?.id || null;
    const userId = customerId; // back-compat alias

    // Deposit math
    const depositCents = mode === 'full'
      ? priced.total_cents
      : Math.ceil(priced.total_cents * (currentDepositPct() / 100));
    const remainingCents = priced.total_cents - depositCents;

    const baseRow = {
      id: orderId, user_id: userId,
      customer_name: customer.name, customer_email: customer.email,
      customer_phone: customer.phone || '', address: customer.address || '',
      notes: customer.notes || '',
      subtotal_cents: priced.subtotal_cents, delivery_cents: priced.delivery_cents,
      tax_cents: priced.tax_cents, total_cents: priced.total_cents, currency: CURRENCY,
      items_json: JSON.stringify(priced.items),
    };

    // InstaPay or Vodafone Cash — both use manual confirmation
    // (admin verifies the transfer arrived, then flips order to "paid" in admin panel)
    if (payment_method === 'instapay' || payment_method === 'vcash') {
      const row = {
        ...baseRow,
        status: 'pending',
        payment_method: payment_method,    // store actual method (instapay / vcash)
        stripe_session: null,
      };
      dbApi.insertOrder(row);
      dbApi.db.prepare(`
        UPDATE orders SET payment_mode = ?, deposit_cents = ?, remaining_cents = ?, deposit_pct = ?, customer_id = ?, delivery_slot_id = ?, tracking_status = 'received'
        WHERE id = ?`).run(mode, depositCents, remainingCents, mode === 'full' ? 100 : currentDepositPct(), customerId, slotId, orderId);
      if (slotId) dbApi.bookSlot(slotId);
      const stored = dbApi.getOrder(orderId);
      decrementStockForOrder(stored);
      awardLoyaltyPoints(stored);
      notify.notifyOrder(stored).catch(e => console.error('notify error:', e));
      const waLink = notify.customerWaMeLink(orderId, customer.name);
      return res.json({
        mode: payment_method, orderId,
        redirect: `${FRONTEND_URL}/pages/confirmation.html?id=${orderId}&pay=${payment_method}`,
        whatsapp_link: waLink,
        owner_phone: notify.ownerWhatsappNumber() || null,
        deposit_cents: depositCents,
        remaining_cents: remainingCents,
      });
    }

    if (payment_method === 'cod') {
      // For COD, the "deposit" is paid in cash on delivery alongside the rest.
      const row = {
        ...baseRow,
        status: 'cod-confirmed', payment_method: 'cod', stripe_session: null,
      };
      dbApi.insertOrder(row);
      dbApi.db.prepare(`
        UPDATE orders SET payment_mode = ?, deposit_cents = ?, remaining_cents = ?, deposit_pct = ?, customer_id = ?, delivery_slot_id = ?, tracking_status = 'received'
        WHERE id = ?`).run(
          mode,
          mode === 'full' ? priced.total_cents : 0,
          mode === 'full' ? 0 : priced.total_cents,
          mode === 'full' ? 100 : 0,
          customerId, slotId, orderId
        );
      if (slotId) dbApi.bookSlot(slotId);
      const stored = dbApi.getOrder(orderId);
      decrementStockForOrder(stored);
      awardLoyaltyPoints(stored);
      notify.notifyOrder(stored).catch(e => console.error('notify error:', e));
      const waLink = notify.customerWaMeLink(orderId, customer.name);
      return res.json({
        mode: 'cod', orderId,
        redirect: `${FRONTEND_URL}/pages/confirmation.html?id=${orderId}`,
        whatsapp_link: waLink,
      });
    }

    // Unknown / unsupported payment method
    return res.status(400).json({ error: `Unsupported payment method: ${payment_method}. Use 'instapay', 'vcash', or 'cod'.` });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(400).json({ error: err.message || 'Checkout failed' });
  }
});

// ---------- Order lookup (public — minimal info) ----------
app.get('/api/order/:id', (req, res) => {
  const o = dbApi.getOrder(req.params.id);
  if (!o) return res.status(404).json({ error: 'Order not found' });
  res.json({
    id: o.id,
    status: o.status,
    tracking_status: o.tracking_status || 'received',
    payment_mode: o.payment_mode,
    total_cents: o.total_cents,
    deposit_cents: o.deposit_cents,
    remaining_cents: o.remaining_cents,
    currency: o.currency,
    created_at: o.created_at,
    items: JSON.parse(o.items_json || '[]'),
    whatsapp_link: notify.customerWaMeLink(o.id, o.customer_name),
  });
});

// ---------- Legacy quick-key admin HTML (still works) ----------
app.get('/admin/orders', (req, res) => {
  const key = req.query.key || req.headers['x-admin-key'];
  if (key !== ADMIN_KEY) return res.status(401).send('Unauthorized — append ?key=YOUR_ADMIN_KEY');
  const orders = dbApi.listOrders(200);
  const rows = orders.map(o => {
    const items = JSON.parse(o.items_json);
    const list = items.map(i => `${i.name}×${i.qty}`).join(', ');
    const totalEgp = (o.total_cents / 100).toFixed(0);
    const colors = { paid:'#2e7d32','cod-confirmed':'#1565c0',pending:'#ef6c00',failed:'#c62828',refunded:'#6a1b9a',delivered:'#1b5e20'};
    const c = colors[o.status] || '#555';
    return `<tr><td><code>${o.id}</code></td><td>${o.created_at}</td>
      <td><span style="background:${c};color:#fff;padding:2px 8px;border-radius:10px;font-size:12px">${o.status}</span></td>
      <td>${o.payment_method}</td><td>${o.customer_name}<br><small>${o.customer_email}</small></td>
      <td>${o.address||'—'}</td><td>${list}</td>
      <td style="text-align:right;font-weight:700;">${totalEgp} EGP</td></tr>`;
  }).join('');
  res.send(`<!doctype html><html><head><meta charset="utf-8"><title>ChocoDoDo Quick Admin</title>
    <style>body{font-family:-apple-system,Segoe UI,sans-serif;background:#FFF8E7;color:#3E2723;padding:24px}
    h1{font-family:Georgia,serif}table{border-collapse:collapse;width:100%;background:#fff;box-shadow:0 6px 20px rgba(62,39,35,.1);border-radius:12px;overflow:hidden}
    th,td{padding:10px 12px;border-bottom:1px solid #f5e6d3;font-size:13px;text-align:left;vertical-align:top}
    th{background:#3E2723;color:#FFF8E7}tr:hover{background:#FCE4EC}</style></head>
    <body><h1>🍫 Quick Admin (legacy) — Orders (${orders.length})</h1>
    <p style="margin-bottom:16px">For full admin tools, visit <a href="/pages/admin.html">/pages/admin.html</a></p>
    <table><thead><tr><th>ID</th><th>Created</th><th>Status</th><th>Payment</th><th>Customer</th><th>Address</th><th>Items</th><th>Total</th></tr></thead>
    <tbody>${rows||'<tr><td colspan="8" style="text-align:center;padding:40px">No orders yet</td></tr>'}</tbody></table></body></html>`);
});

// ---------- Loyalty: 1 point per 10 EGP order total ----------
function awardLoyaltyPoints(order) {
  if (!order || !order.customer_id) return;
  const points = Math.floor((order.total_cents || 0) / 1000);  // 10 EGP = 1 point
  if (points > 0) {
    try {
      dbApi.addCustomerPoints(order.customer_id, points);
      dbApi.db.prepare(`UPDATE orders SET points_earned = ? WHERE id = ?`).run(points, order.id);
    } catch (e) { console.error('loyalty error:', e); }
  }
}

// ---------- Stock decrement helper ----------
function decrementStockForOrder(order) {
  if (!order) return;
  let items;
  try { items = JSON.parse(order.items_json); } catch { return; }
  for (const it of items) {
    const productId = it.id;
    const qty = Math.max(0, parseInt(it.qty, 10) || 0);
    if (productId && qty > 0) {
      try { dbApi.decrementStock(productId, qty); } catch {}
    }
  }
}

// ---------- Static frontend ----------
app.use(express.static(path.join(__dirname, '..')));

// ---------- 404 fallback for unmatched non-API requests ----------
// Anything that didn't match a route OR a static file ends up here. API
// requests still return JSON so client code doesn't break; everything else
// gets the on-brand 404 page.
app.use((req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/admin/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.status(404).sendFile(path.join(__dirname, '..', 'pages', '404.html'));
});

// ---------- Boot ----------
async function boot() {
  productApi.seedCategoriesIfEmpty();
  productApi.seedProductsIfEmpty();
  await auth.seedAdmin();

  app.listen(PORT, () => {
    console.log(`\n🍫 ChocoDoDo backend running on http://localhost:${PORT}`);
    console.log(`   Frontend at:    ${FRONTEND_URL}`);
    console.log(`   Telegram:       ${notify.isTelegramConfigured() ? '✅ owner alerts ON' : '⚠️  add TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID to .env'}`);
    console.log(`   WhatsApp link:  ${notify.isOwnerWhatsappSet() ? '✅ wa.me click-to-chat ON' : '⚠️  add WHATSAPP_OWNER_NUMBER to .env'}`);
    console.log(`   SMTP:           ${process.env.SMTP_HOST && process.env.SMTP_USER ? '✅ configured' : '⚠️  emails will print to console'}`);
    console.log(`   Admin panel:    http://localhost:${PORT}/pages/admin.html`);
    console.log(`   Quick admin:    http://localhost:${PORT}/admin/orders?key=${ADMIN_KEY}\n`);
    // Start Telegram bot long-polling in the background.
    // It listens for inline-button taps so the owner can update
    // order status straight from the chat.
    telegramBot.start().catch(e => console.error('telegram bot start error:', e.message));
  });
}
boot().catch(err => { console.error('Boot failed:', err); process.exit(1); });
