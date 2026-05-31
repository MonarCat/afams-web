# SUCHAI — Full Site Overhaul · GitHub Copilot Super Prompt
### `afams-limited/afams-web` · Branch: `feat/suchai-overhaul`

---

## 0. Mission Statement

Transform the `afams-web` repo from its previous agricultural products store into a
**SuChai** premium Kenyan tea e-commerce site. Every legacy-brand reference is removed.
The entire product catalogue, UI, copy, and data schema is replaced with SuChai.
**The existing tech stack is unchanged.** Only the product and presentation layer changes.

---

## 1. Context & Stack

| Layer           | Technology                                           |
|-----------------|------------------------------------------------------|
| Frontend        | Static HTML / CSS / Vanilla JS                       |
| Hosting         | Vercel (auto-deploy on push to `main`)               |
| Backend         | Supabase — project ID: `dvquyzzqsnlcassvgdzz`        |
| Payments        | Paystack (KES, inline JS)                            |
| Email           | Brevo transactional API                              |
| DNS             | Cloudflare → `afams.co.ke`                           |
| Repo            | `afams-limited/afams-web`                            |
| Edge Functions  | Deno (Supabase Edge Functions)                       |
| Node version    | 24.x                                                 |

### Supabase MCP Rule
Use `execute_sql` for ALL schema changes. Never use `apply_migration` — it returns
"No approval received" errors. Always target project `dvquyzzqsnlcassvgdzz`.

---

## 2. Repository File Structure (Target State)

```
afams-web/
├── index.html              ← Main SuChai store (full overhaul)
├── product.html            ← QR scan product info page (NEW)
├── admin-qr.html           ← Internal QR generator tool (NEW, not in nav)
├── assets/
│   ├── css/
│   │   └── main.css        ← Shared styles (full rewrite)
│   ├── js/
│   │   ├── products.js     ← Product catalogue + cart logic (NEW)
│   │   ├── checkout.js     ← Paystack integration (update)
│   │   └── product-page.js ← QR landing page logic (NEW)
│   └── img/
│       ├── products/       ← Product photos (replaceable JPGs)
│       │   ├── rtd-plain.jpg
│       │   ├── rtd-ginger.jpg
│       │   ├── rtd-lemon.jpg
│       │   ├── ord-plain.jpg
│       │   ├── ord-ginger.jpg
│       │   └── ord-lemon.jpg
│       └── og-suchai.jpg   ← OG / social share image (1200×630)
├── supabase/
│   └── functions/
│       ├── paystack-webhook/
│       │   └── index.ts    ← Verify → save order → trigger email
│       └── send-order-email/
│           └── index.ts    ← Brevo order confirmation email
├── vercel.json
└── package.json
```

**Delete on this branch:** All legacy-brand-specific HTML, JS, CSS, and image files.

---

## 3. Design System

### 3.1 Colour Tokens

```css
:root {
  /* Brand */
  --c-deep:      #0B1E12;   /* Nav, hero, footer, dark sections */
  --c-mid:       #1C4730;   /* Hover states on green */
  --c-gold:      #C9A020;   /* Primary accent — CTAs, labels */
  --c-gold-lt:   #E8C040;   /* Gold hover */

  /* Surfaces */
  --c-parchment: #F4EDD6;   /* Warm section backgrounds */
  --c-cream:     #F8F5EE;   /* Product grid background */
  --c-white:     #FFFFFF;
  --c-border:    rgba(11, 30, 18, 0.09);

  /* Text */
  --c-text:      #0B1E12;
  --c-muted:     #7A6A58;
  --c-sub:       rgba(11, 30, 18, 0.55);

  /* Tokens */
  --r-sm:        6px;
  --r-md:        10px;
  --r-lg:        14px;
  --r-xl:        20px;
  --r-pill:      100px;
  --shadow:      0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05);
  --transition:  all 0.18s ease;
}
```

### 3.2 Typography

```css
/* Display / brand wordmarks / section headings */
font-family: Georgia, 'Times New Roman', serif;

/* Body, UI, labels */
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
```

### 3.3 Flavour Accent Colours

```js
const FLAVOR_ACCENT = {
  plain:  '#C9A020',  // gold
  ginger: '#E07820',  // amber-orange
  lemon:  '#A0B808',  // lime-gold
};
```

---

## 4. Product Catalogue

### 4.1 `assets/js/products.js` (full file)

