// TOTP 2FA helpers — Google Authenticator / Authy / 1Password compatible.
// Standard RFC 6238 implementation via the speakeasy library.
//
// Flow:
//   1. setupSecret(name) → { base32, otpauth, qrDataUri }
//      User scans the QR code in their authenticator app.
//   2. verifyToken(base32, code) → true/false
//      User types the 6-digit code from the app to confirm.
//   3. Persist base32 in customers.totp_secret, set totp_enabled = 1.
//   4. Future logins require a valid code each time.

const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

/**
 * Generate a fresh TOTP secret for a customer.
 * @param {string} accountName   The label shown in the authenticator app
 *                               (we use the customer's email).
 * @returns {Promise<{ base32: string, otpauth: string, qrDataUri: string }>}
 */
async function setupSecret(accountName) {
  const secret = speakeasy.generateSecret({
    name: `ChocoDoDo (${accountName})`,
    issuer: 'ChocoDoDo',
    length: 20,
  });
  // qrcode.toDataURL gives back "data:image/png;base64,..." which we can drop
  // straight into an <img src> on the frontend.
  const qrDataUri = await QRCode.toDataURL(secret.otpauth_url, {
    margin: 1, width: 240, color: { dark: '#3E2723', light: '#FFF8E7' },
  });
  return {
    base32: secret.base32,
    otpauth: secret.otpauth_url,
    qrDataUri,
  };
}

/**
 * Verify a 6-digit TOTP code against a stored secret.
 * @param {string} base32   The secret previously generated via setupSecret.
 * @param {string} code     The 6-digit code typed by the user.
 * @returns {boolean}       true if valid (with a 1-window time skew allowance).
 */
function verifyToken(base32, code) {
  if (!base32 || !code) return false;
  const clean = String(code).replace(/\D/g, '').slice(0, 6);
  if (clean.length !== 6) return false;
  return speakeasy.totp.verify({
    secret: base32,
    encoding: 'base32',
    token: clean,
    window: 1,  // allow ±30 sec drift between server and phone clocks
  });
}

module.exports = { setupSecret, verifyToken };
