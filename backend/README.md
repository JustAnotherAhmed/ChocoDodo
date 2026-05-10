# 🍫 ChocoDoDo Backend

Real Stripe payments + SQLite order storage + email notifications + admin order list.

## Quick start

### 1. Install Node.js (if you don't have it)
Get the LTS build from https://nodejs.org (v18 or newer).

### 2. Install dependencies
```bash
cd backend
npm install
```

### 3. Configure
```bash
cp .env.example .env       # macOS / Linux / Git Bash on Windows
# or on Windows PowerShell:
# Copy-Item .env.example .env
```
Edit `.env` and fill in your Stripe keys (see below for how to get them).

### 4. Run it
```bash
npm start
```
You'll see:
```
🍫 ChocoDoDo backend running on http://localhost:4242
   Frontend expected at: http://localhost:8000
   Stripe: ✅ configured
   Admin:  http://localhost:4242/admin/orders?key=YOUR_ADMIN_KEY
```

The backend also serves the frontend, so you can just open
**http://localhost:4242** and the whole site works on a single port.

---

## Get your Stripe keys

1. Sign up at https://stripe.com (free)
2. Go to https://dashboard.stripe.com/test/apikeys
3. Copy:
   - `pk_test_...` → `STRIPE_PUBLISHABLE_KEY`
   - `sk_test_...` → `STRIPE_SECRET_KEY`
4. **Test cards:** https://stripe.com/docs/testing
   - Success: `4242 4242 4242 4242` (any future date, any CVC)
   - Declined: `4000 0000 0000 0002`

When you're ready to take real money, repeat with the **live mode** keys (`pk_live_...`, `sk_live_...`) — but only after activating your Stripe account (they verify your business).

---

## Set up the Stripe webhook (critical!)

The webhook is how Stripe tells your server "this customer paid." Without it, orders stay stuck in `pending`.

### Local development
Install the Stripe CLI: https://stripe.com/docs/stripe-cli
```bash
stripe login
npm run stripe:listen
```
Copy the `whsec_...` it prints into your `.env` as `STRIPE_WEBHOOK_SECRET`.
Restart the server. Done.

### Production
1. Deploy the backend (see below)
2. Go to https://dashboard.stripe.com/webhooks
3. Add endpoint: `https://your-backend-url.com/api/webhook`
4. Select events: `checkout.session.completed`, `checkout.session.expired`
5. Copy the signing secret into `.env` on your server

---

## Email setup (optional)

Without SMTP creds, emails just print to the console — fine for testing.

For real emails, the cheapest reliable options:

### Option A — Gmail (5 min, free)
- Enable 2FA on your Google account
- Create an [App Password](https://myaccount.google.com/apppasswords)
- In `.env`:
  ```
  SMTP_HOST=smtp.gmail.com
  SMTP_PORT=587
  SMTP_USER=youraddress@gmail.com
  SMTP_PASS=your-16-char-app-password
  ```

### Option B — Resend (better deliverability)
- Sign up at https://resend.com (free 3k emails/mo)
- Verify a domain
- In `.env`:
  ```
  SMTP_HOST=smtp.resend.com
  SMTP_PORT=587
  SMTP_USER=resend
  SMTP_PASS=re_YOUR_API_KEY
  ```

Set `EMAIL_TO_OWNER` to the address where you want order alerts.

---

## File layout

```
backend/
├── server.js              ← Express app + routes
├── package.json
├── .env.example           ← copy to .env and fill in
├── .gitignore
├── lib/
│   ├── products.js        ← server-side product catalog (source of truth)
│   ├── pricing.js         ← cart math (subtotal, tax, delivery)
│   ├── db.js              ← SQLite (better-sqlite3)
│   └── email.js           ← nodemailer wrapper
└── data/
    └── orders.db          ← created automatically (don't commit)
```

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET  | `/api/health` | Liveness check |
| GET  | `/api/config` | Public: publishable key, currency, tax rate |
| POST | `/api/checkout` | Create order (Stripe Checkout or COD) |
| POST | `/api/webhook` | Stripe → server (signed) |
| GET  | `/api/order/:id` | Order status lookup |
| GET  | `/admin/orders?key=...` | Admin order list (HTML) |

## Deploy to production

| Host | Why | One-line setup |
|---|---|---|
| **Render.com** | Easiest, free tier, persistent disk for SQLite | Connect repo → "Web Service" → done |
| **Railway** | Same idea, $5 trial credit | `railway up` from this folder |
| **Fly.io** | Cheap globally distributed, more control | `fly launch` from this folder |
| **Vercel / Netlify** | Best for the *frontend*, but SQLite won't work — switch to Postgres (Supabase/Neon) if you go this route |

For all of them: set the same env vars from `.env`, and update Stripe webhook URL.

## Going live checklist

- [ ] Switch to live Stripe keys (`pk_live_`, `sk_live_`)
- [ ] Activate Stripe account (provide business info)
- [ ] Set up live webhook endpoint
- [ ] Use a real email provider (Resend or your SMTP)
- [ ] Set a strong `ADMIN_KEY`
- [ ] Set `NODE_ENV=production`
- [ ] Set `FRONTEND_URL` to your real domain (HTTPS)
- [ ] Add a refund/cancellation policy page
- [ ] Add Privacy Policy + ToS
- [ ] Test with a real ($0.50) live transaction, then refund it

## Troubleshooting

**"Stripe not configured"** — fill in `STRIPE_SECRET_KEY` in `.env`, restart.

**Webhook fails in dev** — make sure `npm run stripe:listen` is running in another terminal AND the `whsec_` it prints is in `.env`.

**Emails not arriving** — check the server console; if you see `[email-stub]` lines, SMTP isn't configured. Otherwise check spam folder, then check SMTP creds.

**CORS error in browser** — set `FRONTEND_URL` in `.env` to whatever URL you're loading the site from (e.g. `http://localhost:8000`).

**Cart is empty when redirected to Stripe** — check the browser console; the frontend probably can't reach `http://localhost:4242`. Update `API_BASE` at the top of `assets/script.js` to match your backend URL.