```js
/* ============================================================
   SuChai Product Catalogue
   Afams Limited · afams.co.ke
   ============================================================ */

const PRODUCTS = [
  {
    id:      'rtd-plain',
    variety: 'rtd',
    flavor:  'plain',
    name:    'SuChai Classic',
    tagline: 'The original. Bold, clean, no sieving.',
    rating:  4.9,
    reviews: 284,
    badge:   'Best Seller',
    badgeGold: false,
    image:   'assets/img/products/rtd-plain.jpg',
  },
  {
    id:      'rtd-ginger',
    variety: 'rtd',
    flavor:  'ginger',
    name:    'SuChai Tangawizi',
    tagline: 'RTD with a warm ginger kick.',
    rating:  4.8,
    reviews: 196,
    badge:   'Fan Favourite',
    badgeGold: true,
    image:   'assets/img/products/rtd-ginger.jpg',
  },
  {
    id:      'rtd-lemon',
    variety: 'rtd',
    flavor:  'lemon',
    name:    'SuChai Lemon',
    tagline: 'Bright citrus, light and refreshing.',
    rating:  4.7,
    reviews: 143,
    badge:   '',
    badgeGold: false,
    image:   'assets/img/products/rtd-lemon.jpg',
  },
  {
    id:      'ord-plain',
    variety: 'ordinary',
    flavor:  'plain',
    name:    'SuChai Traditional',
    tagline: 'For the jiko. Less sugar, full depth.',
    rating:  4.8,
    reviews: 221,
    badge:   'Classic',
    badgeGold: false,
    image:   'assets/img/products/ord-plain.jpg',
  },
  {
    id:      'ord-ginger',
    variety: 'ordinary',
    flavor:  'ginger',
    name:    'SuChai Tangawizi',
    tagline: 'Traditional brew with a ginger twist.',
    rating:  4.9,
    reviews: 178,
    badge:   'Fan Favourite',
    badgeGold: true,
    image:   'assets/img/products/ord-ginger.jpg',
  },
  {
    id:      'ord-lemon',
    variety: 'ordinary',
    flavor:  'lemon',
    name:    'SuChai Lemon',
    tagline: 'Ordinary brew, citrus brightened.',
    rating:  4.7,
    reviews: 102,
    badge:   '',
    badgeGold: false,
    image:   'assets/img/products/ord-lemon.jpg',
  },
];

/* Prices in KES */
const PRICES = {
  rtd: {
    '50g':  120,
    '100g': 220,
    '150g': 310,
    '200g': 390,
    '250g': 460,
  },
  ordinary: {
    '50g':  100,
    '100g': 190,
    '150g': 275,
    '200g': 350,
    '250g': 415,
  },
};

const SIZES   = ['50g', '100g', '150g', '200g', '250g'];
const DEFAULT_SIZE = '100g';

const FLAVOR_LABEL  = { plain: 'Plain', ginger: 'Ginger (Tangawizi)', lemon: 'Lemon' };
const VARIETY_LABEL = { rtd: 'Ready to Drink', ordinary: 'Ordinary' };
const FLAVOR_ACCENT = { plain: '#C9A020', ginger: '#E07820', lemon: '#A0B808' };

/* Star HTML helper */
function starsHtml(rating) {
  const full  = Math.floor(rating);
  const half  = rating - full >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
}
```

---

## 5. `index.html` — Main Store

### 5.1 HTML Head

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#0B1E12">
  <title>SuChai — Premium Kenyan Chai · No Sieving Required</title>
  <meta name="description" content="Kenya's finest chai — specially formulated, no sieving needed. Ready to Drink and Ordinary in Plain, Ginger, and Lemon. By Afams Limited.">
  <meta property="og:title"       content="SuChai — Premium Kenyan Chai">
  <meta property="og:description" content="No sieving required. Bold flavour every cup.">
  <meta property="og:image"       content="https://afams.co.ke/assets/img/og-suchai.jpg">
  <meta property="og:url"         content="https://afams.co.ke">
  <link rel="canonical"           href="https://afams.co.ke">

  <!-- Injected config (replace values before deploy) -->
  <script>
    window.__PAYSTACK_PUBLIC_KEY = 'pk_live_XXXXXXXXXXXXXXXXXXXX';
    window.__SUPABASE_URL        = 'https://dvquyzzqsnlcassvgdzz.supabase.co';
    window.__SUPABASE_ANON_KEY   = 'eyJ_REPLACE_WITH_ANON_KEY';
  </script>
  <script src="https://js.paystack.co/v1/inline.js"></script>
  <link rel="stylesheet" href="assets/css/main.css">
</head>
```

### 5.2 Page Sections (in order)

Build each section in a single `index.html`. All JS in `<script>` tags or linked JS files.
No frameworks. Vanilla DOM only.

---

#### SECTION 1 — Nav (sticky)

```html
<nav id="snav">
  <a class="nav-logo" href="#home">Su<em>Chai</em></a>

  <ul class="nav-links">
    <li><a href="#shop">Shop</a></li>
    <li><a href="#story">Our Story</a></li>
    <li><a href="#afams">About Afams</a></li>
  </ul>

  <button id="cart-toggle" class="cart-pill" aria-label="Open cart">
    <!-- Tabler icon: ti-shopping-bag (inline SVG) -->
    Cart
    <span class="cart-badge" id="cart-count">0</span>
  </button>
</nav>
```

**CSS:**
- `position: sticky; top: 0; z-index: 200`
- `background: #fff; border-bottom: 0.5px solid rgba(0,0,0,0.08); height: 56px`
- Logo: `font-family: Georgia, serif; font-size: 22px; color: #0B1E12`
- Logo `em`: `color: #C9A020; font-style: normal`
- Cart pill: `background: #0B1E12; color: #fff; border-radius: var(--r-pill); padding: 7px 16px`
- Cart badge: `background: #C9A020; color: #0B1E12; border-radius: 50%; font-size: 10px`

---

#### SECTION 2 — Hero

```html
<section class="hero" id="home">
  <div class="hero-eye">Afams Limited · Premium Kenyan Chai</div>
  <h1 class="hero-title">
    Kenya's Finest Chai.<br>
    <em>No Sieving.</em> Pure Taste.
  </h1>
  <p class="hero-sub">
    Specially formulated strong tea — drop it in, brew, enjoy.
    No strainer, no mess. Bold flavour every single cup.
  </p>
  <div class="hero-proof">
    <span class="stars-gold">★★★★★</span>
    <span>Rated <strong>4.9 / 5</strong> by 500+ chai lovers across Kenya</span>
  </div>
  <div class="hero-pills">
    <div class="h-pill">No Sieving</div>
    <div class="h-pill">Secret Formula</div>
    <div class="h-pill">All Natural</div>
    <div class="h-pill">Made in Kenya</div>
  </div>
</section>
```

**CSS:**
- `background: #0B1E12; padding: 3.5rem 1.5rem 3rem; text-align: center`
- `h1`: Georgia, `48px`, white, `em` child: `#C9A020`
- Eyebrow: `10px, letter-spacing: 0.22em, #C9A020`
- Proof text: `13px, rgba(255,255,255,0.6)`
- Pills: `background: rgba(255,255,255,0.05); border: 0.5px solid rgba(201,160,32,0.2); border-radius: var(--r-pill); font-size: 11px`

