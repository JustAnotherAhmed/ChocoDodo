// SQLite database — zero-config, file-based.
// Creates ./data/orders.db on first run.
//
// Tables: orders, users, products

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// In production, point DATA_DIR at a persistent volume mount
// (e.g. on Railway: mount a volume at /data and set DATA_DIR=/data).
const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'orders.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ---------- SCHEMA ----------
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id              TEXT PRIMARY KEY,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    status          TEXT NOT NULL DEFAULT 'pending',
    payment_method  TEXT NOT NULL,
    stripe_session  TEXT,
    stripe_payment  TEXT,
    customer_name   TEXT NOT NULL,
    customer_email  TEXT NOT NULL,
    customer_phone  TEXT,
    address         TEXT,
    notes           TEXT,
    subtotal_cents  INTEGER NOT NULL,
    delivery_cents  INTEGER NOT NULL DEFAULT 0,
    tax_cents       INTEGER NOT NULL DEFAULT 0,
    total_cents     INTEGER NOT NULL,
    currency        TEXT NOT NULL DEFAULT 'egp',
    items_json      TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
  CREATE INDEX IF NOT EXISTS idx_orders_status  ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_orders_session ON orders(stripe_session);

  CREATE TABLE IF NOT EXISTS users (
    id                       INTEGER PRIMARY KEY AUTOINCREMENT,
    email                    TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password_hash            TEXT NOT NULL,
    name                     TEXT,
    phone                    TEXT,
    role                     TEXT NOT NULL DEFAULT 'customer', -- 'customer' | 'admin'
    created_at               TEXT NOT NULL DEFAULT (datetime('now')),
    last_login_at            TEXT,
    email_verified           INTEGER NOT NULL DEFAULT 0,
    verification_token       TEXT,
    reset_token              TEXT,
    reset_token_expires_at   TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_users_verify ON users(verification_token);
  CREATE INDEX IF NOT EXISTS idx_users_reset ON users(reset_token);

  CREATE TABLE IF NOT EXISTS categories (
    id            TEXT PRIMARY KEY,
    name_en       TEXT NOT NULL,
    name_ar       TEXT,
    emoji         TEXT,
    sort_order    INTEGER NOT NULL DEFAULT 0,
    published     INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories(sort_order);

  CREATE TABLE IF NOT EXISTS products (
    id            TEXT PRIMARY KEY,
    cat           TEXT NOT NULL,
    sub           TEXT,
    name          TEXT NOT NULL,
    name_ar       TEXT,
    price_minor   INTEGER NOT NULL,        -- piastres for EGP
    desc          TEXT,
    desc_ar       TEXT,
    image         TEXT,
    emoji         TEXT,
    badge         TEXT,                    -- 'hot' | 'new' | NULL
    options_json  TEXT,                    -- JSON: option groups
    published     INTEGER NOT NULL DEFAULT 1,
    sort_order    INTEGER NOT NULL DEFAULT 0,
    track_stock   INTEGER NOT NULL DEFAULT 0,  -- 1 = enforce stock
    stock         INTEGER NOT NULL DEFAULT 0,  -- units remaining (only used if track_stock=1)
    low_stock_at  INTEGER NOT NULL DEFAULT 5,  -- show "low" badge below this
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_products_cat ON products(cat);
  CREATE INDEX IF NOT EXISTS idx_products_pub ON products(published);
`);

// ---------- MIGRATIONS ----------
function ensureColumn(table, name, type, dflt = null) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(name)) {
    const def = dflt !== null ? ` DEFAULT ${dflt}` : '';
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}${def}`);
  }
}
ensureColumn('orders', 'user_id', 'INTEGER');
ensureColumn('orders', 'selected_options_json', 'TEXT');
ensureColumn('users', 'email_verified', 'INTEGER', '0');
ensureColumn('users', 'verification_token', 'TEXT');
ensureColumn('users', 'reset_token', 'TEXT');
ensureColumn('users', 'reset_token_expires_at', 'TEXT');
ensureColumn('products', 'track_stock', 'INTEGER', '0');
ensureColumn('products', 'stock',       'INTEGER', '0');
ensureColumn('products', 'low_stock_at','INTEGER', '5');

// Deposit / payment-mode columns on orders
ensureColumn('orders', 'payment_mode', 'TEXT');                  // 'deposit' | 'full'
ensureColumn('orders', 'deposit_cents', 'INTEGER', '0');         // amount paid as deposit
ensureColumn('orders', 'remaining_cents', 'INTEGER', '0');       // amount due on delivery
ensureColumn('orders', 'deposit_pct', 'INTEGER', '0');           // 0–100

