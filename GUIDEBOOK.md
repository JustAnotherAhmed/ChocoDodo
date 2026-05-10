# 🍫 ChocoDoDo — Launch & Operations Guidebook

*From our kitchen to the internet — a complete handbook to take your bakery online.*

---

## 🆕 Latest: image uploads + stock + email verify + password reset + EN↔AR toggle

The five biggest "complete production storefront" pieces just dropped in:

### 📷 Image upload (real file handling)
- In the admin panel → Products → Edit/Add → click **📷 Upload image** → pick a JPG/PNG/WebP/GIF (max 5 MB)
- The file is uploaded via **multer** to `/api/admin/upload/image`, saved to `assets/images/products/<product-id>-<timestamp>.<ext>`, and the path is auto-filled into the product's image field
- Live preview shows the uploaded image immediately
- You can still paste a path manually if you prefer
- Server validates mime type + size; only admins can upload (gated by `requireAdmin` middleware)

### 📦 Inventory tracking
- Each product has 3 new fields: **Track stock** (yes/no), **Stock** (units left), **Low-stock threshold** (default 5)
- Customer side:
  - "Only X left!" gold pulsing badge when stock ≤ threshold
  - "Out of stock" red badge + greyed-out card + disabled `+` button when stock = 0
  - Server re-validates on checkout (can't bypass via dev tools)
- Admin side:
  - **Low-stock widget** on the dashboard listing all items at/below threshold
  - Stock pill in the products table (green / orange / red)
  - Stock auto-decrements when an order is **paid** (Stripe webhook) or **COD-confirmed**
- For unlimited items, leave "Track stock" off — backwards compatible

### 📧 Email verification
- New users get an automatic verification email with a tokenized link
- `pages/verify-email.html` validates the token and marks the user verified
- Account page shows a "verify your email" banner for unverified users with a "Resend email" button
- Doesn't block ordering — just shows the prompt (better conversion)

### 🔐 Password reset flow
- `pages/login.html` → "Forgot your password?" → `pages/forgot-password.html`
- Enter email → server sends reset link (1-hour expiry, 5/hour rate-limited)
- Always responds OK (don't leak whether the email exists)
- Click link → `pages/reset-password.html` → enter new password → done
- Token is invalidated after use

### 🌐 EN ↔ AR language toggle
- Floating language pill in the navbar on every page (says "العربية" in EN mode, "English" in AR mode)
- Click to flip:
  - Sets `<html dir="rtl" lang="ar">` — page direction flips
  - Cart drawer slides from the LEFT in Arabic
  - Mobile menu slides from the left in Arabic
  - Tajawal font kicks in for Arabic body text (Fredoka stays for the brand)
  - Translation dictionary in `assets/i18n.js` covers nav, hero, sections, buttons, footer
  - Choice persists in localStorage
- Product names/descriptions remain bilingual on every card regardless of toggle

---

## 🆕 Earlier additions: accounts + admin panel + option picker

You now have a **full-featured online bakery**:

### 👤 Customer accounts
- **Sign up:** `/pages/signup.html` — name, email, phone, password (≥8 chars)
- **Sign in:** `/pages/login.html` — rate-limited (10 attempts / 15 min / IP)
- **My account:** `/pages/account.html` — edit profile, change password, view order history
- Sessions are HTTP-only JWT cookies (30-day, signed with `JWT_SECRET`)
- Passwords hashed with **bcryptjs** (12 rounds) — never stored in plaintext
- Guest checkout still works — accounts are optional, never forced

### 🛠 Admin panel — `/pages/admin.html`
A full developer/owner tool, accessible only to users with role `admin`:

| Tab | What you can do |
|---|---|
| 📊 **Dashboard** | Revenue total, orders today/total, paid/pending counts, recent orders, quick status changes |
| 🍫 **Products** | Add / edit / delete products. Toggle published vs draft (drafts hidden from customers). Edit JSON option groups inline. |
| 🛒 **Orders** | Every order, change status (pending → preparing → out-for-delivery → delivered, etc.) |
| 👥 **Users** | List of registered customers, promote to admin / demote (with safety: can't demote the last admin) |
| ⚙️ **Settings** | View server config (currency, delivery fee, tax, Stripe / SMTP status), quick links |

### 🎯 Option picker (no more "type your filling in notes")
- Click `+` on **stuffed chocolate** → modal pops up with all 10 fillings as clickable bubbles (English + Arabic, big touch targets, keyboard-accessible)
- Required options block "Add to cart" until selected
- Cart shows the selected filling per line item — and yes, you can have **two stuffed chocolates with different fillings** as separate cart lines
- Backend re-validates options on every checkout — customers can't game it via dev tools

### 🔐 Your admin account is auto-seeded
On first server boot, the credentials you provided are used to create the admin user with bcrypt-hashed password storage:

- **Email:** F.ahmed30@yahoo.com
- **Role:** `admin`
- **Password:** the one you sent (hashed at 12 bcrypt rounds; plaintext is **never** stored anywhere)

**Security recommendations (please read):**
1. Log in at `/pages/login.html` (or via "Sign in" in the navbar)
2. Go to "My account" → **change your password immediately** (the chat password should be considered exposed)
3. Once changed, **delete `ADMIN_PASSWORD` from `.env`** — it's no longer needed
4. **Generate a long random `JWT_SECRET`**: run `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` and paste into `.env`
5. In production, set `COOKIE_SECURE=true` and run behind HTTPS

---

## 🆕 What got added (earlier)

You now have **everything** you need to take real orders and real money:

- 🎨 **6 cartoon SVG illustrations** (one per product category) — automatic placeholders for every product until your photos arrive
- 🖼 **Upgraded logo placeholder** — chef-girl badge that closely resembles your real logo
- 🛒 **Full Node.js backend** in `backend/` — Stripe Checkout, SQLite database, email notifications, admin panel
- 💳 **Real Stripe integration** — the checkout button now calls a real API and redirects to Stripe-hosted Checkout
- 💵 **Cash on Delivery** — works without Stripe, useful for local-first markets
- 📊 **Admin dashboard** at `http://localhost:4242/admin/orders?key=YOUR_KEY` — see every order, status, customer

### 👉 Where to drop YOUR images

| Image you uploaded | Save it as | Where it appears |
|---|---|---|
| 🎀 The tighter logo crop (square-ish badge with chef girl) | `assets/images/logo.png` | Navbar, footer, hero, every page |
| 🎀 The wider banner (logo on cream paper with donuts/pearls/sprinkles) | `assets/images/hero-bg.jpg` | Hero section background (subtle, behind content) |
| 🍩 Real product photos (when you take them) | `assets/images/products/<filename>.jpg` (filenames in `assets/script.js`) | Product cards & cart |

If any image is missing, the site **automatically** falls back to:
1. The matching cartoon SVG (e.g., `donut.svg`)
2. Then the emoji
So nothing ever looks broken. **You can ship before you have any photos at all.**

### 🚀 First time running the backend (10 minutes)

```bash
# 1. Install Node.js v18+ from https://nodejs.org
# 2. Then:
cd backend
npm install
cp .env.example .env       # or "Copy-Item .env.example .env" on PowerShell
# 3. Edit .env — add your Stripe TEST keys from https://dashboard.stripe.com/test/apikeys
npm start

# 4. In another terminal, forward Stripe webhooks to your local server:
npm run stripe:listen      # requires Stripe CLI
# Copy the whsec_... it prints into .env, then restart npm start

# 5. Open http://localhost:4242 — you're live!
```

Test card: **`4242 4242 4242 4242`** (any future date, any CVC).

After a test purchase, watch:
- Your terminal log (you'll see `✅ Order paid: CD-XXX`)
- The admin page: `http://localhost:4242/admin/orders?key=YOUR_ADMIN_KEY`
- Your email (or the console, if SMTP isn't configured)

Full details: see [backend/README.md](backend/README.md)

---

## Table of Contents
1. [What you have right now](#1-what-you-have-right-now)
2. [Quick start (run it locally in 60 seconds)](#2-quick-start)
3. [Adding your real photos](#3-adding-your-real-photos)
4. [Customising the website](#4-customising-the-website)
5. [Buying a domain name](#5-buying-a-domain-name)
6. [Hosting the website (3 paths)](#6-hosting-the-website)
7. [Payment gateways — making real money](#7-payment-gateways)
8. [Connecting a real backend (orders + emails)](#8-connecting-a-real-backend)
9. [Photographing your products](#9-photographing-your-products)
10. [Image style: cartoonish / pixel / retro](#10-image-style)
11. [Legal & business essentials](#11-legal--business-essentials)
12. [Marketing playbook (Day 0 → Day 90)](#12-marketing-playbook)
13. [Pricing & profit math](#13-pricing--profit)
14. [Roadmap (v1 → v3)](#14-roadmap)
15. [Things I need from you](#15-things-i-need-from-you)
16. [Suggestions to make it the best](#16-suggestions)

---

## 1. What you have right now

A complete **frontend website** with:

| File | What it does |
|---|---|
| `index.html` | Animated landing page (hero, about, featured products, testimonials, contact) |
| `menu.html` | Full menu with category filters and "add to cart" |
| `pages/checkout.html` | Multi-step checkout form with payment-method selector |
| `pages/confirmation.html` | Thank-you page with order ID |
| `assets/styles.css` | All the design — colors, animations, responsive layout |
| `assets/script.js` | Cart logic, product catalog, animations, forms |

**It works today** — open `index.html` in a browser and click around. The cart saves to your browser (localStorage) and survives reloads.

**What it doesn't do yet (we'll fix all of these in this guide):**
- Real payments — the card form is a placeholder
- Send emails on orders — needs a backend
- Sync orders across devices — currently per-browser
- Product photos — using emoji fallbacks until you upload yours

---

## 2. Quick start

### Try it locally
```bash
# Easiest — just double-click index.html.
# Or run a tiny local server (better, fixes some browser quirks):

# Python (already on most computers)
cd "C:\Users\fahme\Downloads\Choco Dodo"
python -m http.server 8000
# Open http://localhost:8000
```

### Or with Node.js
```bash
npx serve .
```

---

## 3. Adding your real photos

### The logo
Save your logo (the chef-girl image you sent me) here:
```
assets/images/logo.png
```
That's it — the navbar, footer, hero, and all pages will pick it up automatically.

### Product photos
Each product in `assets/script.js` has an `image` field pointing to:
```
assets/images/products/<filename>.jpg
```

**To add yours:**
1. Take or generate a photo of the product
2. Resize to **800×600px** (or 1200×900px for higher quality)
3. Save as `.jpg` (or `.webp` for smaller files) in `assets/images/products/`
4. Match the filename in `script.js` (e.g., `dark-truffle.jpg`)

If a photo is missing, the site **automatically falls back to a cute emoji** so it never looks broken.

### Currently used filenames (so you know what to upload):
```
dark-truffle.jpg, milk-bar.jpg, pralines.jpg, white-bonbons.jpg,
glazed.jpg, choco-sprinkle.jpg, strawberry.jpg, dozen.jpg,
lava.jpg, red-velvet.jpg, birthday.jpg, tiramisu.jpg,
macaron-box.jpg, pistachio.jpg, raspberry.jpg, rose.jpg,
choc-chip.jpg, oatmeal.jpg, cookie-dozen.jpg,
croissant.jpg, pain-choc.jpg, cinnamon.jpg
```

---

## 4. Customising the website

### Change the colors
Open `assets/styles.css` and edit the `:root` block at the top:
```css
:root {
  --choc-deep:    #3E2723;   /* darkest brown */
  --choc:         #6B4423;   /* main brown */
  --pink:         #F5B7B1;   /* accent pink */
  --berry:        #C2185B;   /* call-to-action */
  --gold:         #D4AF37;   /* highlights */
  ...
}
```
Change a hex value, save, refresh — done.

### Change the products / prices / descriptions
Open `assets/script.js`. Find the `PRODUCTS` array near the top. Each product looks like:
```js
{ id: 'c1', name: 'Dark Truffle Box', cat: 'chocolate', price: 24.00,
  emoji: '🍫', image: 'assets/images/products/dark-truffle.jpg',
  desc: 'Hand-rolled dark chocolate truffles, 12 pieces',
  badge: 'hot' }
```
- `id` — must be unique
- `cat` — one of: `chocolate`, `donuts`, `cakes`, `macarons`, `cookies`, `pastries`
- `badge` — `'hot'`, `'new'`, or remove the field for no badge

Add as many as you want.

### Change the contact info
In `index.html`, search for `contact` and edit phone/email/address.

### Change the about copy
In `index.html`, search for `<section id="about"` — edit any text inside.

---

## 5. Buying a domain name

### Recommended registrars
1. **Namecheap** — cheapest, clean UI (~$8–12/year for `.com`)
2. **Porkbun** — also cheap, great support
3. **Cloudflare Registrar** — at-cost (no markup) but requires DNS via Cloudflare

### Picking a name
Try these (check availability):
- `chocododo.com` ← first choice
- `chocododo.shop`
- `chocododo.bakery`
- `chocododo.co`
- `getchocododo.com`
- `eatchocododo.com`

**Pro tip:** Buy `.com` + your local TLD (e.g., `.co.uk`, `.in`, `.ae`) so no one can squat on it.

### After buying
You'll point your domain at your hosting provider via **DNS records** (the host gives you a CNAME or A record to paste in). The host's docs walk you through it — it's literally a copy-paste, takes 5 minutes.

---

## 6. Hosting the website

You have **three good options**, ordered easiest → most flexible:

### Option A — Netlify or Vercel (recommended for v1) ⭐
**Why:** Free tier, instant HTTPS, drag-and-drop deploy, automatic deploys from GitHub.

**Steps:**
1. Sign up at https://netlify.com (or vercel.com)
2. Drag the entire `Choco Dodo` folder into the dashboard
3. Done — live at `something-random.netlify.app`
4. Add your domain in **Domain Settings** → it gives you DNS records to paste at Namecheap

**Cost:** $0/month for what you'll need on day one.

### Option B — Cloudflare Pages
Same idea as Netlify, free tier, slightly more technical but extremely fast and unlimited bandwidth.

### Option C — Traditional hosting (cPanel/Bluehost/Hostinger)
Buy a hosting plan, upload via FTP. **Only pick this if** you also want WordPress/PHP later. For a static site like this, Netlify is better.

### When you outgrow static hosting
Once you add a real backend (next section), you'll need:
- **Vercel / Netlify Functions** — keep using the same host, add serverless functions
- **Railway / Render** — full Node/Python backends, $5–10/month
- **AWS / GCP** — overkill until you're huge

---

## 7. Payment gateways

The current site has a checkout form but **no real payments**. Here's how to add them.

### 🥇 Stripe (the gold standard)
- Sign up at https://stripe.com
- Use **Stripe Payment Links** for the simplest setup (no code) — generate a link per product
- Or use **Stripe Checkout** (one redirect, secure, all cards + Apple Pay + Google Pay)
- Or **Stripe Elements** to embed card fields right inside the checkout form (current UI)

**Fees:** ~2.9% + 30¢ per transaction. Best support, cleanest API.

### 🥈 PayPal Checkout
- Sign up at https://developer.paypal.com
- Drop in their button — works for PayPal balance + cards
- Many older customers prefer it

### 🥉 Local options (depends on your country)
- **PayMob, Paystack, Razorpay, Stripe regional, Tap, MyFatoorah** — pick whatever's strong in your country, especially for COD reconciliation.

### How to wire Stripe Checkout (10-minute version)

In `pages/checkout.html`, replace the form's submit handler. Add this at the bottom:
```html
<script src="https://js.stripe.com/v3/"></script>
<script>
const stripe = Stripe('pk_test_YOUR_PUBLISHABLE_KEY');
document.getElementById('checkoutForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  // Call your backend to create a Stripe Checkout session
  const res = await fetch('/api/create-checkout-session', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ items: JSON.parse(localStorage.getItem('chocododo_cart')) })
  });
  const { id } = await res.json();
  stripe.redirectToCheckout({ sessionId: id });
});
</script>
```

Then create a tiny serverless function (Netlify, Vercel, or Cloudflare Workers) that calls `stripe.checkout.sessions.create(...)`. **Stripe's docs have a copy-paste example for every host.** Tell me which host you pick and I'll write the function for you.

### Cash on Delivery (COD)
The simplest payment method — already in the UI. The order goes in, you bake it, deliver, collect cash. Lower conversion friction in many markets.

---

## 8. Connecting a real backend

Right now orders are saved to `localStorage` (the customer's browser). That works for a demo, but for a real business you need:

### Minimum viable backend
1. **A database** to store orders (SQLite, Postgres, or even Google Sheets)
2. **An API endpoint** to receive orders from the website
3. **An email/SMS hook** to notify you and the customer

### Easiest path (no-code-ish)
- **Formspree / Web3Forms** — replace the contact form's `action` with their endpoint, you get emails. ~Free tier.
- **Google Sheets via a webhook** — orders land in a spreadsheet you already know.
- **Airtable + Zapier** — orders → Airtable → email + WhatsApp + Notion task.

### My recommended stack for ChocoDoDo v2
| Layer | Tool | Why |
|---|---|---|
| Hosting | Vercel | Free, fast, integrated functions |
| Backend | Vercel Serverless Functions (Node.js) | One repo, no separate server |
| Database | Supabase or PlanetScale (free tier) | Postgres + auth + storage out of the box |
| Payments | Stripe | Best DX |
| Email | Resend (https://resend.com) | 3,000 emails/mo free, beautiful templates |
| SMS (optional) | Twilio | For "your order is on the way" |
| Admin | Just SQL / Supabase dashboard at first | Don't over-engineer |

### When you're ready to upgrade
Reply with "wire up Stripe" or "build the backend" and I'll add the actual code.

---

## 9. Photographing your products

### The 80/20 of food photography
- **Natural light is everything** — shoot near a window, midday, indirect light. No flash.
- **One product per shot** + 1 group/hero shot for variety
- **Same background for the whole catalog** — gives the menu page that "premium brand" feel. Use one of:
  - White marble (a tile from a hardware store, $10)
  - Cream linen / muslin
  - Light wood
- **Shoot from 3 angles per product:** straight-on, 45°, and overhead
- **Phone is fine.** A modern iPhone or Android beats most amateur cameras.

### Free editing apps
- **Snapseed** (Google) — exposure, white balance, crop. 5 minutes per photo.
- **Lightroom Mobile** (Adobe) — free tier, great presets
- **Remove.bg** — clean white-background cutouts

### Quick recipe (do this for every shot)
1. Bump exposure +0.3
2. Lift shadows
3. Whites +10
4. Saturation +5 (don't over-do it — food should look real)
5. Crop tight, 4:3 ratio
6. Export as JPG, 1200px wide, ~80% quality (under 200KB ideal)

---

## 10. Image style: cartoonish / pixel / retro

You mentioned wanting playful styles for the product images. Here's the smart play.

### Recommendation: keep real food photos as primary, use stylized art as accents
- **Real photos sell food.** Customers want to see what they'll get.
- **Stylized illustrations** are perfect for:
  - Hero banners
  - Category icons
  - Marketing posts
  - Loading animations
  - Empty states ("your cart is empty…")

### Tools to generate stylized art
1. **Midjourney** (~$10/mo) — best for the cartoon/painterly style your logo already uses. Prompt: `cute cartoon donut, pink frosting, big sparkly eyes, sticker style, white background --style raw`
2. **DALL·E 3** (in ChatGPT Plus) — also great, easier prompts
3. **Adobe Firefly** — free credits, integrates with Photoshop
4. **Pixaki / Aseprite** — for true pixel art

### Style guide for ChocoDoDo
Pick ONE primary style and stick to it:
- ✅ **"Cute cartoon sticker"** — matches your logo perfectly. Round, soft shading, bold outlines.
- ✅ **"Watercolor pastel"** — dreamier, more upscale
- ❌ Avoid mixing — looks chaotic

When you generate art, ask for: *"matching the ChocoDoDo logo style — chocolate brown, blush pink, mint, gold, cream palette, soft cartoon shading, white background"*

---

## 11. Legal & business essentials

This is the boring but **critical** stuff. I am **not a lawyer**, so verify with a local one — but here's the typical checklist:

### Before you sell anything
- [ ] **Register the business** (sole proprietorship, LLC, etc. — depends on country)
- [ ] **Food handling license / health permit** — every country has one. Search "[your city] cottage food law" or "home bakery permit"
- [ ] **Allergens disclosure** — list ingredients & common allergens (gluten, dairy, nuts, soy, eggs) on each product
- [ ] **Tax ID / VAT registration** — for invoicing
- [ ] **Business bank account** — keep personal and business money separate from day 1
- [ ] **Insurance** — at minimum public liability + product liability (~$300/yr)

### On the website
- [ ] **Privacy Policy** — required if you collect emails, especially in EU/UK (GDPR), California (CCPA)
- [ ] **Terms of Service**
- [ ] **Cookie banner** if you add analytics
- [ ] **Refund/cancellation policy** — customers will ask
- [ ] **Shipping/delivery policy** — areas, fees, times

Free policy generators: https://termly.io, https://www.privacypolicies.com

### Trademark
Once you have traction, trademark "ChocoDoDo" in your country. Stops copycats. ~$250–500.

---

## 12. Marketing playbook

### Day 0 — before launch
- Reserve handles: `@chocododo` on Instagram, TikTok, Facebook (do this even if you don't post yet)
- Buy the domain
- Create a Google Business Profile (free, huge for local searches)
- Set up a free WhatsApp Business account for orders/inquiries

### Week 1 — soft launch
- Tell friends & family — get the first 10 orders. Ask for honest feedback + a photo testimonial.
- Post 3 Instagram reels of you making a product (behind-the-scenes wins)
- Add testimonials to the website (replace the placeholder ones)

### Weeks 2–4 — local push
- Offer 10% off first order (already in the newsletter form ✓)
- Drop free samples at 2–3 local cafes / coworking spaces / offices
- Partner with a local micro-influencer (1k–10k followers, food niche, your city) — DM, offer free product for an honest post
- Run a small Instagram ad: $5/day for 7 days targeting your city + interest in "bakery, dessert"

### Month 2–3 — scale what works
- Email your list weekly (Sunday "what's fresh this week")
- Add a loyalty system: 10th donut free
- Custom orders for birthdays / weddings — highest margin product
- Open a corporate gifting line (5 boxes minimum, B2B has way better margins)

### Content ideas (steal these)
- 🎥 "Watch us hand-roll 100 truffles in 60 seconds"
- 🎥 "Customer wrote in saying our donuts are the best in [city]" (screen-cap + thank you)
- 📸 "New flavor drop — guess the name"
- 🤳 Reply to comments on camera (TikTok loves this)

---

## 13. Pricing & profit

### Bakery margin rule of thumb
- **Ingredients:** 20–30% of price
- **Labor + overhead:** 30–40%
- **Profit:** 30–40%

### The ChocoDoDo pricing formula
```
ingredients × 4 = retail price
```
If a donut costs you $0.50 in ingredients, sell at $2 retail. That's the floor — your real number depends on positioning.

### Premium pricing tells a story
Don't be the cheapest. "Handmade with imported Belgian chocolate" justifies $24 for 12 truffles. Your logo, packaging, and website (✨ the one you just built ✨) earn that markup.

### Bundle relentlessly
- "Half dozen mixed donuts" → higher AOV than singles
- "Birthday box: cake + 6 macarons + card" → premium SKU, easy gift
- "Subscribe & save 10%" → recurring revenue

---

## 14. Roadmap

### v1 — what you have now (ship this week)
- [x] Animated landing page
- [x] Menu with cart
- [x] Checkout flow
- [x] Order confirmation
- [ ] Real product photos (you)
- [ ] Real contact info & address (you)
- [ ] Hosted on Netlify with custom domain (1 hour)

### v2 — turn it into a real shop (next 2–4 weeks)
- [ ] Stripe Checkout integration
- [ ] Email confirmations to customer + you (Resend or Formspree)
- [ ] Admin order list (Supabase dashboard)
- [ ] Google Analytics + Meta Pixel
- [ ] Privacy policy + ToS pages

### v3 — scale (month 2–3)
- [ ] Customer accounts / order history
- [ ] Subscription products ("Donut of the month")
- [ ] Reviews/ratings on product pages
- [ ] Discount codes & gift cards
- [ ] WhatsApp order updates
- [ ] Multi-currency / multi-language if you ship abroad

---

## 15. Things I need from you

To make this fully yours, send me / save these:

| What | Where | Priority |
|---|---|---|
| Logo file as PNG | `assets/images/logo.png` | 🔴 high |
| 6–10 product photos to start | `assets/images/products/` | 🟡 medium |
| Real address, phone, email | edit `index.html` | 🔴 high |
| Real Instagram / FB / TikTok links | edit `index.html` (`.social-links`) | 🟢 low |
| Country (so I can recommend the right payment gateway) | tell me | 🔴 high |
| Domain name you want | tell me | 🔴 high |

---

## 16. Suggestions

Things I'd add to make ChocoDoDo stand out from every other bakery website:

### 🎨 Brand polish
- **Custom illustrated 404 page** — a sad donut saying "we couldn't find that"
- **Animated favicon** (the chef girl winking)
- **Custom cursor** on hero (a tiny chocolate drop) — playful but doesn't hurt usability

### 💝 Customer love
- **"Build your own box"** — drag-and-drop 6 items into a box, see it come together
- **Gift mode** — recipient name on packaging, scheduled delivery, hidden price
- **A handwritten thank-you card in every order** (analog wins)

### 🚀 Growth hacks
- **"Sweeten a stranger's day"** — pay for a delivery to a random subscriber, +10% off your next
- **Referral codes** — every customer gets a unique code, both sides get $5 off
- **Birthday club** — sign up, free donut on your birthday → gets emails AND in-store traffic

### 🛠 Smart tech
- **PWA** (installable web app) — your customers tap "add to home screen" and you have a free app
- **WhatsApp Business API** — automatic "your order is being baked!" messages
- **Stripe Tax** — auto-calc tax for any country, you don't think about it

### 📦 Operational
- **Daily order cutoff banner** — "Order before 12pm for same-day delivery" (raises urgency, manages expectations)
- **Stock toggle per product** — sold out donuts grey out, stop chasing items you can't make
- **Print-friendly order ticket page** for the kitchen

---

## You can do this. 🍫

You have a brand (a beautiful one), you have products, and now you have a website. The hardest part of starting any business is the first sale — and that's literally one Instagram post away.

When you're ready, just tell me:
1. **"Set up Stripe"** → I'll wire up real payments
2. **"Build the backend"** → I'll add a real database + email system
3. **"Make the [thing] better"** → I'll iterate on any part of the site
4. **"Generate cartoon images for the menu"** → I'll write you Midjourney prompts that match the logo

Now go bake something. 👩‍🍳