---

#### SECTION 3 — Trust Strip

```html
<div class="trust-strip">
  <div class="trust-item"><!-- leaf icon --> All Natural Ingredients</div>
  <div class="trust-item"><!-- filter-off icon --> Zero Sieving Needed</div>
  <div class="trust-item"><!-- map-pin icon --> Made in Kenya</div>
  <div class="trust-item"><!-- truck icon --> Nairobi Delivery</div>
  <div class="trust-item"><!-- shield-check icon --> Secure Payments</div>
</div>
```

**CSS:**
- `background: #fff; border-bottom: 0.5px solid rgba(0,0,0,0.06); padding: 0.875rem 1.5rem`
- `display: flex; justify-content: space-around; flex-wrap: wrap; gap: 0.75rem`
- Item: `font-size: 11px; color: #1C4730; font-weight: 500; display: flex; align-items: center; gap: 6px`
- Icon: `color: #C9A020`

---

#### SECTION 4 — Products

```html
<section class="products-section" id="shop">

  <!-- Header row -->
  <div class="prod-header">
    <div class="prod-header-left">
      <div class="section-eye">The Collection</div>
      <h2 class="section-title">Shop SuChai</h2>
    </div>
    <div class="filter-tabs" role="group" aria-label="Filter by variety">
      <button class="ftab active" data-filter="all">All (6)</button>
      <button class="ftab" data-filter="rtd">Ready to Drink</button>
      <button class="ftab" data-filter="ordinary">Ordinary</button>
    </div>
  </div>

  <!-- Product grid — rendered by JS -->
  <div class="prod-grid" id="prod-grid" role="list"></div>

  <!-- Mini trust row -->
  <div class="mini-trust">
    <span><!-- refresh icon --> Fresh stock, made to order</span>
    <span><!-- package icon --> Sizes from 50g to 250g</span>
    <span><!-- star icon --> Rated 4.9 / 5 on average</span>
  </div>

  <!-- Cart panel — toggled by JS -->
  <div class="cart-panel" id="cart-panel" aria-hidden="true">
    <div class="cart-head">
      <span class="cart-head-title">Your Cart</span>
      <button id="cart-close" aria-label="Close cart">✕</button>
    </div>

    <!-- Subscribe toggle (Waka-inspired) -->
    <div class="sub-toggle" role="group">
      <button class="stog active" id="tog-once" onclick="setSubMode('once')">
        One-time order
      </button>
      <button class="stog" id="tog-sub" onclick="setSubMode('sub')">
        Subscribe &amp; Save <strong>10%</strong>
      </button>
    </div>

    <div class="cart-items" id="cart-items"></div>

    <div class="cart-footer">
      <div>
        <div class="total-label">Order Total</div>
        <div class="total-val" id="cart-total">KES 0</div>
        <div class="saving-note" id="saving-note"></div>
      </div>
      <button class="pay-btn" id="pay-btn" onclick="initiatePayment()">
        🔒 Pay with Paystack
      </button>
    </div>
  </div>

</section>
```

---

#### Product Card — JS Rendering (`products.js`)

```js
/* Render the entire product grid */
function renderGrid() {
  const grid = document.getElementById('prod-grid');
  grid.innerHTML = PRODUCTS.map(p => productCardHTML(p)).join('');
  wireCardEvents();
}

function productCardHTML(p) {
  const sz   = selectedSize[p.id] || DEFAULT_SIZE;
  const pr   = PRICES[p.variety][sz];
  const ac   = FLAVOR_ACCENT[p.flavor];
  const badgeHtml = p.badge
    ? `<div class="img-badge${p.badgeGold ? ' img-badge--gold' : ''}">${p.badge}</div>`
    : '';

  return `
  <div class="prod-card" data-variety="${p.variety}" id="card-${p.id}" role="listitem">

    <!-- Image -->
    <div class="prod-img">
      <img src="${p.image}" alt="${p.name} — SuChai ${FLAVOR_LABEL[p.flavor]}"
           loading="lazy" width="400" height="500"
           onerror="this.style.display='none';document.getElementById('fb-${p.id}').style.display='flex'">
      <!-- SVG fallback until real photos are available -->
      <div class="prod-img-fallback" id="fb-${p.id}" style="display:none"
           data-variety="${p.variety}" data-flavor="${p.flavor}">
        <!-- Insert SVG pouch illustration here (see Section 5.4) -->
      </div>
      ${badgeHtml}
    </div>

    <!-- Card body -->
    <div class="prod-body">
      <div class="variety-badge variety-badge--${p.variety}">
        ${VARIETY_LABEL[p.variety]}
      </div>
      <div class="prod-name">${p.name}</div>
      <div class="stars-row">
        <span class="stars" style="color:${ac}">${starsHtml(p.rating)}</span>
        <span class="review-count">${p.rating} (${p.reviews})</span>
      </div>
      <div class="prod-flavor">${FLAVOR_LABEL[p.flavor]}</div>

      <!-- Size selector -->
      <div class="size-row" id="sizes-${p.id}">
        ${SIZES.map(sz =>
          `<button class="sz-btn${sz === DEFAULT_SIZE ? ' active' : ''}"
                   data-pid="${p.id}" data-size="${sz}">${sz}</button>`
        ).join('')}
      </div>

      <!-- Price -->
      <div class="price-line">
        <span class="price" id="price-${p.id}">KES ${pr.toLocaleString()}</span>
        <span class="price-note" id="pnote-${p.id}">${sz} pack</span>
      </div>

      <!-- CTA -->
      <button class="add-btn" data-pid="${p.id}" aria-label="Add ${p.name} to cart">
        + Add to Cart
      </button>
    </div>
  </div>`;
}

/* Wire click events after render */
function wireCardEvents() {
  // Size chips
  document.querySelectorAll('.sz-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const pid = btn.dataset.pid;
      const sz  = btn.dataset.size;
      selectedSize[pid] = sz;
      // Update active state
      document.querySelectorAll(`#sizes-${pid} .sz-btn`)
              .forEach(b => b.classList.toggle('active', b.dataset.size === sz));
      // Update price display
      const p = PRODUCTS.find(x => x.id === pid);
      document.getElementById(`price-${pid}`).textContent =
        `KES ${PRICES[p.variety][sz].toLocaleString()}`;
      document.getElementById(`pnote-${pid}`).textContent = `${sz} pack`;
    });
  });

  // Add to cart
  document.querySelectorAll('.add-btn').forEach(btn => {
    btn.addEventListener('click', () => addToCart(btn.dataset.pid));
  });

  // Filter tabs
  document.querySelectorAll('.ftab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.ftab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const f = tab.dataset.filter;
      document.querySelectorAll('.prod-card').forEach(card => {
        card.hidden = f !== 'all' && card.dataset.variety !== f;
      });
    });
  });
}
```

---

#### Cart Logic (`products.js` continued)

```js
/* ── Cart State ── */
let cart    = [];        // [{key, id, variety, flavor, size, name, basePrice, qty}]
let subMode = 'once';   // 'once' | 'sub'
const selectedSize = {};
PRODUCTS.forEach(p => (selectedSize[p.id] = DEFAULT_SIZE));

