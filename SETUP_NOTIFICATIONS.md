# 📣 ChocoDoDo Notification Setup

This guide gets owner alerts (you, on phone) and customer order confirmations working.

There are **two parts**:

1. **Owner notifications** — *you* get pinged the moment a new order arrives → **Telegram bot** (recommended, free, no Meta hassle)
2. **Customer notifications** — they get an order confirmation when they place the order → **Gmail SMTP** + a click-to-WhatsApp link on the confirmation page

You can do these independently. Telegram alone gets you 90% of the value.

---

## 🤖 Part 1: Telegram bot (for OWNER alerts) — 5 minutes

### Step 1 — Create the bot
1. On your phone, open Telegram → search **@BotFather** → start a chat
2. Send: `/newbot`
3. Pick a display name (e.g. `ChocoDoDo Orders`)
4. Pick a username, must end in `bot` (e.g. `chocododo_orders_bot`)
5. BotFather replies with a token like `123456789:AAH...` — **copy this**

### Step 2 — Get your chat ID
1. Search for your new bot in Telegram → start it → send any message (e.g. "hi")
2. In your browser, open this URL (paste your token in):
   ```
   https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates
   ```
   Example:
   ```
   https://api.telegram.org/bot123456789:AAH.../getUpdates
   ```
3. Find `"chat":{"id":123456789,"first_name":"...` in the JSON — that number is your chat ID

### Step 3 — Save credentials in `.env`
Open `backend/.env` and add (or update) these two lines:
```
TELEGRAM_BOT_TOKEN=123456789:AAH...
TELEGRAM_CHAT_ID=123456789
```

### Step 4 — Restart the server
```
cd backend
npm start
```

You should see: `Telegram: ✅ owner alerts ON` in the boot log.

### Step 5 — Test it
1. Open the admin panel → **⚙️ Settings → 📱 Notifications**
2. Click **🧪 Send test notification**
3. Within 2 seconds, your Telegram should ping with:
   > 🧪 ChocoDoDo test notification
   > This is a test from the admin panel at <time> (Cairo).
   > If you see this on Telegram/WhatsApp/email — your setup is working ✓

If you got the ping, you're done — every new order will now ping your Telegram with **order ID, customer name, phone, address, items, total, deposit info**.

---

## ✉️ Part 2: Email (for CUSTOMER confirmations + password resets)

You have **two free options**. Pick whichever you like — both fully free, no credit card.

| | **Resend** (recommended) | **Gmail App Password** |
|---|---|---|
| Setup time | ~3 min | ~5 min |
| Free quota | 3,000 emails/month | ~500/day soft limit |
| Requires | Email signup | Gmail account + 2FA |
| Deliverability | Excellent | Good |
| Sender address | Yours, once domain verified (or onboarding sandbox) | `you@gmail.com` |

You only need one. Skip the other.

---

### Option A — Resend (recommended) — 3 minutes

#### Step 1 — Sign up
1. Open <https://resend.com> → **Sign up** (email + password, no card needed)
2. Verify your email — they'll send you one

#### Step 2 — Get an API key
1. In the Resend dashboard, go to **API Keys** → **Create API Key**
2. Name it `chocododo-prod` → permission: **Sending access** → **Add**
3. Copy the key — it starts with `re_…` and looks like `re_AbCd1234EfGh5678…`
4. **Save it now** — Resend won't show it again

#### Step 3 — Save credentials in `backend/.env`
```env
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=re_AbCd1234EfGh5678...     ← your API key from Step 2
EMAIL_FROM=ChocoDoDo <onboarding@resend.dev>
EMAIL_TO_OWNER=F.ahmed30@yahoo.com   ← where you want order copies
```

> **About the `EMAIL_FROM`:** while you're testing, use `onboarding@resend.dev` — it's a sandbox sender Resend gives every account. When you're ready to go live with `hello@chocododo.com`, follow Resend's "Add domain" flow (~10 min, requires changing DNS records — they walk you through it).

#### Step 4 — Restart + test
1. Restart the server. Boot log should show `SMTP: ✅ configured`.
2. In admin → Settings → click **🧪 Send test notification**
3. Check `EMAIL_TO_OWNER` inbox (and spam folder!) — you should get a test email within seconds.

---

### Option B — Gmail App Password — 5 minutes

> Use this if you'd rather send from your existing Gmail address. Yahoo doesn't support free SMTP, so use Gmail as the sender; you can still keep Yahoo as `EMAIL_TO_OWNER`.

#### Step 1 — Enable 2-Step Verification
1. Open <https://myaccount.google.com/security>
2. Under "How you sign in to Google", turn **2-Step Verification** ON if it isn't already