// Addresses table (user address book)
db.exec(`
  CREATE TABLE IF NOT EXISTS addresses (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    label       TEXT,                          -- e.g. "Home", "Office"
    full_name   TEXT,
    phone       TEXT,
    line1       TEXT NOT NULL,
    city        TEXT,
    notes       TEXT,
    is_default  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(user_id);
`);

// ====================================================================
// SECURITY: separate customer + staff tables (different auth domains)
// ====================================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id                       INTEGER PRIMARY KEY AUTOINCREMENT,
    email                    TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password_hash            TEXT NOT NULL,
    name                     TEXT,
    phone                    TEXT,
    points                   INTEGER NOT NULL DEFAULT 0,
    created_at               TEXT NOT NULL DEFAULT (datetime('now')),
    last_login_at            TEXT,
    email_verified           INTEGER NOT NULL DEFAULT 0,
    verification_token       TEXT,
    reset_token              TEXT,
    reset_token_expires_at   TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);

  CREATE TABLE IF NOT EXISTS staff (
    id                       INTEGER PRIMARY KEY AUTOINCREMENT,
    email                    TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password_hash            TEXT NOT NULL,
    name                     TEXT,
    role                     TEXT NOT NULL DEFAULT 'staff', -- 'admin' | 'staff'
    created_at               TEXT NOT NULL DEFAULT (datetime('now')),
    last_login_at            TEXT,
    invited_by               INTEGER,
    invite_token             TEXT,
    invite_accepted          INTEGER NOT NULL DEFAULT 0,
    reset_token              TEXT,
    reset_token_expires_at   TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_staff_email ON staff(email);

  CREATE TABLE IF NOT EXISTS reviews (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id  TEXT NOT NULL,
    customer_id INTEGER,
    rating      INTEGER NOT NULL,    -- 1-5
    title       TEXT,
    body        TEXT,
    photo       TEXT,
    approved    INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
  CREATE INDEX IF NOT EXISTS idx_reviews_approved ON reviews(approved);

  CREATE TABLE IF NOT EXISTS delivery_slots (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    label       TEXT NOT NULL,            -- e.g. "Today 6–8 PM"
    starts_at   TEXT NOT NULL,            -- ISO datetime
    capacity    INTEGER NOT NULL DEFAULT 5,
    booked      INTEGER NOT NULL DEFAULT 0,
    enabled     INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_slots_starts ON delivery_slots(starts_at);

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Add customer_id + delivery_slot_id + theme bits to orders
ensureColumn('orders', 'customer_id',     'INTEGER');
ensureColumn('orders', 'delivery_slot_id','INTEGER');
ensureColumn('orders', 'tracking_status', 'TEXT');     // 'received' | 'preparing' | 'out_for_delivery' | 'delivered'
ensureColumn('orders', 'points_earned',   'INTEGER', '0');

// One-time migration: copy from users → customers / staff if any rows exist there
(function migrateUsersToSplitTables() {
  const userRows = db.prepare(`SELECT * FROM users`).all();
  if (userRows.length === 0) return;
  const insertCustomer = db.prepare(`
    INSERT OR IGNORE INTO customers (email, password_hash, name, phone, created_at, last_login_at, email_verified, verification_token, reset_token, reset_token_expires_at)
    VALUES (@email, @password_hash, @name, @phone, @created_at, @last_login_at, @email_verified, @verification_token, @reset_token, @reset_token_expires_at)
  `);
  const insertStaff = db.prepare(`
    INSERT OR IGNORE INTO staff (email, password_hash, name, role, created_at, last_login_at, invite_accepted, reset_token, reset_token_expires_at)
    VALUES (@email, @password_hash, @name, @role, @created_at, @last_login_at, 1, @reset_token, @reset_token_expires_at)
  `);
  let migCust = 0, migStaff = 0;
  for (const u of userRows) {
    if (u.role === 'admin') {
      const r = insertStaff.run({
        email: u.email, password_hash: u.password_hash, name: u.name,
        role: 'admin', created_at: u.created_at, last_login_at: u.last_login_at,
        reset_token: u.reset_token, reset_token_expires_at: u.reset_token_expires_at,
      });
      if (r.changes) migStaff++;
    } else {
      const r = insertCustomer.run({
        email: u.email, password_hash: u.password_hash, name: u.name, phone: u.phone,
        created_at: u.created_at, last_login_at: u.last_login_at,
        email_verified: u.email_verified || 0,
        verification_token: u.verification_token,
        reset_token: u.reset_token, reset_token_expires_at: u.reset_token_expires_at,
      });
      if (r.changes) migCust++;
    }
  }
  // Re-link orders.user_id → customers.id (since user_id was the old users.id and customers.id starts fresh)
  // Strategy: match by email
  const orders = db.prepare(`SELECT id, customer_email FROM orders WHERE customer_id IS NULL OR customer_id = 0`).all();
  const findCustByEmail = db.prepare(`SELECT id FROM customers WHERE email = ? COLLATE NOCASE`);
  const updateOrderCust = db.prepare(`UPDATE orders SET customer_id = ? WHERE id = ?`);
  let relinked = 0;
  for (const o of orders) {
    if (!o.customer_email) continue;
    const c = findCustByEmail.get(o.customer_email);
    if (c) { updateOrderCust.run(c.id, o.id); relinked++; }
  }
  // Re-link addresses.user_id → customers.id by matching the old users.id → user.email → customers.id
  const addrs = db.prepare(`SELECT id, user_id FROM addresses`).all();
  const oldUser = db.prepare(`SELECT email FROM users WHERE id = ?`);
  const updateAddrUser = db.prepare(`UPDATE addresses SET user_id = ? WHERE id = ?`);
  let relinkedAddr = 0;
  for (const a of addrs) {
    const ou = oldUser.get(a.user_id);
    if (!ou) continue;
    const c = findCustByEmail.get(ou.email);
    if (c && c.id !== a.user_id) {
      updateAddrUser.run(c.id, a.id);
      relinkedAddr++;
    }
  }
  if (migCust || migStaff) {
    console.log(`🔒 Migration: ${migCust} customer(s), ${migStaff} staff, ${relinked} order(s) relinked, ${relinkedAddr} address(es) relinked`);
  }
})();

// ---------- ORDERS ----------
const orderStmts = {
  insert: db.prepare(`
    INSERT INTO orders (
      id, status, payment_method, stripe_session, user_id,
      customer_name, customer_email, customer_phone, address, notes,
      subtotal_cents, delivery_cents, tax_cents, total_cents, currency,
      items_json
    ) VALUES (
      @id, @status, @payment_method, @stripe_session, @user_id,
      @customer_name, @customer_email, @customer_phone, @address, @notes,
      @subtotal_cents, @delivery_cents, @tax_cents, @total_cents, @currency,
      @items_json
    )
  `),
  setStatusBySession: db.prepare(`UPDATE orders SET status = ?, stripe_payment = ? WHERE stripe_session = ?`),
  setStatus:          db.prepare(`UPDATE orders SET status = ? WHERE id = ?`),
  getById:            db.prepare(`SELECT * FROM orders WHERE id = ?`),
  getBySession:       db.prepare(`SELECT * FROM orders WHERE stripe_session = ?`),
  list:               db.prepare(`SELECT * FROM orders ORDER BY created_at DESC LIMIT ?`),
  listByUser:         db.prepare(`SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`),
};

// ---------- USERS ----------
const userStmts = {
  insert: db.prepare(`
    INSERT INTO users (email, password_hash, name, phone, role, verification_token, email_verified)
    VALUES (@email, @password_hash, @name, @phone, @role, @verification_token, @email_verified)
  `),
  getByEmail:        db.prepare(`SELECT * FROM users WHERE email = ? COLLATE NOCASE`),
  getById:           db.prepare(`SELECT id, email, name, phone, role, created_at, last_login_at, email_verified FROM users WHERE id = ?`),
  getByIdFull:       db.prepare(`SELECT * FROM users WHERE id = ?`),
  setPassword:       db.prepare(`UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires_at = NULL WHERE id = ?`),
  setRole:           db.prepare(`UPDATE users SET role = ? WHERE id = ?`),
  setProfile:        db.prepare(`UPDATE users SET name = ?, phone = ? WHERE id = ?`),
  setLastLogin:      db.prepare(`UPDATE users SET last_login_at = datetime('now') WHERE id = ?`),
  list:              db.prepare(`SELECT id, email, name, phone, role, created_at, last_login_at, email_verified FROM users ORDER BY created_at DESC LIMIT ?`),
  countAdmins:       db.prepare(`SELECT COUNT(*) AS c FROM users WHERE role = 'admin'`),
  // Verification
  getByVerifyToken:  db.prepare(`SELECT * FROM users WHERE verification_token = ?`),
  markVerified:      db.prepare(`UPDATE users SET email_verified = 1, verification_token = NULL WHERE id = ?`),
  setVerifyToken:    db.prepare(`UPDATE users SET verification_token = ? WHERE id = ?`),
  // Reset
  setResetToken:     db.prepare(`UPDATE users SET reset_token = ?, reset_token_expires_at = ? WHERE id = ?`),
  getByResetToken:   db.prepare(`SELECT * FROM users WHERE reset_token = ?`),
  // Delete
  delete:            db.prepare(`DELETE FROM users WHERE id = ?`),
};

// ---------- ADDRESSES ----------
const addrStmts = {
  insert: db.prepare(`
    INSERT INTO addresses (user_id, label, full_name, phone, line1, city, notes, is_default)
    VALUES (@user_id, @label, @full_name, @phone, @line1, @city, @notes, @is_default)
  `),
  update: db.prepare(`
    UPDATE addresses
       SET label = @label, full_name = @full_name, phone = @phone,
           line1 = @line1, city = @city, notes = @notes, is_default = @is_default
     WHERE id = @id AND user_id = @user_id
  `),
  delete:        db.prepare(`DELETE FROM addresses WHERE id = ? AND user_id = ?`),
  getById:       db.prepare(`SELECT * FROM addresses WHERE id = ? AND user_id = ?`),
  listByUser:    db.prepare(`SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC`),
  clearDefault:  db.prepare(`UPDATE addresses SET is_default = 0 WHERE user_id = ?`),
  setDefault:    db.prepare(`UPDATE addresses SET is_default = 1 WHERE id = ? AND user_id = ?`),
};

// ---------- CATEGORIES ----------
const catStmts = {
  insert: db.prepare(`
    INSERT INTO categories (id, name_en, name_ar, emoji, sort_order, published)
    VALUES (@id, @name_en, @name_ar, @emoji, @sort_order, @published)
  `),
  upsert: db.prepare(`
    INSERT INTO categories (id, name_en, name_ar, emoji, sort_order, published)
    VALUES (@id, @name_en, @name_ar, @emoji, @sort_order, @published)
    ON CONFLICT(id) DO UPDATE SET
      name_en = excluded.name_en, name_ar = excluded.name_ar,
      emoji = excluded.emoji, sort_order = excluded.sort_order,
      published = excluded.published, updated_at = datetime('now')
  `),
  getById:       db.prepare(`SELECT * FROM categories WHERE id = ?`),
  listAll:       db.prepare(`SELECT * FROM categories ORDER BY sort_order, name_en`),
  listPublished: db.prepare(`SELECT * FROM categories WHERE published = 1 ORDER BY sort_order, name_en`),
  delete:        db.prepare(`DELETE FROM categories WHERE id = ?`),
  count:         db.prepare(`SELECT COUNT(*) AS c FROM categories`),
};
function parseCatRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    name_en: r.name_en,
    name_ar: r.name_ar || '',
    emoji: r.emoji || '🍫',
    sort_order: r.sort_order,
    published: !!r.published,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

// ---------- PRODUCTS ----------
const productStmts = {
  insert: db.prepare(`
    INSERT INTO products (
      id, cat, sub, name, name_ar, price_minor, desc, desc_ar,
      image, emoji, badge, options_json, published, sort_order,
      track_stock, stock, low_stock_at
    ) VALUES (
      @id, @cat, @sub, @name, @name_ar, @price_minor, @desc, @desc_ar,
      @image, @emoji, @badge, @options_json, @published, @sort_order,
      @track_stock, @stock, @low_stock_at
    )
  `),
  upsert: db.prepare(`
    INSERT INTO products (
      id, cat, sub, name, name_ar, price_minor, desc, desc_ar,
      image, emoji, badge, options_json, published, sort_order,
      track_stock, stock, low_stock_at
    ) VALUES (
      @id, @cat, @sub, @name, @name_ar, @price_minor, @desc, @desc_ar,
      @image, @emoji, @badge, @options_json, @published, @sort_order,
      @track_stock, @stock, @low_stock_at
    )
    ON CONFLICT(id) DO UPDATE SET
      cat = excluded.cat, sub = excluded.sub,
      name = excluded.name, name_ar = excluded.name_ar,
      price_minor = excluded.price_minor,
      desc = excluded.desc, desc_ar = excluded.desc_ar,
      image = excluded.image, emoji = excluded.emoji,
      badge = excluded.badge, options_json = excluded.options_json,
      published = excluded.published, sort_order = excluded.sort_order,
      track_stock = excluded.track_stock, stock = excluded.stock,
      low_stock_at = excluded.low_stock_at,
      updated_at = datetime('now')
  `),
  getById:       db.prepare(`SELECT * FROM products WHERE id = ?`),
  listAll:       db.prepare(`SELECT * FROM products ORDER BY sort_order, created_at`),
  listPublished: db.prepare(`SELECT * FROM products WHERE published = 1 ORDER BY sort_order, created_at`),
  delete:        db.prepare(`DELETE FROM products WHERE id = ?`),
  setPublished:  db.prepare(`UPDATE products SET published = ?, updated_at = datetime('now') WHERE id = ?`),
  count:         db.prepare(`SELECT COUNT(*) AS c FROM products`),
  setImage:      db.prepare(`UPDATE products SET image = ?, updated_at = datetime('now') WHERE id = ?`),
  decrementStock: db.prepare(`UPDATE products SET stock = MAX(0, stock - ?), updated_at = datetime('now') WHERE id = ? AND track_stock = 1`),
  setStock:      db.prepare(`UPDATE products SET stock = ?, updated_at = datetime('now') WHERE id = ?`),
  lowStockList:  db.prepare(`SELECT * FROM products WHERE track_stock = 1 AND stock <= low_stock_at ORDER BY stock ASC`),
};

// Helper: parse a product row into a clean shape
function parseProductRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    cat: row.cat,
    sub: row.sub || null,
    name: row.name,
    name_ar: row.name_ar || '',
    price: row.price_minor / 100,           // EGP for the frontend
    price_minor: row.price_minor,           // piastres for backend math
    desc: row.desc || '',
    desc_ar: row.desc_ar || '',
    image: row.image || '',
    emoji: row.emoji || '🍫',
    badge: row.badge || null,
    options: row.options_json ? safeParse(row.options_json) : null,
    published: !!row.published,
    sort_order: row.sort_order,
    track_stock: !!row.track_stock,
    stock: row.stock || 0,
    low_stock_at: row.low_stock_at || 5,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }

// ---------- CUSTOMERS ----------
const custStmts = {
  insert: db.prepare(`
    INSERT INTO customers (email, password_hash, name, phone, verification_token, email_verified)
    VALUES (@email, @password_hash, @name, @phone, @verification_token, @email_verified)
  `),
  getByEmail:        db.prepare(`SELECT * FROM customers WHERE email = ? COLLATE NOCASE`),
  getById:           db.prepare(`SELECT id, email, name, phone, points, created_at, last_login_at, email_verified FROM customers WHERE id = ?`),
  getByIdFull:       db.prepare(`SELECT * FROM customers WHERE id = ?`),
  setPassword:       db.prepare(`UPDATE customers SET password_hash = ?, reset_token = NULL, reset_token_expires_at = NULL WHERE id = ?`),
  setProfile:        db.prepare(`UPDATE customers SET name = ?, phone = ? WHERE id = ?`),
  setLastLogin:      db.prepare(`UPDATE customers SET last_login_at = datetime('now') WHERE id = ?`),
  list:              db.prepare(`SELECT id, email, name, phone, points, created_at, last_login_at, email_verified FROM customers ORDER BY created_at DESC LIMIT ?`),
  count:             db.prepare(`SELECT COUNT(*) AS c FROM customers`),
  getByVerifyToken:  db.prepare(`SELECT * FROM customers WHERE verification_token = ?`),
  markVerified:      db.prepare(`UPDATE customers SET email_verified = 1, verification_token = NULL WHERE id = ?`),
  setVerifyToken:    db.prepare(`UPDATE customers SET verification_token = ? WHERE id = ?`),
  setResetToken:     db.prepare(`UPDATE customers SET reset_token = ?, reset_token_expires_at = ? WHERE id = ?`),
  getByResetToken:   db.prepare(`SELECT * FROM customers WHERE reset_token = ?`),
  delete:            db.prepare(`DELETE FROM customers WHERE id = ?`),
  addPoints:         db.prepare(`UPDATE customers SET points = points + ? WHERE id = ?`),
};

// ---------- STAFF ----------
const staffStmts = {
  insert: db.prepare(`
    INSERT INTO staff (email, password_hash, name, role, invited_by, invite_token, invite_accepted)
    VALUES (@email, @password_hash, @name, @role, @invited_by, @invite_token, @invite_accepted)
  `),
  getByEmail:        db.prepare(`SELECT * FROM staff WHERE email = ? COLLATE NOCASE`),
  getById:           db.prepare(`SELECT id, email, name, role, created_at, last_login_at, invite_accepted FROM staff WHERE id = ?`),
  getByIdFull:       db.prepare(`SELECT * FROM staff WHERE id = ?`),
  setPassword:       db.prepare(`UPDATE staff SET password_hash = ?, reset_token = NULL, reset_token_expires_at = NULL, invite_accepted = 1 WHERE id = ?`),
  setRole:           db.prepare(`UPDATE staff SET role = ? WHERE id = ?`),
  setName:           db.prepare(`UPDATE staff SET name = ? WHERE id = ?`),
  setLastLogin:      db.prepare(`UPDATE staff SET last_login_at = datetime('now') WHERE id = ?`),
  list:              db.prepare(`SELECT id, email, name, role, created_at, last_login_at, invite_accepted FROM staff ORDER BY created_at DESC LIMIT ?`),
  count:             db.prepare(`SELECT COUNT(*) AS c FROM staff`),
  countAdmins:       db.prepare(`SELECT COUNT(*) AS c FROM staff WHERE role = 'admin'`),
  setInviteToken:    db.prepare(`UPDATE staff SET invite_token = ? WHERE id = ?`),
  getByInviteToken:  db.prepare(`SELECT * FROM staff WHERE invite_token = ?`),
  setResetToken:     db.prepare(`UPDATE staff SET reset_token = ?, reset_token_expires_at = ? WHERE id = ?`),
  getByResetToken:   db.prepare(`SELECT * FROM staff WHERE reset_token = ?`),
  delete:            db.prepare(`DELETE FROM staff WHERE id = ?`),
};

// ---------- REVIEWS ----------
const reviewStmts = {
  insert:        db.prepare(`INSERT INTO reviews (product_id, customer_id, rating, title, body, photo, approved) VALUES (@product_id, @customer_id, @rating, @title, @body, @photo, @approved)`),
  listForProduct: db.prepare(`SELECT r.*, c.name AS customer_name FROM reviews r LEFT JOIN customers c ON c.id = r.customer_id WHERE product_id = ? AND approved = 1 ORDER BY created_at DESC`),
  listAll:       db.prepare(`SELECT r.*, c.name AS customer_name FROM reviews r LEFT JOIN customers c ON c.id = r.customer_id ORDER BY created_at DESC LIMIT ?`),
  pending:       db.prepare(`SELECT r.*, c.name AS customer_name FROM reviews r LEFT JOIN customers c ON c.id = r.customer_id WHERE approved = 0 ORDER BY created_at DESC`),
  approve:       db.prepare(`UPDATE reviews SET approved = 1 WHERE id = ?`),
  delete:        db.prepare(`DELETE FROM reviews WHERE id = ?`),
  avgForProduct: db.prepare(`SELECT AVG(rating) AS avg, COUNT(*) AS n FROM reviews WHERE product_id = ? AND approved = 1`),
};

// ---------- DELIVERY SLOTS ----------
const slotStmts = {
  insert:    db.prepare(`INSERT INTO delivery_slots (label, starts_at, capacity, enabled) VALUES (?, ?, ?, ?)`),
  list:      db.prepare(`SELECT * FROM delivery_slots WHERE enabled = 1 AND datetime(starts_at) >= datetime('now') ORDER BY starts_at ASC LIMIT 50`),
  listAll:   db.prepare(`SELECT * FROM delivery_slots ORDER BY starts_at DESC LIMIT 200`),
  getById:   db.prepare(`SELECT * FROM delivery_slots WHERE id = ?`),
  book:      db.prepare(`UPDATE delivery_slots SET booked = booked + 1 WHERE id = ? AND booked < capacity`),
  delete:    db.prepare(`DELETE FROM delivery_slots WHERE id = ?`),
  setEnabled: db.prepare(`UPDATE delivery_slots SET enabled = ? WHERE id = ?`),
};

// ---------- SETTINGS (key-value) ----------
const settingStmts = {
  get:    db.prepare(`SELECT value FROM settings WHERE key = ?`),
  set:    db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`),
  delete: db.prepare(`DELETE FROM settings WHERE key = ?`),
  all:    db.prepare(`SELECT key, value FROM settings`),
};

module.exports = {
  db,
  // ----- orders -----
  insertOrder:           (o) => orderStmts.insert.run(o),
  markPaidBySession:     (s, p) => orderStmts.setStatusBySession.run('paid', p, s),
  markFailedBySession:   (s) => orderStmts.setStatusBySession.run('failed', null, s),
  markCodConfirmed:      (id) => orderStmts.setStatus.run('cod-confirmed', id),
  setOrderStatus:        (id, status) => orderStmts.setStatus.run(status, id),
  getOrder:              (id) => orderStmts.getById.get(id),
  getOrderBySession:     (s) => orderStmts.getBySession.get(s),
  listOrders:            (limit = 200) => orderStmts.list.all(limit),
  listOrdersByUser:      (userId, limit = 100) => orderStmts.listByUser.all(userId, limit),
  // ----- users -----
  insertUser:            (u) => userStmts.insert.run(u),
  getUserByEmail:        (email) => userStmts.getByEmail.get(email),
  getUserById:           (id) => userStmts.getById.get(id),
  getUserByIdFull:       (id) => userStmts.getByIdFull.get(id),
  setUserPassword:       (id, hash) => userStmts.setPassword.run(hash, id),
  setUserRole:           (id, role) => userStmts.setRole.run(role, id),
  setUserProfile:        (id, name, phone) => userStmts.setProfile.run(name, phone, id),
  touchUserLogin:        (id) => userStmts.setLastLogin.run(id),
  listUsers:             (limit = 500) => userStmts.list.all(limit),
  adminCount:            () => userStmts.countAdmins.get().c,
  getUserByVerifyToken:  (t) => userStmts.getByVerifyToken.get(t),
  markUserVerified:      (id) => userStmts.markVerified.run(id),
  setUserVerifyToken:    (id, t) => userStmts.setVerifyToken.run(t, id),
  setUserResetToken:     (id, t, expiresIso) => userStmts.setResetToken.run(t, expiresIso, id),
  getUserByResetToken:   (t) => userStmts.getByResetToken.get(t),
  deleteUser:            (id) => userStmts.delete.run(id),
  // ----- addresses -----
  insertAddress: (a) => {
    if (a.is_default) addrStmts.clearDefault.run(a.user_id);
    return addrStmts.insert.run(a);
  },
  updateAddress: (a) => {
    if (a.is_default) addrStmts.clearDefault.run(a.user_id);
    return addrStmts.update.run(a);
  },
  deleteAddress:    (id, userId) => addrStmts.delete.run(id, userId),
  getAddress:       (id, userId) => addrStmts.getById.get(id, userId),
  listAddresses:    (userId) => addrStmts.listByUser.all(userId),
  setDefaultAddress: (id, userId) => {
    addrStmts.clearDefault.run(userId);
    return addrStmts.setDefault.run(id, userId);
  },
  // ----- categories -----
  insertCategory:           (c) => catStmts.insert.run(c),
  upsertCategory:           (c) => catStmts.upsert.run(c),
  getCategoryById:          (id) => parseCatRow(catStmts.getById.get(id)),
  listCategoriesAll:        () => catStmts.listAll.all().map(parseCatRow),
  listCategoriesPublished:  () => catStmts.listPublished.all().map(parseCatRow),
  deleteCategory:           (id) => catStmts.delete.run(id),
  categoryCount:            () => catStmts.count.get().c,
  // ----- products -----
  insertProduct:         (p) => productStmts.insert.run(p),
  upsertProduct:         (p) => productStmts.upsert.run(p),
  getProductById:        (id) => parseProductRow(productStmts.getById.get(id)),
  listProductsAll:       () => productStmts.listAll.all().map(parseProductRow),
  listProductsPublished: () => productStmts.listPublished.all().map(parseProductRow),
  deleteProduct:         (id) => productStmts.delete.run(id),
  setProductPublished:   (id, pub) => productStmts.setPublished.run(pub ? 1 : 0, id),
  setProductImage:       (id, imagePath) => productStmts.setImage.run(imagePath, id),
  decrementStock:        (id, qty) => productStmts.decrementStock.run(qty, id),
  setProductStock:       (id, stock) => productStmts.setStock.run(stock, id),
  listLowStock:          () => productStmts.lowStockList.all().map(parseProductRow),
  productCount:          () => productStmts.count.get().c,

  // ----- customers (separate auth domain) -----
  insertCustomer:           (c) => custStmts.insert.run(c),
  getCustomerByEmail:       (email) => custStmts.getByEmail.get(email),
  getCustomerById:          (id) => custStmts.getById.get(id),
  getCustomerByIdFull:      (id) => custStmts.getByIdFull.get(id),
  setCustomerPassword:      (id, hash) => custStmts.setPassword.run(hash, id),
  setCustomerProfile:       (id, name, phone) => custStmts.setProfile.run(name, phone, id),
  touchCustomerLogin:       (id) => custStmts.setLastLogin.run(id),
  listCustomers:            (limit = 500) => custStmts.list.all(limit),
  customerCount:            () => custStmts.count.get().c,
  getCustomerByVerifyToken: (t) => custStmts.getByVerifyToken.get(t),
  markCustomerVerified:     (id) => custStmts.markVerified.run(id),
  setCustomerVerifyToken:   (id, t) => custStmts.setVerifyToken.run(t, id),
  setCustomerResetToken:    (id, t, exp) => custStmts.setResetToken.run(t, exp, id),
  getCustomerByResetToken:  (t) => custStmts.getByResetToken.get(t),
  deleteCustomer:           (id) => custStmts.delete.run(id),
  addCustomerPoints:        (id, n) => custStmts.addPoints.run(n, id),

  // ----- staff (separate auth domain) -----
  insertStaff:              (s) => staffStmts.insert.run(s),
  getStaffByEmail:          (email) => staffStmts.getByEmail.get(email),
  getStaffById:             (id) => staffStmts.getById.get(id),
  getStaffByIdFull:         (id) => staffStmts.getByIdFull.get(id),
  setStaffPassword:         (id, hash) => staffStmts.setPassword.run(hash, id),
  setStaffRole:             (id, role) => staffStmts.setRole.run(role, id),
  setStaffName:             (id, name) => staffStmts.setName.run(name, id),
  touchStaffLogin:          (id) => staffStmts.setLastLogin.run(id),
  listStaff:                (limit = 100) => staffStmts.list.all(limit),
  staffCount:               () => staffStmts.count.get().c,
  staffAdminCount:          () => staffStmts.countAdmins.get().c,
  setStaffInviteToken:      (id, t) => staffStmts.setInviteToken.run(t, id),
  getStaffByInviteToken:    (t) => staffStmts.getByInviteToken.get(t),
  setStaffResetToken:       (id, t, exp) => staffStmts.setResetToken.run(t, exp, id),
  getStaffByResetToken:     (t) => staffStmts.getByResetToken.get(t),
  deleteStaff:              (id) => staffStmts.delete.run(id),

  // ----- reviews -----
  insertReview:             (r) => reviewStmts.insert.run(r),
  listReviewsForProduct:    (pid) => reviewStmts.listForProduct.all(pid),
  listReviewsAll:           (limit = 200) => reviewStmts.listAll.all(limit),
  listReviewsPending:       () => reviewStmts.pending.all(),
  approveReview:            (id) => reviewStmts.approve.run(id),
  deleteReview:             (id) => reviewStmts.delete.run(id),
  reviewSummary:            (pid) => reviewStmts.avgForProduct.get(pid),

  // ----- delivery slots -----
  insertSlot:    (label, startsAt, capacity, enabled = 1) => slotStmts.insert.run(label, startsAt, capacity, enabled),
  listSlots:     () => slotStmts.list.all(),
  listAllSlots:  () => slotStmts.listAll.all(),
  getSlot:       (id) => slotStmts.getById.get(id),
  bookSlot:      (id) => slotStmts.book.run(id),
  deleteSlot:    (id) => slotStmts.delete.run(id),
  setSlotEnabled: (id, en) => slotStmts.setEnabled.run(en ? 1 : 0, id),

  // ----- settings -----
  getSetting:    (k, dflt = null) => { const r = settingStmts.get.get(k); return r ? r.value : dflt; },
  setSetting:    (k, v) => settingStmts.set.run(k, v == null ? null : String(v)),
  deleteSetting: (k) => settingStmts.delete.run(k),
  allSettings:   () => Object.fromEntries(settingStmts.all.all().map(r => [r.key, r.value])),
};