function effectivePrice(item) {
  return subMode === 'sub' ? Math.round(item.basePrice * 0.9) : item.basePrice;
}

function addToCart(pid) {
  const p    = PRODUCTS.find(x => x.id === pid);
  const sz   = selectedSize[pid];
  const key  = `${pid}-${sz}`;
  const existing = cart.find(i => i.key === key);

  if (existing) {
    existing.qty++;
  } else {
    cart.push({
      key, id: pid,
      variety:   p.variety,
      flavor:    p.flavor,
      size:      sz,
      name:      p.name,
      basePrice: PRICES[p.variety][sz],
      qty:       1,
    });
  }

  syncCartUI();
  renderCartItems();
  openCart();
  showToast(`${p.name} (${sz}) added`);
}

function removeCartItem(key) {
  cart = cart.filter(i => i.key !== key);
  syncCartUI();
  renderCartItems();
}

function setSubMode(mode) {
  subMode = mode;
  document.getElementById('tog-once').classList.toggle('active', mode === 'once');
  document.getElementById('tog-sub').classList.toggle('active', mode === 'sub');
  syncCartUI();
}

function syncCartUI() {
  const count = cart.reduce((a, i) => a + i.qty, 0);
  const total = cart.reduce((a, i) => a + effectivePrice(i) * i.qty, 0);

  document.getElementById('cart-count').textContent = count;
  document.getElementById('cart-total').textContent = `KES ${total.toLocaleString()}`;

  const note = document.getElementById('saving-note');
  if (subMode === 'sub' && cart.length) {
    const orig = cart.reduce((a, i) => a + i.basePrice * i.qty, 0);
    note.textContent = `You save KES ${(orig - total).toLocaleString()} with subscription`;
  } else {
    note.textContent = '';
  }
}

function renderCartItems() {
  const el = document.getElementById('cart-items');
  if (!cart.length) {
    el.innerHTML = '<p class="cart-empty">Your cart is empty.</p>';
    return;
  }
  el.innerHTML = cart.map(it => `
    <div class="cart-item">
      <div class="ci-info">
        <div class="ci-name">${it.name} · ${FLAVOR_LABEL[it.flavor]}</div>
        <div class="ci-sub">${it.size} × ${it.qty}</div>
      </div>
      <div class="ci-right">
        <div class="ci-price">KES ${(effectivePrice(it) * it.qty).toLocaleString()}</div>
        <button class="ci-remove" onclick="removeCartItem('${it.key}')"
                aria-label="Remove item">🗑</button>
      </div>
    </div>`).join('');
}

function openCart() {
  document.getElementById('cart-panel').classList.add('open');
  document.getElementById('cart-panel').removeAttribute('aria-hidden');
  renderCartItems();
}

function closeCart() {
  document.getElementById('cart-panel').classList.remove('open');
  document.getElementById('cart-panel').setAttribute('aria-hidden', 'true');
}

/* Toast */
function showToast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

/* Init */
document.addEventListener('DOMContentLoaded', () => {
  renderGrid();
  document.getElementById('cart-toggle').addEventListener('click', openCart);
  document.getElementById('cart-close').addEventListener('click', closeCart);
});
```

---

#### SECTION 5 — USP Row

```html
<section class="usp-row">
  <div class="usp-card">
    <div class="usp-icon"><!-- filter-off icon --></div>
    <div class="usp-title">No Sieving Required</div>
    <p class="usp-body">Our formula means zero residue — brew and drink clean every time.</p>
  </div>
  <div class="usp-card">
    <div class="usp-icon"><!-- lock icon --></div>
    <div class="usp-title">Secret Processing</div>
    <p class="usp-body">A proprietary method delivering bold, deep chai in every batch.</p>
  </div>
  <div class="usp-card">
    <div class="usp-icon"><!-- truck-delivery icon --></div>
    <div class="usp-title">Fresh to Your Door</div>
    <p class="usp-body">Made to order — Nairobi delivery available on all sizes.</p>
  </div>
