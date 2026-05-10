# 🍫 ChocoDoDo Website

> *From our kitchen to you* — a fully animated, ready-to-launch bakery website.

## 🚀 Run it now

**Easiest:** double-click `index.html` and it opens in your browser.

**Better (recommended):**
```bash
# In a terminal, from this folder:
python -m http.server 8000
# Then open http://localhost:8000
```

That's it. Cart, animations, filters, checkout, confirmation — all working.

## 📁 What's where

```
Choco Dodo/
├── index.html               ← landing page
├── menu.html                ← full menu + filters
├── pages/
│   ├── checkout.html        ← multi-step checkout (calls backend)
│   ├── confirmation.html    ← order success page
│   ├── signup.html          ← create account
│   ├── login.html           ← sign in
│   ├── account.html         ← profile + order history
│   ├── admin.html           ← 🆕 admin panel (admins only)
├── assets/
│   ├── styles.css           ← all design + animations
│   ├── script.js            ← cart logic, products, API calls, option picker
│   ├── auth-pages.js        ← signup/login/account logic
│   ├── admin.js             ← admin panel logic
│   └── images/
│       ├── logo.svg         ← placeholder chef-girl badge (auto-replaced)
│       ├── logo.png         ← 👈 drop your real logo here
│       ├── hero-bg.jpg      ← 👈 drop the wide banner image here
│       └── products/
│           ├── chocolate.svg, donut.svg, macaron.svg,
│           ├── cake.svg, cookie.svg, croissant.svg
│           └── *.jpg        ← drop real product photos here
├── backend/                 ← Node.js API
│   ├── server.js            ← Express + Stripe + auth
│   ├── lib/
│   │   ├── auth.js          ← bcrypt + JWT cookies
│   │   ├── products.js      ← DB-backed product catalog + seed
│   │   ├── pricing.js       ← server-side cart math + option validation
│   │   ├── db.js            ← SQLite (orders, users, products)
│   │   └── email.js         ← nodemailer wrapper
│   ├── routes/
│   │   ├── auth.js          ← signup, login, logout, me, change-password
│   │   ├── admin.js         ← products / orders / users CRUD
│   │   └── products.js      ← public products API
│   ├── data/orders.db       ← SQLite (auto-created)
│   ├── .env.example         ← copy to .env and configure
│   └── README.md            ← backend docs
├── GUIDEBOOK.md             ← 👈 READ THIS — full launch handbook
└── README.md                ← you are here
```

## 💳 Run with real Stripe payments

```bash
cd backend
npm install
cp .env.example .env         # add your Stripe test keys
npm start                    # → http://localhost:4242
```

Open `http://localhost:4242` — backend serves the frontend AND handles checkout. See `backend/README.md` for the full setup.

## ✅ What works today

- Animated hero, scroll reveals, floating decorations
- 22-product catalog across 6 categories
- Add-to-cart, qty controls, favorites, persistent cart (localStorage)
- Mobile menu, responsive on every screen size
- Multi-step checkout form with payment-method selector
- Order confirmation with auto-generated order ID
- Newsletter & contact forms (UI ready, needs backend wiring)

## 🛠 What's next

Open **`GUIDEBOOK.md`** — it walks you through:
1. Adding your real photos
2. Buying a domain
3. Hosting (Netlify free tier in 5 minutes)
4. Wiring up Stripe for real payments
5. Sending emails on every order
6. Marketing playbook for the first 90 days
7. Legal & business essentials

## 💬 When you're ready for more

Just tell me what to do next — examples:
- *"Set up Stripe"* — I'll add real payments
- *"Build the backend"* — I'll add a real database + email
- *"Make the homepage [taller/shorter/different]"*
- *"Add product X with price $Y"*

Made with 🍫 and a lot of love.
