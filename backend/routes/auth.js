// CUSTOMER auth routes only.
// Staff auth lives in routes/staff-auth.js (separate cookie, separate table).

const express = require('express');
const rateLimit = require('express-rate-limit');
const dbApi = require('../lib/db');
const auth = require('../lib/auth');
const notify = require('../lib/notify');
const twofactor = require('../lib/twofactor');

// Account-lockout knobs. After this many wrong-password attempts in the
// failed_login_count window, the account is locked for LOCKOUT_MINUTES.
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MINUTES = 30;
function lockedUntilIso() {
  return new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString();
}
function isStillLocked(row) {
  if (!row?.locked_until) return false;
  return new Date(row.locked_until).getTime() > Date.now();
}
function minutesRemaining(row) {
  if (!row?.locked_until) return 0;
  return Math.max(1, Math.ceil((new Date(row.locked_until).getTime() - Date.now()) / 60000));
}

const router = express.Router();

const FRONTEND_URL = () => process.env.FRONTEND_URL || `http://localhost:${process.env.PORT || 4242}`;

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});
const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 5,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many password reset requests. Try again later.' },
});
// New: signup limiter. Stops mass account-creation abuse (someone scripting
// hundreds of throwaway accounts to spam verification emails or fill the DB).
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 5,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many signups from this connection. Try again in an hour.' },
});
const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 8,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many verification attempts. Wait 15 minutes and try again.' },
});

function isValidEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function isValidEgPhone(s) {
  return typeof s === 'string' &&
    /^(\+?20|0)?1[0125]\d{8}$/.test(String(s).replace(/[\s\-()]/g, ''));
}

/** Generates a unique 6-digit verification code (e.g. "428913"). */
function generateVerifyCode() {
  // Up to 5 attempts to avoid (very rare) collision with existing token
  for (let i = 0; i < 5; i++) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    if (!dbApi.getCustomerByVerifyToken(code)) return code;
  }
  // Fallback: timestamp-based
  return String(Date.now() % 1000000).padStart(6, '0');
}

// ----- POST /api/auth/signup (customer) -----
//   Required: name, email, phone (EG mobile), password
//   Email verification: a 6-digit code + magic link is emailed to the customer.
router.post('/signup', signupLimiter, async (req, res) => {
  try {
    const { email, password, name, phone } = req.body || {};
    if (!name || name.trim().length < 2) return res.status(400).json({ error: 'Name required' });
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Valid email required' });
    if (!isValidEgPhone(phone)) return res.status(400).json({ error: 'Valid Egyptian mobile number required (e.g. 01012345678)' });
    if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    if (dbApi.getCustomerByEmail(email)) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const password_hash = await auth.hashPassword(password);
    // Friendly 6-digit code the customer either clicks (via email link) or types in
    const verifyCode = generateVerifyCode();

    const result = dbApi.insertCustomer({
      email: email.trim(),
      password_hash,
      name: name.trim(),
      phone: phone.trim(),
      verification_token: verifyCode,
      email_verified: 0,
    });
    const customer = dbApi.getCustomerById(result.lastInsertRowid);
    const token = auth.signCustomerSession(customer);
    auth.setCustomerCookie(res, token);
    dbApi.touchCustomerLogin(customer.id);

    // Send the verification email immediately. If SMTP isn't configured, this
    // logs to the server console (the link/code is still saved in the DB so the
    // customer can use the verify-account page once email is set up).
    try {
      await notify.notifyVerification({ to: customer.email, name: customer.name, token: verifyCode });
    } catch (err) {
      console.error('signup verify-email send failed:', err.message);
    }

    // Heads-up ping to the OWNER on Telegram so they see new sign-ups in real time
    try {
      const tgBot = require('../lib/telegram-bot');
      if (tgBot.isConfigured()) {
        notify.sendTelegram(
`👤 <b>NEW SIGN-UP</b>
<b>${escapeHtml(customer.name)}</b>
✉️ ${escapeHtml(customer.email)}
📞 ${escapeHtml(customer.phone)}
Verification email sent. Code on file: <code>${verifyCode}</code>`
        ).catch(() => {});
      }
    } catch {}

    res.json({ user: customer, verification_pending: true });
  } catch (err) {
    console.error('signup error:', err);
    res.status(400).json({ error: err.message || 'Signup failed' });
  }
});