</section>
```

---

#### SECTION 6 — Story (dark green)

```html
<section class="story" id="story">
  <div class="story-inner">
    <div class="story-text">
      <div class="section-eye">The Origin</div>
      <h2 class="story-title">Chai the Way It Was Meant to Be</h2>
      <p>SuChai was born from a simple frustration — great tea shouldn't require
         great effort. After years of perfecting the formula, we developed a proprietary
         processing method that delivers bold, satisfying chai without the sieve,
         without the mess, without compromise.</p>
      <p>Two varieties give you freedom — Ready to Drink for the quick cup,
         Ordinary for the slow traditional brew over the jiko.</p>
      <div class="story-badge">📍 Proudly Kenyan · Afams Limited</div>
    </div>

    <!-- Comparison card -->
    <div class="story-aside">
      <div class="comp-card">
        <div class="comp-title">Variety comparison</div>
        <div class="comp-row">
          <span></span>
          <span class="cv-rtd">Ready to Drink</span>
          <span class="cv-ord">Ordinary</span>
        </div>
        <div class="comp-row"><span>Sugar</span><span>More</span><span>Less</span></div>
        <div class="comp-row"><span>Method</span><span>Hot water</span><span>Cook / boil</span></div>
        <div class="comp-row"><span>Sieving</span><span>None</span><span>None</span></div>
        <div class="comp-row"><span>Best for</span><span>Quick cup</span><span>Traditional</span></div>
      </div>
      <div class="flavor-list">
        <div class="fl-title">Available flavours</div>
        <div class="fl-item">Plain</div>
        <div class="fl-item">Ginger (Tangawizi)</div>
        <div class="fl-item">Lemon</div>
      </div>
    </div>
  </div>
</section>
```

---

#### SECTION 7 — About Afams

```html
<section class="afams" id="afams">
  <div class="section-eye">About Us</div>
  <h2 class="section-title">Afams Limited</h2>
  <p class="section-sub">
    A diversified Kenyan agricultural company — SuChai is our processing flagship.
  </p>
  <div class="pillars">
    <div class="pillar">
      <div class="pillar-icon"><!-- plant-2 icon --></div>
      <div class="pillar-name">Production</div>
      <p>Sourcing quality agri inputs from across Kenya.</p>
    </div>
    <div class="pillar">
      <div class="pillar-icon"><!-- tools icon --></div>
      <div class="pillar-name">Services</div>
      <p>Advisory, logistics, and agri-support.</p>
    </div>
    <div class="pillar">
      <div class="pillar-icon"><!-- building-factory icon --></div>
      <div class="pillar-name">Processing</div>
      <p>SuChai — bold chai, no sieving needed.</p>
    </div>
    <div class="pillar">
      <div class="pillar-icon"><!-- speakerphone icon --></div>
      <div class="pillar-name">Marketing</div>
      <p>Connecting Kenyan products to markets.</p>
    </div>
  </div>
</section>
```

---

#### SECTION 8 — Footer

```html
<footer>
  <div class="footer-inner">
    <div class="ft-brand">
      <div class="ft-logo">Su<em>Chai</em></div>
      <p>Kenya's finest chai — no sieving, pure taste.<br>A product of Afams Limited, Nairobi.</p>
    </div>
    <div class="ft-col">
      <div class="ft-col-title">Navigate</div>
      <ul>
        <li><a href="#shop">Shop</a></li>
        <li><a href="#story">Our Story</a></li>
        <li><a href="#afams">About Afams</a></li>
      </ul>
    </div>
    <div class="ft-col">
      <div class="ft-col-title">Contact</div>
      <ul>
        <li><a href="mailto:orders@afams.co.ke">orders@afams.co.ke</a></li>
        <li><a href="https://afams.co.ke">afams.co.ke</a></li>
        <li>Nairobi, Kenya</li>
      </ul>
    </div>
  </div>
  <div class="ft-bottom">
    <span>© 2025 Afams Limited. All rights reserved.</span>
    <span>Payments by Paystack</span>
  </div>
</footer>
```

---

### 5.3 Product Image Fallback SVGs

When a real product photo is missing (`onerror`), render a branded SVG pouch.
Each fallback is differentiated by `data-variety` and `data-flavor`:
- RTD bags: gold (`#C9A020`) background, dark green (`#0B1E12`) pouch body
- Ordinary bags: dark green background, gold accent
- Flavour accent strip: gold = Plain, amber = Ginger, lime = Lemon

Use `aspect-ratio: 4/5` on `.prod-img` so the SVG and photos share the same space.

---

## 6. `product.html` — QR Scan Landing Page

### 6.1 Purpose

Opened when a customer scans the QR code on a SuChai product label.
Shows batch details, specs, brewing instructions, and freshness status.
Mobile-first. No nav bar. Standalone page.

### 6.2 URL Scheme

```
https://afams.co.ke/product.html?v=rtd&f=plain&s=100g&b=SC-001&exp=Dec+2026&mfg=Jan+2026
```

| Param | Description              | Example values                         |
|-------|--------------------------|----------------------------------------|
| `v`   | Variety                  | `rtd` \| `ordinary`                   |
| `f`   | Flavour                  | `plain` \| `ginger` \| `lemon`        |
| `s`   | Size                     | `50g` \| `100g` \| `150g` \| `200g` \| `250g` |
| `b`   | Batch number             | `SC-001`                               |
| `exp` | Best before              | `Dec 2026`                             |
| `mfg` | Manufacture date         | `Jan 2026`                             |

### 6.3 Page Design (mobile-first, max-width: 430px, centered)

**Hero (dark green `#0B1E12`):**
- `SuChai` wordmark (Georgia, 52px, white with `em` in gold)
- "✓ Verified Product · Afams Limited" pill (gold outline, gold text)
- Three badges in a row: `[Variety]  [Flavour]  [Size]`
  - Variety: white/translucent; Flavour & Size: gold-tinted (use `FLAVOR_ACCENT`)

**Body (parchment `#F4EDD6`, `border-radius: 24px 24px 0 0`):**

