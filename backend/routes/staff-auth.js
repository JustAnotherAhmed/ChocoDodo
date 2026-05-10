// STAFF auth — separate from customer auth.
// Routes mounted at /api/staff/...

const express = require('express');
const rateLimit = require('express-rate-limit');
const dbApi = require('../lib/db');
const auth = require('../lib/auth');
const notify = require('../lib/notify');

const router = express.Router();

const FRONTEND_URL = () => process.env.FRONTEND_URL || `http://localhost:${process.env.PORT || 4242}`;

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 8,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});

function isValidEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

// POST /api/staff/login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const s = dbApi.getStaffByEmail(email);
    const okHash = s ? s.password_hash : '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalid';
    const valid = await auth.verifyPassword(password, okHash);
    if (!s || !valid) return res.status(401).json({ error: 'Invalid email or password' });
    if (!s.invite_accepted) return res.status(401).json({ error: 'Please accept your invite first (check your inbox)' });

    const token = auth.signStaffSession(s);
    auth.setStaffCookie(res, token);
    dbApi.touchStaffLogin(s.id);
    res.json({ user: { id: s.id, email: s.email, name: s.name, role: s.role } });
  } catch (err) {
    console.error('staff login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/staff/logout
router.post('/logout', (req, res) => {
  auth.clearStaffCookie(res);
  res.json({ ok: true });
});

// GET /api/staff/me
router.get('/me', auth.attachStaff, (req, res) => {
  if (!req.staff) return res.status(401).json({ error: 'Not signed in (staff)' });
  res.json({ user: req.staff });
});

// POST /api/staff/change-password
router.post('/change-password', auth.attachStaff, auth.requireStaff, async (req, res) => {
  try {
    const { current_password, new_password } = req.body || {};
    if (!new_password || new_password.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }
    const full = dbApi.getStaffByIdFull(req.staff.id);
    const ok = await auth.verifyPassword(current_password || '', full.password_hash);
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });
    const hash = await auth.hashPassword(new_password);
    dbApi.setStaffPassword(req.staff.id, hash);
    res.json({ ok: true });
  } catch (err) {
    console.error('staff change-password error:', err);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// POST /api/staff/profile
router.post('/profile', auth.attachStaff, auth.requireStaff, (req, res) => {
  const { name } = req.body || {};
  if (!name || name.trim().length < 2) return res.status(400).json({ error: 'Name required' });
  dbApi.setStaffName(req.staff.id, name.trim());
  res.json({ user: dbApi.getStaffById(req.staff.id) });
});

// ===== Invite acceptance (staff sets their password) =====
// POST /api/staff/accept-invite  { token, name, password }
router.post('/accept-invite', async (req, res) => {
  const { token, name, password } = req.body || {};
  if (!token) return res.status(400).json({ error: 'Token required' });
  if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  const s = dbApi.getStaffByInviteToken(token);
  if (!s) return res.status(400).json({ error: 'Invalid or expired invite link' });
  const hash = await auth.hashPassword(password);
  dbApi.setStaffPassword(s.id, hash);          // also marks invite_accepted=1
  if (name && name.trim().length >= 2) dbApi.setStaffName(s.id, name.trim());
  dbApi.setStaffInviteToken(s.id, null);
  // Sign them in immediately
  const fresh = dbApi.getStaffById(s.id);
  const tok = auth.signStaffSession(fresh);
  auth.setStaffCookie(res, tok);
  res.json({ ok: true, user: fresh });
});

// ===== Password reset for staff =====
router.post('/request-password-reset', async (req, res) => {
  const { email } = req.body || {};
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Valid email required' });
  const s = dbApi.getStaffByEmail(email);
  if (s) {
    const t = auth.randomToken();
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    dbApi.setStaffResetToken(s.id, t, expires);
    try { await notify.notifyStaffReset({ to: s.email, name: s.name, token: t }); }
    catch (err) { console.error('staff reset notify failed:', err.message); }
  }
  res.json({ ok: true });
});

router.post('/reset-password', async (req, res) => {
  const { token, new_password } = req.body || {};
  if (!token) return res.status(400).json({ error: 'Token required' });
  if (!new_password || new_password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  const s = dbApi.getStaffByResetToken(token);
  if (!s) return res.status(400).json({ error: 'Invalid or expired reset link' });
  if (!s.reset_token_expires_at || new Date(s.reset_token_expires_at) < new Date()) {
    return res.status(400).json({ error: 'Reset link expired' });
  }
  const hash = await auth.hashPassword(new_password);
  dbApi.setStaffPassword(s.id, hash);
  res.json({ ok: true });
});

module.exports = router;