function escapeHtml(s = '') {
  return String(s)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

// ----- POST /api/auth/login (customer) -----
//
// Login is now a two-step affair when 2FA is enabled:
//   1. First call: { email, password } → if password OK AND 2fa is on AND no
//      totp_code provided, respond 200 with { requires_2fa: true }. NO cookie.
//   2. Second call: { email, password, totp_code } → verify TOTP, set cookie.
//
// Plus account lockout: after LOCKOUT_THRESHOLD wrong-password attempts the
// account is locked for LOCKOUT_MINUTES. Successful login resets the counter.
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password, totp_code } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const c = dbApi.getCustomerByEmail(email);

    // If the account is locked, refuse before even checking the password —
    // prevents an attacker from learning whether they got the password right.
    if (c && isStillLocked(c)) {
      const mins = minutesRemaining(c);
      return res.status(423).json({
        error: `Account temporarily locked due to too many failed attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`,
        locked: true,
        retry_after_minutes: mins,
      });
    }

    const okHash = c ? c.password_hash : '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalid';
    const validPw = await auth.verifyPassword(password, okHash);

    if (!c || !validPw) {
      // Count this against the lockout, but only if the account actually exists
      // (we don't want to leak whether the email is registered).
      if (c) {
        dbApi.bumpCustomerFailedLogin(c.id);
        const fresh = dbApi.getCustomerByIdFull(c.id);
        if ((fresh.failed_login_count || 0) >= LOCKOUT_THRESHOLD) {
          dbApi.setCustomerLocked(c.id, lockedUntilIso());
        }
      }
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Password is correct. Check 2FA next.
    if (c.totp_enabled && c.totp_secret) {
      if (!totp_code) {
        // First leg of two-step login — frontend should now prompt for the code.
        return res.json({ requires_2fa: true });
      }
      const valid2fa = twofactor.verifyToken(c.totp_secret, totp_code);
      if (!valid2fa) {
        dbApi.bumpCustomerFailedLogin(c.id);
        const fresh = dbApi.getCustomerByIdFull(c.id);
        if ((fresh.failed_login_count || 0) >= LOCKOUT_THRESHOLD) {
          dbApi.setCustomerLocked(c.id, lockedUntilIso());
        }
        return res.status(401).json({ error: 'Invalid 2FA code', requires_2fa: true });
      }
    }

    // All checks passed — clear lockout counter and sign them in.
    dbApi.resetCustomerLockout(c.id);
    const token = auth.signCustomerSession(c);
    auth.setCustomerCookie(res, token);
    dbApi.touchCustomerLogin(c.id);
    res.json({
      user: {
        id: c.id, email: c.email, name: c.name, phone: c.phone,
        points: c.points || 0,
        email_verified: !!c.email_verified,
        totp_enabled: !!c.totp_enabled,
        role: 'customer',
      },
    });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/logout', (req, res) => {
  // Customer logout also clears any linked staff session — same person, one
  // sign-out everywhere. (If the person is staff and wants to keep their
  // admin session, the admin panel has its own logout button.)
  auth.clearCustomerCookie(res);
  auth.clearStaffCookie(res);
  res.json({ ok: true });
});

router.get('/me', auth.attachCustomer, (req, res) => {
  if (!req.customer) return res.status(401).json({ error: 'Not signed in' });
  // Surface the 2FA-enabled flag so the account UI can show the right state
  const full = dbApi.getCustomerByIdFull(req.customer.id);
  res.json({
    user: {
      ...req.customer,
      totp_enabled: !!full?.totp_enabled,
      role: 'customer',
    },
  });
});

// ====================================================================
// 2FA (TOTP) endpoints — Google Authenticator / Authy / 1Password compatible
// ====================================================================

// Start enrolment: generate a fresh secret and return the QR code data URI.
// The secret is staged on the row but totp_enabled stays 0 until the user
// confirms a code via /2fa/enable.
router.post('/2fa/setup', auth.attachCustomer, auth.requireCustomer, async (req, res) => {
  try {
    const full = dbApi.getCustomerByIdFull(req.customer.id);
    if (full.totp_enabled) {
      return res.status(400).json({ error: '2FA is already enabled. Disable it first if you want to re-set up.' });
    }
    const { base32, otpauth, qrDataUri } = await twofactor.setupSecret(full.email);
    dbApi.setCustomerTotpSecret(full.id, base32);
    res.json({
      ok: true,
      // Show the user the secret in case they can't scan the QR (e.g. typing it
      // into a password manager manually). Never persisted on the client.
      secret: base32,
      otpauth_url: otpauth,
      qr_data_uri: qrDataUri,
    });
  } catch (err) {
    console.error('2fa setup error:', err);
    res.status(500).json({ error: '2FA setup failed' });
  }
});

// Confirm enrolment: the user types the first 6-digit code from their app.
router.post('/2fa/enable', auth.attachCustomer, auth.requireCustomer, (req, res) => {
  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: 'Code required' });
  const full = dbApi.getCustomerByIdFull(req.customer.id);
  if (!full.totp_secret) return res.status(400).json({ error: 'Start 2FA setup first.' });
  if (full.totp_enabled)  return res.json({ ok: true, already: true });
  const valid = twofactor.verifyToken(full.totp_secret, code);
  if (!valid) return res.status(400).json({ error: "Code didn't match. Check your authenticator app's time/sync and try again." });
  dbApi.enableCustomerTotp(full.id);
  // Notify the owner so they see new 2FA-protected accounts as they appear.
  try {
    notify.sendTelegram(`🛡️ 2FA enabled by <b>${escapeHtml(full.name)}</b> (${escapeHtml(full.email)})`).catch(() => {});
  } catch {}
  res.json({ ok: true });
});