1. **Freshness bar** (dark green card):
   - Left: "Best Before" label + date value (gold, 18px)
   - Right: `● Good to use` (green dot) or `● Check before use` (orange dot)
   - Expiry logic: `parseInt(exp.match(/\d{4}/)[0]) >= new Date().getFullYear()`

2. **Batch & Traceability card** (white):
   - Rows: Batch Number | Manufactured | Best Before | Country (🇰🇪 Kenya)

3. **Product Specifications card** (white):
   - Product: SuChai Tea
   - Variety, Flavour, Net Weight, Sieving Required: `✓ None`

4. **Ingredients card** (white):
   ```js
   const INGREDIENTS = {
     plain:  'Black tea, sugar. No artificial flavours or preservatives.',
     ginger: 'Black tea, sugar, ginger extract (Tangawizi). No artificial preservatives.',
     lemon:  'Black tea, sugar, natural lemon flavouring. No artificial preservatives.',
   };
   ```

5. **How to Brew card** (white, numbered steps):
   ```js
   const BREW = {
     rtd: [
       'Add 1–2 tsp (5–10g) to your cup.',
       'Pour freshly boiled water.',
       'Stir gently for 10–15 seconds.',
       'Enjoy immediately. No sieving required.',
     ],
     ordinary: [
       'Combine water and milk in a pot (ratio to taste).',
       'Add 1–2 tsp SuChai per cup.',
       'Bring to a gentle boil for 3–5 minutes.',
       'Pour directly into cup. No sieving needed.',
     ],
   };
   ```
   Step numbers: `24px circle, background: #0B1E12, color: #C9A020`

6. **Storage card** (white, static):
   - Store in cool, dry place | Reseal after opening | Avoid moisture & direct sunlight

7. **Manufactured By card** (white):
   - Company: Afams Limited | Location: Nairobi, Kenya
   - Email: orders@afams.co.ke | Website: afams.co.ke

**Footer (dark green):**
- SuChai logo
- "Shop Online" + "Contact" pill buttons (gold outline)
- `© 2025 Afams Limited`

### 6.4 product.html JS

```js
// product-page.js
const P = new URLSearchParams(window.location.search);
const v   = P.get('v')   || 'rtd';
const f   = P.get('f')   || 'plain';
const s   = P.get('s')   || '100g';
const b   = P.get('b')   || 'SC-001';
const exp = P.get('exp') || 'Dec 2026';
const mfg = P.get('mfg') || 'Jan 2026';

// Populate all dynamic elements via getElementById + textContent
// Check expiry: if year < current year, show orange dot + "Check before use"
// Apply FLAVOR_ACCENT to flavour and size badges
```

---

## 7. `admin-qr.html` — QR Code Generator (Internal)

**Not linked from nav. Not indexed (`<meta name="robots" content="noindex">`).**
Used by Moses to generate QR codes per batch run.

### 7.1 Dependencies

```html
<script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
```

### 7.2 UI

- Form: variety selector, flavour selector, size selector, batch input, expiry input, mfg date input
- "Generate QR" button
- Canvas showing the QR code
- Encoded URL display (read-only text)
- "Download PNG" button (`canvas.toDataURL()` → anchor download)
- Preview: shows what the label URL looks like before QR generation

### 7.3 QR Generation Logic

```js
async function generateQR() {
  const v   = document.getElementById('sel-variety').value;
  const f   = document.getElementById('sel-flavor').value;
  const s   = document.getElementById('sel-size').value;
  const b   = document.getElementById('inp-batch').value || 'SC-001';
  const exp = document.getElementById('inp-exp').value   || 'Dec 2026';
  const mfg = document.getElementById('inp-mfg').value   || 'Jan 2026';

  const url = `https://afams.co.ke/product.html?v=${v}&f=${f}&s=${s}`
            + `&b=${encodeURIComponent(b)}`
            + `&exp=${encodeURIComponent(exp)}`
            + `&mfg=${encodeURIComponent(mfg)}`;

  document.getElementById('encoded-url').value = url;

  const canvas = document.getElementById('qr-canvas');
  await QRCode.toCanvas(canvas, url, {
    width:                200,
    margin:               2,
    errorCorrectionLevel: 'M',
    color: {
      dark:  '#0B1E12',   // dark green QR modules
      light: '#FFFFFF',
    },
  });
}

