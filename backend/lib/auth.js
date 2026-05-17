// Auth helpers — bcrypt password hashing + JWT cookie sessions.
// Two SEPARATE domains:
//   - "customer" sessions  (cookie: cd_customer)
//   - "staff" sessions     (cookie: cd_staff)
// A compromised customer session can never elevate to staff — the cookies
// are different, the JWT issuers are different, and the DB tables are different.

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const dbApi = require('./db');

const COOKIE_CUSTOMER = 'cd_customer';
const COOKIE_STAFF    = 'cd_staff';
// 90-day "remember me" sessions so customers don't get logged out every time
// they close the tab. Stored as a signed JWT cookie (HttpOnly + Secure in
// prod), so it survives browser restarts but can't be stolen by JS.
const COOKIE_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

function getJwtSecret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) {
    throw new Error('JWT_SECRET is missing or too short. Set a long random string in .env.');
  }
  return s;
}

async function hashPassword(plain) {
  if (!plain || plain.length < 8) throw new Error('Password must be at least 8 characters');
  return bcrypt.hash(plain, 12);
}
async function verifyPassword(plain, hash) {
  if (!plain || !hash) return false;
  return bcrypt.compare(plain, hash);
}

function signCustomerSession(c) {
  return jwt.sign(
    { sub: c.id, kind: 'customer', email: c.email },
    getJwtSecret(), { expiresIn: '90d', audience: 'customer' }
  );
}
function signStaffSession(s) {
  return jwt.sign(
    { sub: s.id, kind: 'staff', role: s.role, email: s.email },
    getJwtSecret(), { expiresIn: '90d', audience: 'staff' }
  );
}

/**
 * Staff/admin shouldn't need a SEPARATE customer account to place an order
 * for themselves. This helper finds or auto-creates a matching customer
 * record (by email) so that signing in as staff ALSO gives them the
 * normal customer experience.
 *
 * The auto-created customer gets a random unguessable password — they can
 * still log in via the staff form, and if they ever want to use the
 * customer-side login form they can do a normal "forgot password" flow.
 */
async function getOrCreateCustomerForStaff(staffRow) {
  if (!staffRow?.email) return null;
  let cust = dbApi.getCustomerByEmail(staffRow.email);
  if (cust) return cust;
  // No matching customer yet — create one mirroring the staff identity.
  const randomPassword = randomToken(24);  // 48 hex chars, unguessable
  const hash = await hashPassword(randomPassword);
  try {
    dbApi.insertCustomer({
      email:               staffRow.email,
      password_hash:       hash,
      name:                staffRow.name || 'Staff',
      phone:               staffRow.phone || '',
      verification_token:  null,
      email_verified:      1,  // staff are trusted by definition
    });
  } catch (err) {
    // Race condition: another request created the customer in parallel.
    // Just re-fetch and continue.
    if (!String(err.message).includes('UNIQUE')) throw err;
  }
  return dbApi.getCustomerByEmail(staffRow.email);
}

function verifySession(token, audience) {
  try { return jwt.verify(token, getJwtSecret(), { audience }); }
  catch { return null; }
}

function _cookieOpts() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    domain: process.env.COOKIE_DOMAIN || undefined,
    path: '/',
    maxAge: COOKIE_MAX_AGE_MS,
  };
}
const setCustomerCookie = (res, t) => res.cookie(COOKIE_CUSTOMER, t, _cookieOpts());
const setStaffCookie    = (res, t) => res.cookie(COOKIE_STAFF, t, _cookieOpts());
const clearCustomerCookie = (res) => res.clearCookie(COOKIE_CUSTOMER, _cookieOpts());
const clearStaffCookie    = (res) => res.clearCookie(COOKIE_STAFF, _cookieOpts());

/** attach req.customer (best effort) */
function attachCustomer(req, _res, next) {
  const t = req.cookies?.[COOKIE_CUSTOMER];
  if (t) {
    const claims = verifySession(t, 'customer');
    if (claims) {
      const c = dbApi.getCustomerById(claims.sub);
      if (c) req.customer = c;
    }
  }
  next();
}
/** attach req.staff (best effort) */
function attachStaff(req, _res, next) {
  const t = req.cookies?.[COOKIE_STAFF];
  if (t) {
    const claims = verifySession(t, 'staff');
    if (claims) {
      const s = dbApi.getStaffById(claims.sub);
      if (s) req.staff = s;
    }
  }
  next();
}
function attachBoth(req, res, next) {
  attachCustomer(req, res, () => attachStaff(req, res, next));
}

function requireCustomer(req, res, next) {
  if (!req.customer) return res.status(401).json({ error: 'Not signed in' });
  next();
}
function requireStaff(req, res, next) {
  if (!req.staff) return res.status(401).json({ error: 'Not signed in (staff)' });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.staff) return res.status(401).json({ error: 'Not signed in (staff)' });
  if (req.staff.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}

/**
 * Seed the initial admin staff member from env vars on first boot.
 * Idempotent. Only creates new — never overwrites password.
 */
async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return null;

  const existing = dbApi.getStaffByEmail(email);
  if (existing) {
    if (existing.role !== 'admin') {
      dbApi.setStaffRole(existing.id, 'admin');
      console.log(`👑 Promoted existing staff to admin: ${email}`);
    }
    return existing;
  }

  if (password === 'change-me-after-first-login') {
    console.log('⚠️  ADMIN_PASSWORD has the placeholder value — refusing to seed.');
    return null;
  }
  const hash = await hashPassword(password);
  dbApi.insertStaff({
    email, password_hash: hash, name: 'Admin',
    role: 'admin', invited_by: null, invite_token: null, invite_accepted: 1,
  });
  console.log(`✅ Seeded admin staff: ${email}`);
  const fresh = dbApi.getStaffByEmail(email);
  // Also ensure a linked customer record exists so the admin can place
  // orders without setting up a second account.
  try { await getOrCreateCustomerForStaff(fresh); } catch {}
  return fresh;
}

module.exports = {
  COOKIE_CUSTOMER, COOKIE_STAFF,
  randomToken,
  hashPassword, verifyPassword,
  signCustomerSession, signStaffSession,
  setCustomerCookie, setStaffCookie,
  clearCustomerCookie, clearStaffCookie,
  attachCustomer, attachStaff, attachBoth,
  requireCustomer, requireStaff, requireAdmin,
  seedAdmin,
  getOrCreateCustomerForStaff,
};