// Turn 2FA off — needs either the current password OR a current TOTP code.
// (One stops a brute-forcer with the password; the other stops someone who
// stole the cookie but not the password from disabling the second factor.)
router.post('/2fa/disable', auth.attachCustomer, auth.requireCustomer, async (req, res) => {
  const { password, code } = req.body || {};
  if (!password && !code) {
    return res.status(400).json({ error: 'Enter your password or a current 6-digit code to disable 2FA.' });
  }
  const full = dbApi.getCustomerByIdFull(req.customer.id);
  let verified = false;
  if (password) {
    verified = await auth.verifyPassword(password, full.password_hash);
  }
  if (!verified && code && full.totp_secret) {
    verified = twofactor.verifyToken(full.totp_secret, code);
  }
  if (!verified) {
    return res.status(401).json({ error: "Password or code didn't match." });
  }
  dbApi.disableCustomerTotp(full.id);
  res.json({ ok: true });
});

router.post('/change-password', auth.attachCustomer, auth.requireCustomer, async (req, res) => {
  try {
    const { current_password, new_password } = req.body || {};
    if (!new_password || new_password.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }
    const full = dbApi.getCustomerByIdFull(req.customer.id);
    const ok = await auth.verifyPassword(current_password || '', full.password_hash);
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });
    const hash = await auth.hashPassword(new_password);
    dbApi.setCustomerPassword(req.customer.id, hash);
    res.json({ ok: true });
  } catch (err) {
    console.error('change-password error:', err);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

router.post('/profile', auth.attachCustomer, auth.requireCustomer, (req, res) => {
  const { name, phone } = req.body || {};
  if (!name || name.trim().length < 2) return res.status(400).json({ error: 'Name required' });
  dbApi.setCustomerProfile(req.customer.id, name.trim(), phone?.trim() || null);
  res.json({ user: dbApi.getCustomerById(req.customer.id) });
});

router.get('/orders', auth.attachCustomer, auth.requireCustomer, (req, res) => {
  const orders = dbApi.listOrdersByUser(req.customer.id, 50).map(o => ({
    id: o.id,
    created_at: o.created_at,
    status: o.status,
    tracking_status: o.tracking_status,
    total_cents: o.total_cents,
    deposit_cents: o.deposit_cents,
    remaining_cents: o.remaining_cents,
    payment_mode: o.payment_mode,
    currency: o.currency,
    items: JSON.parse(o.items_json),
  }));
  res.json({ orders });
});

// ===== EMAIL VERIFICATION =====
router.post('/verify-email', (req, res) => {
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: 'Token required' });
  const c = dbApi.getCustomerByVerifyToken(token);
  if (!c) return res.status(400).json({ error: 'Invalid or expired verification link' });
  dbApi.markCustomerVerified(c.id);
  res.json({ ok: true, email: c.email });
});

// Returns whether the customer is currently verified (used for polling).
router.get('/verification-status', auth.attachCustomer, auth.requireCustomer, (req, res) => {
  const full = dbApi.getCustomerByIdFull(req.customer.id);
  res.json({ verified: !!full.email_verified });
});

// Customer asks for a fresh verification email. We mint a new 6-digit code,
// store it as the customer's verify_token, and send an email containing both
// the code and a clickable "verify" link.
router.post('/start-verification', verifyLimiter, auth.attachCustomer, auth.requireCustomer, async (req, res) => {
  const full = dbApi.getCustomerByIdFull(req.customer.id);
  if (full.email_verified) return res.json({ ok: true, already: true });

  // Fresh code
  const code = generateVerifyCode();
  dbApi.setCustomerVerifyToken(full.id, code);

  try {
    await notify.notifyVerification({ to: full.email, name: full.name, token: code });
  } catch (err) {
    console.error('verification email send failed:', err.message);
    return res.status(500).json({ error: "We couldn't send the email right now. Please try again in a minute." });
  }

  // Owner heads-up (so you know the customer is mid-verifying)
  try {
    notify.sendTelegram(
`🔔 Verification email re-sent:
${escapeHtml(full.name)} · ${escapeHtml(full.email)} · code <code>${code}</code>`
    ).catch(() => {});
  } catch {}

  res.json({ ok: true, sent_to: full.email });
});