function downloadQR() {
  const canvas = document.getElementById('qr-canvas');
  const v = document.getElementById('sel-variety').value;
  const f = document.getElementById('sel-flavor').value;
  const s = document.getElementById('sel-size').value;
  const b = document.getElementById('inp-batch').value;
  const link = document.createElement('a');
  link.download = `suchai-qr-${v}-${f}-${s}-${b}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
```

### 7.4 QR Placement on Back Sticker

The generated QR PNG replaces the barcode placeholder on the back sticker SVG.
Recommended size on printed sticker: **2.5 cm × 2.5 cm** minimum.
Error correction level M ensures readability even with minor print imperfections.

---

## 8. `assets/js/checkout.js` — Paystack Integration

```js
async function initiatePayment() {
  if (!cart.length) {
    showToast('Your cart is empty');
    return;
  }

  const email = prompt('Enter your email for order confirmation:');
  if (!email || !email.includes('@')) { showToast('Invalid email'); return; }

  const phone = prompt('Your phone number (for delivery):');

  const total = cart.reduce((a, i) => a + effectivePrice(i) * i.qty, 0);

  const handler = PaystackPop.setup({
    key:      window.__PAYSTACK_PUBLIC_KEY,
    email,
    amount:   total * 100,  // Paystack uses kobo (×100 for KES)
    currency: 'KES',
    ref:      `SC-${Date.now()}`,
    metadata: {
      custom_fields: [
        { display_name: 'Phone',        variable_name: 'phone',        value: phone },
        { display_name: 'Subscription', variable_name: 'subscription', value: subMode === 'sub' },
      ],
      cart_json: JSON.stringify(cart),
      sub_mode:  subMode,
    },
    callback: (response) => handleSuccess(response.reference, email, phone),
    onClose:  () => {},
  });

  handler.openIframe();
}

async function handleSuccess(ref, email, phone) {
  showToast('Confirming your order…');
  try {
    const res = await fetch(
      `${window.__SUPABASE_URL}/functions/v1/paystack-webhook`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ reference: ref, email, phone, cart, subMode }),
      }
    );
    if (res.ok) {
      cart = [];
      syncCartUI();
      closeCart();
      showToast('✓ Order confirmed! Check your email.');
    }
  } catch {
    showToast('Order received. We'll confirm via email shortly.');
  }
}
```

---

## 9. Supabase Edge Functions

### 9.1 `paystack-webhook/index.ts`

```typescript
import { serve }        from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PAYSTACK_SK  = Deno.env.get('PAYSTACK_SECRET_KEY')!;
const SB_URL       = Deno.env.get('SUPABASE_URL')!;
const SB_KEY       = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST')   return new Response('Method Not Allowed', { status: 405 });

  const { reference, email, phone, cart, subMode } = await req.json();

  /* 1 — Verify with Paystack */
  const verifyRes = await fetch(
    `https://api.paystack.co/transaction/verify/${reference}`,
    { headers: { Authorization: `Bearer ${PAYSTACK_SK}` } }
  );
  const { data: tx } = await verifyRes.json();
  if (tx?.status !== 'success') {
    return new Response('Payment not verified', { status: 400, headers: CORS });
  }

  const supabase = createClient(SB_URL, SB_KEY);
  const items: any[] = typeof cart === 'string' ? JSON.parse(cart) : cart;
  const isSub = subMode === 'sub';
  const total = tx.amount / 100;

  const productSummary = items
    .map((i: any) => `${i.name} (${i.size}) ×${i.qty}`)
    .join(', ');

  /* 2 — Insert order */
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({
      email,
      phone,
      product_name:   productSummary,
      amount:         total,
      paystack_ref:   reference,
      payment_status: 'paid',
      subscription:   isSub,
      sub_discount:   isSub ? Math.round(total * 0.1) : 0,
    })
    .select('id')
    .single();

  if (orderErr) {
    console.error('Order insert error:', orderErr);
    return new Response('DB error', { status: 500, headers: CORS });
  }

  /* 3 — Insert order_items */
  const orderItems = items.map((i: any) => ({
    order_id:   order.id,
    product_id: i.id,
    variety:    i.variety,
    flavor:     i.flavor,
    size:       i.size,
    unit_price: i.basePrice,
    quantity:   i.qty,
  }));
  await supabase.from('order_items').insert(orderItems);

  /* 4 — Send confirmation email */
  await fetch(`${SB_URL}/functions/v1/send-order-email`, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization:  `Bearer ${SB_KEY}`,
    },
    body: JSON.stringify({ orderId: order.id, email, phone, items, total, isSub }),
  });

  return new Response(
    JSON.stringify({ success: true, orderId: order.id }),
    { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
  );
});
```

### 9.2 `send-order-email/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const BREVO_KEY = Deno.env.get('BREVO_API_KEY')!;

