// Admin routes — protected by requireAdmin middleware (mounted in server.js).
// Provides full CRUD for products, order management, and user management.

const express = require('express');
const dbApi = require('../lib/db');
const productApi = require('../lib/products');
const auth = require('../lib/auth');
const notify = require('../lib/notify');

const router = express.Router();
const FRONTEND_URL = () => process.env.FRONTEND_URL || `http://localhost:${process.env.PORT || 4242}`;
const isValidEmail = s => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

// ===========================================================
// CATEGORIES
// ===========================================================

router.get('/categories', (req, res) => {
  res.json({ categories: dbApi.listCategoriesAll() });
});

router.post('/categories', (req, res) => {
  const c = req.body || {};
  if (!c.id || !/^[a-z0-9_-]{2,24}$/i.test(c.id)) {
    return res.status(400).json({ error: 'id is required (2-24 alphanumeric chars, lowercase)' });
  }
  if (!c.name_en || c.name_en.trim().length < 2) {
    return res.status(400).json({ error: 'name_en is required' });
  }
  if (dbApi.getCategoryById(c.id)) {
    return res.status(409).json({ error: 'A category with this id already exists' });
  }
  dbApi.insertCategory({
    id: c.id.toLowerCase(),
    name_en: c.name_en.trim(),
    name_ar: c.name_ar?.trim() || '',
    emoji: c.emoji?.trim() || '🍫',
    sort_order: Number(c.sort_order || 0),
    published: c.published === false ? 0 : 1,
  });
  res.json({ category: dbApi.getCategoryById(c.id.toLowerCase()) });
});

router.put('/categories/:id', (req, res) => {
  const id = req.params.id;
  const c = req.body || {};
  if (!c.name_en || c.name_en.trim().length < 2) {
    return res.status(400).json({ error: 'name_en is required' });
  }
  dbApi.upsertCategory({
    id,
    name_en: c.name_en.trim(),
    name_ar: c.name_ar?.trim() || '',
    emoji: c.emoji?.trim() || '🍫',
    sort_order: Number(c.sort_order || 0),
    published: c.published === false ? 0 : 1,
  });
  res.json({ category: dbApi.getCategoryById(id) });
});

