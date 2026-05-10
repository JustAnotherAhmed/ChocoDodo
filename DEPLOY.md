# 🚀 Deploying ChocoDoDo to the internet

Step-by-step guide to take ChocoDoDo from `localhost:4242` to a real domain
that customers anywhere in the world can visit.

**Total time:** ~60 minutes spread over 1–2 days (waiting for DNS).
**Total cost:** ~$70/year ($10 domain + $5/mo hosting).

---

## What you'll have when you're done

- 🌐 `https://yourdomain.com` opens the bakery site for everyone
- 📧 Customer emails come from `hello@yourdomain.com` and **land in inbox, not spam**
- 🔒 Auto-renewing HTTPS (free, courtesy of your host)
- 💾 Persistent SQLite database that survives redeploys

---

## Phase 1 — Buy a domain (5 min)

### Why Cloudflare Registrar?

Cloudflare sells `.com` domains at **wholesale price** ($10.44/year, no markup).
Most other registrars (GoDaddy, Namecheap) add $5–15/year. Cloudflare also gives
you free DNS, free SSL, and free email forwarding — perfect for a bakery.

### Steps

1. Go to **<https://dash.cloudflare.com/sign-up>** → create an account (free).
2. Once logged in, click **Domain Registration** → **Register Domains**.
3. Search for your domain. My recommended order:
   1. **`chocododo.com`** — first choice
   2. **`chocododo.shop`** — great for e-commerce, often cheap year-1
   3. **`chocododo.store`** — another good fallback
   4. **`chocododobakery.com`** — if the short ones are taken
4. Add to cart, complete payment (~$10 for `.com`).
5. Domain is yours immediately — DNS becomes editable within 5 min.

> **Egyptian alternatives** like `.eg` or `.com.eg` cost ~$50/year and require
> Egyptian National ID + business paperwork via TE Data / NTRA. **Skip these
> for now** — `.com` is universal and cheaper.

---

## Phase 2 — Deploy the backend on Railway (15 min)

### Why Railway?

- $5/mo minimum (no truly-free tier, but cheap)
- **Persistent volumes** — your SQLite DB survives redeploys (huge for ChocoDoDo)
- Connects to GitHub for auto-deploy on every push
- Free SSL automatically when you connect a domain
- Egyptian latency is fine via their EU regions (~80–120ms from Cairo)

### Steps

#### A. Push your code to GitHub (if you haven't already)

1. Create a free GitHub account if you don't have one: <https://github.com/signup>
2. Click **New repository** → name it `chocododo` → Private → **Create**
3. From a terminal in your project folder:
   ```bash
   cd "C:\Users\fahme\Downloads\Choco Dodo"
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<yourusername>/chocododo.git
   git push -u origin main
   ```
   The `.gitignore` I added will keep `node_modules`, `.env`, and the local
   SQLite database out of git automatically.

#### B. Sign up for Railway

1. Go to **<https://railway.app>** → **Login with GitHub**
2. **New Project** → **Deploy from GitHub repo** → pick `chocododo`
3. Railway auto-detects Node.js + reads `nixpacks.toml` → starts building
4. First build takes ~2–3 min

#### C. Add a persistent volume for the SQLite database

This is critical — without it, the database resets on every deploy.

1. In your Railway project, click **+ New** → **Volume**
2. **Mount path:** `/data`
3. **Size:** `1 GB` (plenty for years of bakery orders)
4. Attach it to your service

#### D. Set environment variables in Railway

In your Railway service, click **Variables** → **+ Variable** and add:

```env
NODE_ENV=production
PORT=4242
FRONTEND_URL=https://yourdomain.com
COOKIE_DOMAIN=.yourdomain.com
COOKIE_SECURE=true
DATA_DIR=/data

# Currency / pricing (same as dev)
CURRENCY=egp
DELIVERY_MINOR_UNITS=3000
TAX_RATE=0
DEPOSIT_PCT=50

# A FRESH JWT secret — DO NOT reuse the dev one. Use this one I just generated:
JWT_SECRET=fbd61191e981392c6c935553a7b6079d78cb5d84be7f3f3f234a6aee4a673bb8b6f6d3f1b140ceaff0b4a552b24edc27

# A FRESH admin password (do not reuse personal one)
ADMIN_EMAIL=doaafarag239@gmail.com
ADMIN_PASSWORD=<pick a strong random one — see Phase 5>
ADMIN_KEY=<32+ random chars>

# Email (for now, Gmail; you'll switch to Resend in Phase 4)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=Fromchocododo@gmail.com
SMTP_PASS=pswsylgmsrarpvrw
EMAIL_FROM=ChocoDoDo <Fromchocododo@gmail.com>
EMAIL_TO_OWNER=doaafarag239@gmail.com

# Telegram (rotate the bot token — see Phase 5)
TELEGRAM_BOT_TOKEN=<get a fresh one from @BotFather>
TELEGRAM_CHAT_ID=852507427
TELEGRAM_BOT_USERNAME=<your bot username, no @>

# WhatsApp click-to-chat
WHATSAPP_OWNER_NUMBER=201090210256
```

After saving, Railway redeploys automatically.

#### E. Test the bare Railway URL

Railway gives you a URL like `chocododo-production-abcd.up.railway.app`. Open
it — the bakery site should load. The DB is empty until customers sign up.

---

## Phase 3 — Connect your domain to Railway (10 min, then DNS waits)

### A. In Railway