serve(async (req) => {
  const { email, items, total, isSub } = await req.json();

  const rows = items.map((i: any) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f0e8d8;font-size:14px">
        ${i.name} · ${i.flavor} · ${i.size}
      </td>
      <td style="padding:8px 0;border-bottom:1px solid #f0e8d8;text-align:right">×${i.qty}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f0e8d8;text-align:right;font-weight:600">
        KES ${(i.basePrice * i.qty).toLocaleString()}
      </td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:system-ui,sans-serif;background:#F4EDD6;margin:0;padding:20px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden">
    <div style="background:#0B1E12;padding:28px 24px;text-align:center">
      <div style="font-family:Georgia,serif;font-size:38px;color:#fff">
        Su<span style="color:#C9A020">Chai</span>
      </div>
      <div style="color:rgba(255,255,255,0.55);font-size:11px;letter-spacing:3px;margin-top:6px">
        ORDER CONFIRMED
      </div>
    </div>
    <div style="padding:28px 24px">
      <p style="font-size:15px;color:#0B1E12;margin-bottom:20px">
        Your SuChai order is confirmed${isSub ? ' (Subscribe &amp; Save 10%)' : ''}.
        We will be in touch shortly with delivery details.
      </p>
      <table style="width:100%;border-collapse:collapse">${rows}</table>
      <div style="border-top:2px solid #0B1E12;margin-top:16px;padding-top:14px;
                  display:flex;justify-content:space-between;align-items:baseline">
        <span style="font-weight:600;font-size:15px;color:#0B1E12">Total</span>
        <span style="font-weight:600;font-size:20px;color:#C9A020">
          KES ${total.toLocaleString()}
        </span>
      </div>
      ${isSub ? `<div style="background:#F4EDD6;border-radius:8px;padding:12px 16px;
                              margin-top:16px;font-size:13px;color:#1C4730">
        ✓ You saved 10% with Subscribe &amp; Save!
      </div>` : ''}
    </div>
    <div style="background:#F4EDD6;padding:20px 24px;text-align:center">
      <div style="font-size:12px;color:#8A7A6A">
        Afams Limited · Nairobi, Kenya<br>
        <a href="https://afams.co.ke" style="color:#C9A020">afams.co.ke</a> ·
        <a href="mailto:orders@afams.co.ke" style="color:#C9A020">orders@afams.co.ke</a>
      </div>
    </div>
  </div>
</body></html>`;

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method:  'POST',
    headers: { 'api-key': BREVO_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender:      { name: 'SuChai by Afams', email: 'orders@afams.co.ke' },
      to:          [{ email }],
      subject:     '✓ Your SuChai order is confirmed',
      htmlContent: html,
    }),
  });

  return new Response(
    JSON.stringify({ sent: res.ok }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
```

---

## 10. Supabase Schema Migrations

Run via `execute_sql` using the Supabase MCP tool. Project: `dvquyzzqsnlcassvgdzz`.

### 10.1 Update orders table

```sql
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS subscription  boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS sub_discount  integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS phone         text;
```

### 10.2 Create order_items table

```sql
CREATE TABLE IF NOT EXISTS order_items (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid        REFERENCES orders(id) ON DELETE CASCADE,
  product_id  text        NOT NULL,
  variety     text        NOT NULL CHECK (variety IN ('rtd', 'ordinary')),
  flavor      text        NOT NULL CHECK (flavor  IN ('plain', 'ginger', 'lemon')),
  size        text        NOT NULL CHECK (size    IN ('50g', '100g', '150g', '200g', '250g')),
  unit_price  integer     NOT NULL,
  quantity    integer     NOT NULL DEFAULT 1,
  line_total  integer     GENERATED ALWAYS AS (unit_price * quantity) STORED,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
```

### 10.3 Update site_config

```sql
-- Disable pre-order mode (SuChai goes live)
INSERT INTO site_config (key, value)
VALUES ('pre_order_mode', 'false')
ON CONFLICT (key) DO UPDATE SET value = 'false';

-- Add SuChai config entries
INSERT INTO site_config (key, value)
VALUES
  ('brand_name',             'SuChai'),
  ('subscribe_discount_pct', '10'),
  ('suchai_active',          'true')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

---

## 11. `vercel.json`

```json
{
  "rewrites": [
    { "source": "/p",        "destination": "/product.html" },
    { "source": "/admin-qr", "destination": "/admin-qr.html" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options",  "value": "nosniff" },
        { "key": "X-Frame-Options",          "value": "DENY" },
        { "key": "Referrer-Policy",          "value": "strict-origin-when-cross-origin" }
      ]
    }
  ]
}
```

---

## 12. Environment Secrets

Set in Supabase Dashboard → Project Settings → Edge Functions → Secrets.

| Key                         | Source                          |
|-----------------------------|---------------------------------|
| `PAYSTACK_SECRET_KEY`       | Paystack Dashboard → API Keys   |
| `BREVO_API_KEY`             | Brevo Dashboard → API Keys      |
| `SUPABASE_URL`              | `https://dvquyzzqsnlcassvgdzz.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API       |

**In `index.html` `<head>`** (public-safe only):
```js
window.__PAYSTACK_PUBLIC_KEY = 'pk_live_XXXX'; // NOT the secret key
window.__SUPABASE_URL        = 'https://dvquyzzqsnlcassvgdzz.supabase.co';
window.__SUPABASE_ANON_KEY   = 'eyJ...';        // anon key, not service role
```

---

## 13. Implementation Checklist

### Phase 1 — Core UI
- [ ] Delete all legacy-brand HTML, CSS, JS, and images
- [ ] Implement new `assets/css/main.css` with design tokens (Section 3)
- [ ] Build `index.html` per sections 5.1–5.3
- [ ] Build `assets/js/products.js` (catalogue, cart, render, events)
- [ ] Build `assets/js/checkout.js` (Paystack flow)
- [ ] Wire filter tabs, size selectors, add-to-cart, cart panel
- [ ] Wire cart-toggle and cart-close in nav
- [ ] Implement subscribe toggle (one-time / sub 10%)
- [ ] Test all UI flows locally

### Phase 2 — Product Info & QR
- [ ] Build `product.html` (mobile-first QR scan page per Section 6)
- [ ] Build `assets/js/product-page.js` (URL param parsing, DOM population)
- [ ] Build `admin-qr.html` (QR generator per Section 7)
- [ ] Test QR generation with `qrcode.js`
- [ ] Download test PNG and scan with phone → verify product.html loads correctly
- [ ] Test freshness logic (expired vs. valid date)

### Phase 3 — Backend
- [ ] Run SQL migrations via Supabase MCP `execute_sql`
- [ ] Deploy `paystack-webhook` Edge Function
- [ ] Deploy `send-order-email` Edge Function
- [ ] Set all environment secrets in Supabase dashboard
- [ ] Test webhook end-to-end with a Paystack test transaction
- [ ] Verify order row + order_items rows appear in Supabase
- [ ] Verify Brevo email is received

### Phase 4 — Polish & Launch
- [ ] Replace SVG fallback images with real product photos in `assets/img/products/`
- [ ] Create `og-suchai.jpg` (1200×630) for social sharing
- [ ] Update `vercel.json`
- [ ] Push `feat/suchai-overhaul` → PR to `main` → review → merge
- [ ] Verify `afams.co.ke` resolves correctly on Cloudflare
- [ ] End-to-end smoke test on live domain (product grid, checkout, QR scan, email)

---

## 14. Notes & Gotchas

- **Paystack amount:** Always multiply KES by `100` before passing to `PaystackPop.setup()`.
- **Supabase MCP:** Use `execute_sql`, never `apply_migration`.
- **QR URL encoding:** Always `encodeURIComponent()` batch and date params.
- **Product images:** Until photos are ready, the JS SVG fallback renders automatically.
  When photos are added, set correct `src` path — no code changes required.
- **Subscription model:** The 10% discount is applied client-side for display.
  The webhook receives the *post-discount* amount from Paystack (what was actually charged).
  Record `sub_discount` separately in the orders table for accounting.
- **Admin QR page:** Keep `admin-qr.html` out of the nav and sitemap. It's an ops tool.
  Optionally protect with a simple password prompt in JS.
- **Node version:** Must be **24.x** on Vercel (set in `package.json` engines or Vercel settings).

---

*End of SUCHAI_PROMPT.md — Afams Limited · SuChai Overhaul*