// Customer enters the 6-digit code they received on the verify page.
router.post('/confirm-code', verifyLimiter, auth.attachCustomer, auth.requireCustomer, (req, res) => {
  const { code } = req.body || {};
  if (!code || !/^\d{6}$/.test(String(code).trim())) {
    return res.status(400).json({ error: 'Enter the 6-digit code we sent you' });
  }
  const full = dbApi.getCustomerByIdFull(req.customer.id);
  if (full.email_verified) return res.json({ ok: true, already: true });
  if (String(code).trim() !== String(full.verification_token || '').trim()) {
    return res.status(400).json({ error: "That code doesn't match. Double-check or request a new one." });
  }
  dbApi.markCustomerVerified(full.id);
  // Cheer the owner
  try {
    notify.sendTelegram(`✅ <b>${escapeHtml(full.name)}</b> just verified their account.`).catch(() => {});
  } catch {}
  res.json({ ok: true });
});

// ===== PASSWORD RESET =====
router.post('/request-password-reset', resetLimiter, async (req, res) => {
  const { email } = req.body || {};
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Valid email required' });
  const c = dbApi.getCustomerByEmail(email);
  if (c) {
    const t = auth.randomToken();
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    dbApi.setCustomerResetToken(c.id, t, expires);
    try { await notify.notifyPasswordReset({ to: c.email, name: c.name, token: t }); }
    catch (err) { console.error('reset notify failed:', err.message); }
  }
  res.json({ ok: true });
});

router.post('/reset-password', async (req, res) => {
  const { token, new_password } = req.body || {};
  if (!token) return res.status(400).json({ error: 'Token required' });
  if (!new_password || new_password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  const c = dbApi.getCustomerByResetToken(token);
  if (!c) return res.status(400).json({ error: 'Invalid or expired reset link' });
  if (!c.reset_token_expires_at || new Date(c.reset_token_expires_at) < new Date()) {
    return res.status(400).json({ error: 'Reset link expired. Request a new one.' });
  }
  const hash = await auth.hashPassword(new_password);
  dbApi.setCustomerPassword(c.id, hash);
  res.json({ ok: true });
});

// ===== ADDRESS BOOK =====
router.get('/addresses', auth.attachCustomer, auth.requireCustomer, (req, res) => {
  res.json({ addresses: dbApi.listAddresses(req.customer.id) });
});

function validAddress(a) {
  if (!a.line1 || a.line1.trim().length < 4) return 'Address (line 1) is required';
  if (a.phone && !/^(?:\+?20|0)?1[0125]\d{8}$/.test(String(a.phone).replace(/\s|-/g, ''))) {
    return 'Phone must be a valid Egyptian mobile number';
  }
  return null;
}

router.post('/addresses', auth.attachCustomer, auth.requireCustomer, (req, res) => {
  const a = req.body || {};
  const err = validAddress(a);
  if (err) return res.status(400).json({ error: err });
  const result = dbApi.insertAddress({
    user_id: req.customer.id,
    label: (a.label || '').trim() || 'Home',
    full_name: (a.full_name || '').trim() || null,
    phone: (a.phone || '').trim() || null,
    line1: a.line1.trim(),
    city: (a.city || '').trim() || null,
    notes: (a.notes || '').trim() || null,
    is_default: a.is_default ? 1 : 0,
  });
  res.json({ address: dbApi.getAddress(result.lastInsertRowid, req.customer.id) });
});

router.put('/addresses/:id', auth.attachCustomer, auth.requireCustomer, (req, res) => {
  const id = Number(req.params.id);
  const existing = dbApi.getAddress(id, req.customer.id);
  if (!existing) return res.status(404).json({ error: 'Address not found' });
  const a = req.body || {};
  const err = validAddress(a);
  if (err) return res.status(400).json({ error: err });
  dbApi.updateAddress({
    id, user_id: req.customer.id,
    label: (a.label || '').trim() || 'Home',
    full_name: (a.full_name || '').trim() || null,
    phone: (a.phone || '').trim() || null,
    line1: a.line1.trim(),
    city: (a.city || '').trim() || null,
    notes: (a.notes || '').trim() || null,
    is_default: a.is_default ? 1 : 0,
  });
  res.json({ address: dbApi.getAddress(id, req.customer.id) });
});

router.delete('/addresses/:id', auth.attachCustomer, auth.requireCustomer, (req, res) => {
  const id = Number(req.params.id);
  const result = dbApi.deleteAddress(id, req.customer.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Address not found' });
  res.json({ ok: true });
});

router.post('/addresses/:id/default', auth.attachCustomer, auth.requireCustomer, (req, res) => {
  const id = Number(req.params.id);
  const existing = dbApi.getAddress(id, req.customer.id);
  if (!existing) return res.status(404).json({ error: 'Address not found' });
  dbApi.setDefaultAddress(id, req.customer.id);
  res.json({ address: dbApi.getAddress(id, req.customer.id) });
});

module.exports = router;