1. Project → **Settings** → **Domains** → **Custom Domain**
2. Enter `yourdomain.com` → Railway gives you a **CNAME target** like
   `chocododo-production-abcd.up.railway.app`
3. Also add the `www.` subdomain → another CNAME target

### B. In Cloudflare

1. Cloudflare dashboard → your domain → **DNS** → **Records**
2. **Add record:**
   - Type: `CNAME`
   - Name: `@` (the apex)
   - Target: the Railway CNAME from step A
   - Proxy: **gray cloud** (DNS-only) — important: orange cloud breaks Railway's SSL
3. Add another CNAME for `www` pointing at the same target
4. Wait 5–30 minutes for DNS propagation
5. Refresh your Railway domain page — should show ✅ green

### C. SSL

Railway auto-issues a Let's Encrypt cert as soon as DNS verifies. You don't
have to do anything. Once green, `https://yourdomain.com` works.

---

## Phase 4 — Email on your domain via Resend (15 min, then DNS waits)

This is what fixes the spam-folder problem. After this, customer emails come
from `hello@yourdomain.com` and land in the inbox.

### A. Add the domain on Resend

1. <https://resend.com> → log in (you already have an account at `sleepingdbs@gmail.com`)
2. **Domains** → **Add Domain** → `yourdomain.com` → **Add**
3. Resend shows you 3 DNS records to add:
   - **TXT** for SPF (e.g. `v=spf1 include:amazonses.com ~all`)
   - **CNAME × 2** for DKIM (e.g. `resend._domainkey...`)
   - **TXT** for DMARC (optional but recommended)

### B. Add those records in Cloudflare DNS

1. Cloudflare → DNS → **Add record** for each one Resend gave you
2. Copy/paste the exact names and values — typos will fail verification
3. Wait 5–30 min, then click **Verify** in Resend → green ticks

### C. Switch ChocoDoDo to Resend

In Railway → Variables → update these three:

```env
SMTP_HOST=smtp.resend.com
SMTP_USER=resend
SMTP_PASS=re_<your-Resend-API-key>
EMAIL_FROM=ChocoDoDo <hello@yourdomain.com>
```

> Get the API key from Resend → API Keys → Create. The previous one
> (`re_igkMEi1R...`) was generated for sandbox testing — make a new one.

Save → Railway redeploys → done. Customer emails now have **DKIM-signed
sender authentication** and will land in the inbox even on first send.

---

## Phase 5 — Rotate dev secrets (10 min, before announcing!)

The dev `.env` was visible in our chat session, which means these values
should be considered compromised before you go live. Rotate them:

| Secret | How to rotate |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Telegram → @BotFather → `/revoke` → pick your bot → it issues a new token. Update Railway env var. |
| `ADMIN_PASSWORD` | Pick a new strong random password. After first login on the live site, **delete the env var entirely** so it's not sitting in the dashboard. |
| `JWT_SECRET` | Use the one I generated above (or run `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`). When changed, all current sessions log out — fine for a fresh deploy. |
| `ADMIN_KEY` | New random 32+ char string. |
| Gmail App Password | Optional — Google Account → App Passwords → revoke the old one, generate a new one. |

---

## Phase 6 — Smoke test the live site (10 min)

Before announcing to anyone:

- [ ] `https://yourdomain.com` loads the bakery
- [ ] Sign up with a real email → verification email lands in **inbox** (not spam)
- [ ] Click the verify link → account active
- [ ] Place a tiny test order ("test order, ignore" in notes, deposit only)
- [ ] You receive a Telegram ping AND an email at `doaafarag239@gmail.com`
- [ ] The customer (you, with the test address) gets the receipt email
- [ ] Try a fake URL like `/nope` → branded 404 page
- [ ] Hard-refresh and check that "ChocoDoDo" reads correctly in Arabic mode
- [ ] Open admin panel at `/pages/admin.html` → log in with new ADMIN_PASSWORD
- [ ] Mark the test order as paid/delivered → customer gets status update email

---

## Phase 7 — After launch

- **Daily backup of the SQLite DB:** SSH into Railway shell and `cp /data/orders.db /data/orders-$(date +%Y%m%d).db` — or set up a cron job. (Volumes are durable but explicit backups protect against accidents.)
- **Monitor your Resend dashboard** for bounce rate; >5% bounces = you're emailing typos a lot, add stricter signup validation.
- **Keep an eye on `doaafarag239@gmail.com`** for the daily order summary — and the Telegram chat for instant pings.

---

## Quick reference — env vars matrix

| Variable | Dev (localhost) | Production (Railway) |
|---|---|---|
| `NODE_ENV` | `development` | `production` |
| `PORT` | `4242` | `4242` (Railway maps externally) |
| `FRONTEND_URL` | `http://localhost:4242` | `https://yourdomain.com` |
| `COOKIE_DOMAIN` | (blank) | `.yourdomain.com` |
| `COOKIE_SECURE` | `false` | `true` |
| `DATA_DIR` | (blank, uses backend/data) | `/data` |
| `JWT_SECRET` | dev secret | NEW random 96-char hex |
| `ADMIN_PASSWORD` | dev one | NEW strong random |
| `SMTP_HOST` | `smtp.gmail.com` (now) | `smtp.resend.com` (after Phase 4) |
| `EMAIL_FROM` | `Fromchocododo@gmail.com` | `hello@yourdomain.com` |

---

Questions? Stuck on a phase? Just ask — I can walk through any step in more detail.