#### Step 2 — Create an App Password
1. Go to <https://myaccount.google.com/apppasswords>
2. App name: `ChocoDoDo` → click **Create**
3. Google shows a **16-character password** like `abcd efgh ijkl mnop`
4. **Copy it** (without the spaces) — Google won't show it again

#### Step 3 — Save credentials in `backend/.env`
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=yourgmail@gmail.com
SMTP_PASS=abcdefghijklmnop          ← App Password, no spaces
EMAIL_FROM=ChocoDoDo <yourgmail@gmail.com>
EMAIL_TO_OWNER=F.ahmed30@yahoo.com  ← where order copies go
```

#### Step 4 — Restart + test
1. Restart the server. Boot log should show `SMTP: ✅ configured`.
2. In admin → Settings → click **🧪 Send test notification**
3. Check `EMAIL_TO_OWNER` inbox (and spam folder!) — you should get a test email.

---

### What email gets used for

Once configured (either option), all of these "just work":
- 📩 **Order confirmation** to the customer when they place an order
- 🔐 **Password reset** link when a customer clicks "Forgot password"
- ✅ **Email verification** link when a customer signs up
- 👥 **Staff invitation** link when you invite a new staff member from admin
- 📦 **Order copy** to `EMAIL_TO_OWNER` (you) for every order, alongside the Telegram ping

---

## 📞 Part 3: WhatsApp click-to-chat (for CUSTOMERS) — 1 minute

This adds a **"💬 WhatsApp us"** button on the confirmation + tracking pages so customers can reach you instantly with their order ID. **No bot needed** — just your number.

### Setup
In `backend/.env`:
```
WHATSAPP_OWNER_NUMBER=201090210256
```
- E.164 format, **no `+`, no spaces**
- For Egyptian numbers: country code `20` + 10-digit mobile (drop the leading `0`)
- Example: `+20 101 234 5678` becomes `201012345678`

Restart. Boot log will show `WhatsApp link: ✅ wa.me click-to-chat ON`.

The same number is also shown on the InstaPay & Vodafone Cash payment instructions, so customers know where to send their transfer.

---

## 🟢 Optional: WhatsApp owner pings via CallMeBot (free, no Meta)

If you also want **WhatsApp pings on YOUR phone** when orders arrive (in addition to Telegram), CallMeBot is free.

### Setup (one-time)
1. On your phone, save **+34 644 51 95 23** as a contact (any name, e.g. "CallMeBot")
2. Send it this exact WhatsApp message: `I allow callmebot to send me messages`
3. They reply with a 7-digit API key — copy it

### Add to `.env`
```
CALLMEBOT_PHONE=201012345678        (your number, no +)
CALLMEBOT_API_KEY=1234567
```

Restart. Boot log: `WhatsApp (CallMeBot): ✅ configured`. Now order alerts go to **both Telegram and WhatsApp** on your phone.

---

## 📊 What goes where

| Event | Owner gets | Customer gets |
|---|---|---|
| New order placed | 🤖 Telegram ping with full order info <br> 📱 WhatsApp ping (if CallMeBot set up) <br> ✉️ Email to `EMAIL_TO_OWNER` (if SMTP set up) | ✉️ Email order confirmation (if SMTP set up) <br> 💬 "WhatsApp us" link on confirmation page |
| Customer signs up | — | ✉️ Verification email (if SMTP set up) |
| Customer forgets password | — | ✉️ Reset link via email (if SMTP set up) |
| Admin marks order paid (vcash/instapay) | — | ✉️ Email status update (if SMTP set up) |

---

## 🚨 Troubleshooting

**"Telegram: ⚠️ add TELEGRAM_BOT_TOKEN..."**
You either didn't save `.env` or the values aren't being picked up. Check:
- The file is at `backend/.env` (not `backend/.env.txt`)
- No extra quotes around values
- Server restarted after editing

**Test notification says "✅ Telegram sent" but nothing arrives**
- Wrong chat ID. Open `https://api.telegram.org/bot<TOKEN>/getUpdates` again and double-check
- Did you actually send a message to your bot first? `getUpdates` is empty until you do.

**Gmail test sends but customer doesn't get email**
- Check the recipient's spam folder
- Some addresses (like `@yahoo`) silently drop Gmail SMTP — try another Gmail recipient first
- Verify `SMTP_USER` matches the Gmail you generated the App Password for

**"SMTP: ⚠️ prints to console"**
SMTP isn't configured. The reset/verify emails appear in the **server terminal** instead — useful for dev. Look for blocks like:
```
📧 [email-stub] to=user@email.com subject="..."
```

---

## 🎯 Recommended minimum setup

If you only want to do ONE thing right now: **just Telegram (Part 1)**. It takes 5 minutes and gets you the most important thing — order alerts on your phone.

You can add Gmail and WhatsApp later when you have customers actually placing orders.
