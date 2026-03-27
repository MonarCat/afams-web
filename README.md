# Afams Ltd — afams.co.ke

**Farming into the future**

Official website for Afams Ltd — urban agricultural technology company based in Nairobi, Kenya.

## Stack

- Pure HTML5 / CSS3 / Vanilla JavaScript — zero frameworks, zero build step
- Paystack for payments (M-Pesa, cards, mobile money)
- Google Fonts (Inter)
- Deployed on Vercel via GitHub

## Quick Deploy to Vercel

1. Push this repo to GitHub
2. Go to vercel.com → New Project → Import from GitHub
3. Select this repository
4. Leave all settings as default (Vercel auto-detects static HTML)
5. Click Deploy

Your site is live in ~60 seconds.

## After deploying — critical setup steps

### 1. Add your Paystack public key
Open `assets/js/app.js` and replace line 5:
```js
paystackKey: 'pk_live_YOUR_PAYSTACK_PUBLIC_KEY_HERE',
```
with your actual Paystack **public** key (starts with `pk_live_` or `pk_test_`).

### 2. Add your WhatsApp number
```js
whatsapp: '+254700000000',
```
Replace with your actual WhatsApp business number including country code.

### 3. Add your product images
Place your product images in `assets/images/` with these exact filenames:
- `farmbag-classic.jpg` — FarmBag Classic rooftop photo
- `farmbag-vertical.jpg` — FarmBag Vertical with Grow Cube photo
- `farmbag-hydro.jpg` — FarmBag Hydro Pro with NutriPort photo
- `aquafarmbag.jpg` — AquaFarmBag with fish photo
- `nutriport-kit.jpg` — NutriPort cartridge kit photo
- `prosoil.jpg` — Afams ProSoil bag photo

Images gracefully fallback to emoji placeholders if not found.

### 4. Custom domain (afams.co.ke)
In Vercel Dashboard → Project → Settings → Domains → Add → `afams.co.ke`
Vercel provides the DNS records to add in TrueHost.

## File structure
```
afams-web/
├── index.html          # Main website (single page)
├── vercel.json         # Vercel configuration + security headers
├── assets/
│   ├── css/
│   │   └── style.css   # All styles (dark mode ready, fully responsive)
│   └── js/
│       └── app.js      # Cart, Paystack, animations, all JS
└── README.md
```

## Features
- ✅ Pre-order system (Tesla-style — pay now, receive in 3 days)
- ✅ Cart drawer with quantity management
- ✅ Paystack checkout popup (M-Pesa, Visa, Mastercard, Airtel, T-Kash)
- ✅ Order confirmation modal with delivery timeline
- ✅ Persistent cart (localStorage)
- ✅ WhatsApp float button
- ✅ Scroll animations (IntersectionObserver)
- ✅ Fully mobile responsive
- ✅ Newsletter capture
- ✅ FAQ accordion
- ✅ Product badge system
- ✅ 8-country presence section
- ✅ Institutional clients section
- ✅ Founder story section
- ✅ Toast notifications
- ✅ SEO meta tags (Open Graph)
- ✅ Security headers via vercel.json

## Contact
afamskenya@gmail.com · afams.co.ke · Nairobi, Kenya