router.delete('/categories/:id', (req, res) => {
  // Prevent delete if products exist in that category
  const inUse = dbApi.listProductsAll().some(p => p.cat === req.params.id);
  if (inUse) {
    return res.status(400).json({ error: 'Cannot delete: products exist in this category. Move or delete them first.' });
  }
  const result = dbApi.deleteCategory(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// ===========================================================
// PRODUCTS
// ===========================================================

// GET /api/admin/products  — list ALL products (incl. unpublished)
router.get('/products', (req, res) => {
  res.json({ products: dbApi.listProductsAll() });
});

// GET /api/admin/products/:id
router.get('/products/:id', (req, res) => {
  const p = dbApi.getProductById(req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.json({ product: p });
});

function validateProductPayload(p, { isCreate }) {
  const errors = [];
  if (isCreate) {
    if (!p.id || !/^[a-z0-9_-]{2,32}$/i.test(p.id)) {
      errors.push('id is required (2-32 alphanumeric chars)');
    }
  }
  if (!p.name || p.name.trim().length < 2) errors.push('name is required');
  if (!p.cat) {
    errors.push('cat is required');
  } else if (!dbApi.getCategoryById(p.cat)) {
    errors.push(`cat "${p.cat}" doesn't exist — create the category first`);
  }
  if (p.price === undefined || isNaN(Number(p.price)) || Number(p.price) < 0) {
    errors.push('price must be a non-negative number (in EGP)');
  }
  if (p.options && typeof p.options !== 'object') {
    errors.push('options must be an object');
  }
  return errors;
}

// POST /api/admin/products  — create
router.post('/products', (req, res) => {
  const p = req.body || {};
  const errors = validateProductPayload(p, { isCreate: true });
  if (errors.length) return res.status(400).json({ error: errors.join('; ') });

  if (dbApi.getProductById(p.id)) {
    return res.status(409).json({ error: 'A product with this id already exists' });
  }
  try {
    dbApi.insertProduct(productApi.toRow(p));
    res.json({ product: dbApi.getProductById(p.id) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/admin/products/:id  — update (full upsert)
router.put('/products/:id', (req, res) => {
  const p = { ...req.body, id: req.params.id };
  const errors = validateProductPayload(p, { isCreate: false });
  if (errors.length) return res.status(400).json({ error: errors.join('; ') });
  try {
    dbApi.upsertProduct(productApi.toRow(p));
    res.json({ product: dbApi.getProductById(p.id) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/admin/products/:id/published  — quick toggle
router.patch('/products/:id/published', (req, res) => {
  const { published } = req.body || {};
  dbApi.setProductPublished(req.params.id, !!published);
  res.json({ product: dbApi.getProductById(req.params.id) });
});

// DELETE /api/admin/products/:id
router.delete('/products/:id', (req, res) => {
  const result = dbApi.deleteProduct(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// ===========================================================
// ORDERS
// ===========================================================

// GET /api/admin/orders
router.get('/orders', (req, res) => {
  const limit = Math.min(500, Number(req.query.limit) || 200);
  const orders = dbApi.listOrders(limit).map(o => ({
    ...o,
    items: JSON.parse(o.items_json),
  }));
  res.json({ orders });
});

// GET /api/admin/orders.csv  — bookkeeping export
router.get('/orders.csv', (req, res) => {
  const limit = Math.min(10000, Number(req.query.limit) || 5000);
  const orders = dbApi.listOrders(limit);
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v).replace(/"/g, '""');
    return /[",\n\r]/.test(s) ? `"${s}"` : s;
  };
  const headers = [
    'order_id','created_at','status','tracking_status','payment_method','payment_mode',
    'customer_name','customer_email','customer_phone','address','notes',
    'subtotal_egp','delivery_egp','tax_egp','total_egp','deposit_egp','remaining_egp','currency',
    'items_summary',
  ];
  const lines = [headers.join(',')];
  for (const o of orders) {
    let itemsSummary = '';
    try {
      const items = JSON.parse(o.items_json || '[]');
      itemsSummary = items.map(i => `${i.name || i.id} x${i.qty}`).join(' | ');
    } catch {}
    lines.push([
      esc(o.id), esc(o.created_at), esc(o.status), esc(o.tracking_status),
      esc(o.payment_method), esc(o.payment_mode),
      esc(o.customer_name), esc(o.customer_email), esc(o.customer_phone),
      esc(o.address), esc(o.notes),
      esc((o.subtotal_cents || 0) / 100),
      esc((o.delivery_cents || 0) / 100),
      esc((o.tax_cents || 0) / 100),
      esc((o.total_cents || 0) / 100),
      esc((o.deposit_cents || 0) / 100),
      esc((o.remaining_cents || 0) / 100),
      esc(o.currency),
      esc(itemsSummary),
    ].join(','));
  }
  const filename = `chocododo-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('﻿' + lines.join('\n'));  // BOM so Excel reads UTF-8 correctly
});

// PATCH /api/admin/orders/:id/status
router.patch('/orders/:id/status', (req, res) => {
  const { status } = req.body || {};
  const valid = ['pending', 'paid', 'cod-confirmed', 'preparing', 'out-for-delivery', 'delivered', 'failed', 'refunded', 'cancelled'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  dbApi.setOrderStatus(req.params.id, status);
  res.json({ order: dbApi.getOrder(req.params.id) });
});

// ===========================================================
// STAFF MANAGEMENT (separate auth domain — only admins manage other staff)
// ===========================================================

// GET /api/admin/staff
router.get('/staff', (req, res) => {
  res.json({ staff: dbApi.listStaff(200) });
});

// POST /api/admin/staff/invite   { email, name, role }
router.post('/staff/invite', async (req, res) => {
  const { email, name, role } = req.body || {};
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Valid email required' });
  if (!['admin', 'staff'].includes(role)) return res.status(400).json({ error: 'Role must be admin or staff' });
  if (dbApi.getStaffByEmail(email)) {
    return res.status(409).json({ error: 'Staff with that email already exists' });
  }
  const placeholder = await auth.hashPassword(auth.randomToken(16));
  const inviteToken = auth.randomToken();
  const result = dbApi.insertStaff({
    email: email.trim(),
    password_hash: placeholder,
    name: (name || '').trim() || null,
    role,
    invited_by: req.staff?.id || null,
    invite_token: inviteToken,
    invite_accepted: 0,
  });
  const link = `${FRONTEND_URL()}/pages/staff-accept-invite.html?token=${inviteToken}`;
  let emailed = false;
  try {
    await notify.notifyStaffInvite({
      to: email.trim(), name: (name || '').trim() || email.trim(),
      role, token: inviteToken,
      inviter: req.staff?.name || req.staff?.email || 'admin',
    });
    emailed = true;
  } catch (err) {
    console.error('staff invite notify failed:', err.message);
  }
  res.json({ ok: true, staff: dbApi.getStaffById(result.lastInsertRowid), invite_link: link, emailed });
});

// PATCH /api/admin/staff/:id  — edit profile fields (name)
router.patch('/staff/:id', (req, res) => {
  const id = Number(req.params.id);
  const { name } = req.body || {};
  if (typeof name !== 'string' || name.trim().length < 2) {
    return res.status(400).json({ error: 'Name must be at least 2 characters' });
  }
  const target = dbApi.getStaffById(id);
  if (!target) return res.status(404).json({ error: 'Staff not found' });
  dbApi.setStaffName(id, name.trim());
  res.json({ staff: dbApi.getStaffById(id) });
});

// PATCH /api/admin/staff/:id/role
router.patch('/staff/:id/role', (req, res) => {
  const { role } = req.body || {};
  if (!['admin', 'staff'].includes(role)) {
    return res.status(400).json({ error: 'Role must be admin or staff' });
  }
  if (role === 'staff') {
    const target = dbApi.getStaffById(Number(req.params.id));
    if (target?.role === 'admin' && dbApi.staffAdminCount() <= 1) {
      return res.status(400).json({ error: 'Cannot demote the last admin' });
    }
  }
  dbApi.setStaffRole(Number(req.params.id), role);
  res.json({ staff: dbApi.getStaffById(Number(req.params.id)) });
});

// DELETE /api/admin/staff/:id
router.delete('/staff/:id', (req, res) => {
  const id = Number(req.params.id);
  if (req.staff?.id === id) return res.status(400).json({ error: "You can't delete your own account" });
  const target = dbApi.getStaffById(id);
  if (!target) return res.status(404).json({ error: 'Staff not found' });
  if (target.role === 'admin' && dbApi.staffAdminCount() <= 1) {
    return res.status(400).json({ error: 'Cannot delete the last admin' });
  }
  dbApi.deleteStaff(id);
  res.json({ ok: true });
});

// POST /api/admin/staff/:id/resend-invite
router.post('/staff/:id/resend-invite', async (req, res) => {
  const id = Number(req.params.id);
  const s = dbApi.getStaffByIdFull(id);
  if (!s) return res.status(404).json({ error: 'Staff not found' });
  const token = auth.randomToken();
  dbApi.setStaffInviteToken(s.id, token);
  const link = `${FRONTEND_URL()}/pages/staff-accept-invite.html?token=${token}`;
  let emailed = false;
  try {
    await notify.notifyStaffInvite({
      to: s.email, name: s.name, role: s.role, token,
      inviter: req.staff?.name || req.staff?.email || 'admin',
    });
    emailed = true;
  } catch (err) {
    console.error('staff resend-invite failed:', err.message);
  }
  res.json({ ok: true, emailed, link });
});

// POST /api/admin/staff/:id/resend-reset
router.post('/staff/:id/resend-reset', async (req, res) => {
  const id = Number(req.params.id);
  const s = dbApi.getStaffById(id);
  if (!s) return res.status(404).json({ error: 'Staff not found' });
  const token = auth.randomToken();
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  dbApi.setStaffResetToken(s.id, token, expires);
  let emailed = false;
  try {
    await notify.notifyStaffReset({ to: s.email, name: s.name, token });
    emailed = true;
  } catch (err) { console.error('staff reset notify failed:', err.message); }
  const link = `${FRONTEND_URL()}/pages/staff-reset-password.html?token=${token}`;
  res.json({ ok: true, emailed, link });
});

// ===========================================================
// CUSTOMERS (read-only summary; full PII only via order details)
// ===========================================================

// GET /api/admin/customers — summary list, no addresses
router.get('/customers', (req, res) => {
  res.json({ customers: dbApi.listCustomers(500) });
});

// POST /api/admin/customers — create a customer manually (e.g. for walk-ins)
router.post('/customers', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body || {};
    if (!name || name.trim().length < 2) return res.status(400).json({ error: 'Name required' });
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Valid email required' });
    if (!/^(\+?20|0)?1[0125]\d{8}$/.test(String(phone || '').replace(/[\s\-()]/g, ''))) {
      return res.status(400).json({ error: 'Valid Egyptian mobile number required' });
    }
    if (dbApi.getCustomerByEmail(email)) {
      return res.status(409).json({ error: 'A customer with this email already exists' });
    }
    // Use admin-supplied password OR generate a random one (admin can hand it over verbally)
    const plain = (password && password.length >= 8) ? password : auth.randomToken(8);
    const hash = await auth.hashPassword(plain);
    const result = dbApi.insertCustomer({
      email: email.trim(),
      password_hash: hash,
      name: name.trim(),
      phone: phone.trim(),
      verification_token: null,
      email_verified: 1,        // admin-created → trust it
    });
    res.json({
      ok: true,
      customer: dbApi.getCustomerById(result.lastInsertRowid),
      // Hand the temp password back so admin can pass it on. NEVER stored in plaintext.
      temp_password: password ? null : plain,
    });
  } catch (err) {
    console.error('admin create customer error:', err);
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/admin/customers/:id — edit name/email/phone
router.patch('/customers/:id', (req, res) => {
  const id = Number(req.params.id);
  const target = dbApi.getCustomerByIdFull(id);
  if (!target) return res.status(404).json({ error: 'Customer not found' });

  const { name, email, phone } = req.body || {};
  if (name !== undefined && (!name || name.trim().length < 2)) {
    return res.status(400).json({ error: 'Name must be at least 2 characters' });
  }
  if (email !== undefined && !isValidEmail(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }
  if (phone !== undefined && phone && !/^(\+?20|0)?1[0125]\d{8}$/.test(String(phone).replace(/[\s\-()]/g, ''))) {
    return res.status(400).json({ error: 'Valid Egyptian mobile number required' });
  }

  // If email is changing, ensure no collision
  if (email !== undefined && email.toLowerCase() !== target.email.toLowerCase()) {
    if (dbApi.getCustomerByEmail(email)) {
      return res.status(409).json({ error: 'Another customer already uses that email' });
    }
    dbApi.db.prepare('UPDATE customers SET email = ? WHERE id = ?').run(email.trim(), id);
  }

  // Use existing setProfile for name + phone
  const newName = name !== undefined ? name.trim() : target.name;
  const newPhone = phone !== undefined ? (phone.trim() || null) : target.phone;
  dbApi.setCustomerProfile(id, newName, newPhone);

  res.json({ customer: dbApi.getCustomerById(id) });
});

// DELETE /api/admin/customers/:id — delete account + cascade
router.delete('/customers/:id', (req, res) => {
  const id = Number(req.params.id);
  const target = dbApi.getCustomerById(id);
  if (!target) return res.status(404).json({ error: 'Customer not found' });
  // Cascade: addresses, reviews, and disconnect orders (we keep order history for accounting)
  dbApi.db.prepare('DELETE FROM addresses WHERE user_id = ?').run(id);
  dbApi.db.prepare('DELETE FROM reviews   WHERE customer_id = ?').run(id);
  dbApi.db.prepare('UPDATE orders SET customer_id = NULL WHERE customer_id = ?').run(id);
  dbApi.deleteCustomer(id);
  res.json({ ok: true });
});

// POST /api/admin/customers/:id/reset-password — admin generates a fresh temp password
router.post('/customers/:id/reset-password', async (req, res) => {
  const id = Number(req.params.id);
  const target = dbApi.getCustomerById(id);
  if (!target) return res.status(404).json({ error: 'Customer not found' });
  const tempPassword = auth.randomToken(8);
  const hash = await auth.hashPassword(tempPassword);
  dbApi.setCustomerPassword(id, hash);
  res.json({ ok: true, temp_password: tempPassword });
});

// POST /api/admin/customers/:id/verify  — manually mark a customer verified
router.post('/customers/:id/verify', (req, res) => {
  const id = Number(req.params.id);
  const c = dbApi.getCustomerById(id);
  if (!c) return res.status(404).json({ error: 'Customer not found' });
  dbApi.markCustomerVerified(id);
  res.json({ ok: true, customer: dbApi.getCustomerById(id) });
});

// POST /api/admin/customers/:id/grant-points  { points, reason? }
router.post('/customers/:id/grant-points', (req, res) => {
  const id = Number(req.params.id);
  const points = parseInt(req.body?.points, 10);
  if (!points || isNaN(points)) return res.status(400).json({ error: 'points (integer) required' });
  const c = dbApi.getCustomerById(id);
  if (!c) return res.status(404).json({ error: 'Customer not found' });
  dbApi.addCustomerPoints(id, points);
  res.json({ ok: true, customer: dbApi.getCustomerById(id) });
});

// ===========================================================
// REVIEWS MODERATION
// ===========================================================
router.get('/reviews', (req, res) => {
  res.json({ reviews: dbApi.listReviewsAll(200), pending: dbApi.listReviewsPending() });
});
router.patch('/reviews/:id/approve', (req, res) => {
  dbApi.approveReview(Number(req.params.id));
  res.json({ ok: true });
});
router.delete('/reviews/:id', (req, res) => {
  dbApi.deleteReview(Number(req.params.id));
  res.json({ ok: true });
});

// ===========================================================
// DELIVERY SLOTS
// ===========================================================
router.get('/slots', (req, res) => {
  res.json({ slots: dbApi.listAllSlots() });
});
router.post('/slots', (req, res) => {
  const { label, starts_at, capacity, enabled } = req.body || {};
  if (!label || !starts_at) return res.status(400).json({ error: 'label and starts_at required' });
  const cap = Math.max(1, parseInt(capacity, 10) || 5);
  const result = dbApi.insertSlot(label, starts_at, cap, enabled === false ? 0 : 1);
  res.json({ slot: dbApi.getSlot(result.lastInsertRowid) });
});
router.delete('/slots/:id', (req, res) => {
  dbApi.deleteSlot(Number(req.params.id));
  res.json({ ok: true });
});
router.patch('/slots/:id/enabled', (req, res) => {
  dbApi.setSlotEnabled(Number(req.params.id), !!req.body?.enabled);
  res.json({ ok: true, slot: dbApi.getSlot(Number(req.params.id)) });
});

// ===========================================================
// TEST NOTIFICATION — sends a sample alert so admin can verify setup
// ===========================================================
router.post('/notify/test', async (req, res) => {
  const stamp = new Date().toLocaleString('en-GB', { timeZone: 'Africa/Cairo' });
  const message =
`🧪 ChocoDoDo test notification

This is a test from the admin panel at ${stamp} (Cairo).
If you see this on Telegram/WhatsApp/email — your setup is working ✓`;

  const results = await Promise.all([
    notify.sendTelegram(message).catch(e => ({ ok: false, reason: e.message })),
    notify.sendCallMeBotWhatsApp(message).catch(e => ({ ok: false, reason: e.message })),
    process.env.EMAIL_TO_OWNER
      ? notify.sendEmail({
          to: process.env.EMAIL_TO_OWNER,
          subject: '🧪 ChocoDoDo test notification',
          html: `<pre style="font-family:monospace;background:#FFF8E7;padding:16px;border-radius:8px;">${message}</pre>`,
        }).catch(e => ({ ok: false, reason: e.message }))
      : Promise.resolve({ ok: false, reason: 'EMAIL_TO_OWNER not set' }),
  ]);

  res.json({
    telegram: results[0],
    whatsapp: results[1],
    email:    results[2],
  });
});

// ===========================================================
// SETTINGS (key/value — themes, deposit %, etc.)
// ===========================================================
router.get('/settings', (req, res) => {
  res.json({
    settings: dbApi.allSettings(),
    notifications: {
      telegram:  notify.isTelegramConfigured(),
      whatsapp:  notify.isCallMeBotConfigured(),
      wa_link:   notify.isOwnerWhatsappSet(),
      smtp:      notify.isSmtpConfigured(),
    },
  });
});
router.put('/settings/:key', (req, res) => {
  const { value } = req.body || {};
  dbApi.setSetting(req.params.key, value);
  res.json({ ok: true, key: req.params.key, value });
});

// ===========================================================
// ORDER TRACKING STATUS (admin updates)
// ===========================================================
router.patch('/orders/:id/tracking', (req, res) => {
  const valid = ['received', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];
  const t = req.body?.tracking_status;
  if (!valid.includes(t)) return res.status(400).json({ error: 'Invalid tracking status' });
  dbApi.db.prepare(`UPDATE orders SET tracking_status = ? WHERE id = ?`).run(t, req.params.id);
  // Sync Telegram message (best effort)
  try {
    const tgBot = require('../lib/telegram-bot');
    tgBot.refreshOrderMessage(req.params.id).catch(() => {});
  } catch {}
  res.json({ ok: true });
});

// ===========================================================
// STATS + LOW STOCK (dashboard)
// ===========================================================
router.get('/stats', (req, res) => {
  const all = dbApi.listOrders(500);
  const paid = all.filter(o => o.status === 'paid' || o.status === 'cod-confirmed' || o.status === 'delivered');
  const totalRevenueMinor = paid.reduce((s, o) => s + (o.total_cents || 0), 0);
  const today = new Date().toISOString().slice(0, 10);
  const todays = all.filter(o => o.created_at?.startsWith(today));
  res.json({
    orders_total: all.length,
    orders_today: todays.length,
    revenue_total_egp: Math.round(totalRevenueMinor / 100),
    paid_orders: paid.length,
    pending_orders: all.filter(o => o.status === 'pending').length,
    products_count: dbApi.productCount(),
    customers_count: dbApi.customerCount(),
    staff_count: dbApi.staffCount(),
    pending_reviews: dbApi.listReviewsPending().length,
    low_stock: dbApi.listLowStock().map(p => ({
      id: p.id, name: p.name, stock: p.stock, low_stock_at: p.low_stock_at,
    })),
  });
});

// PATCH /api/admin/products/:id/stock  { stock }
router.patch('/products/:id/stock', (req, res) => {
  const { stock } = req.body || {};
  const n = Number(stock);
  if (Number.isNaN(n) || n < 0) return res.status(400).json({ error: 'Stock must be a non-negative number' });
  dbApi.setProductStock(req.params.id, Math.floor(n));
  res.json({ product: dbApi.getProductById(req.params.id) });
});

module.exports = router;
