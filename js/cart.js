// cart.js — Afams global cart manager
// Include in ALL pages via <script src="/js/cart.js"></script>
// Cart state stored in sessionStorage (resets on tab close — intentional for e-commerce flow)

const CART_KEY        = 'afams_cart';
const PROSOIL_SKU     = 'PS-25KG';

// ── Cart schema version ────────────────────────────────────────────────────────
// Bump this whenever a catalog change could make an existing sessionStorage cart
// stale/incompatible (e.g. bulk SKU/price restructuring). getCart() will discard
// any cart stored under an older version instead of trying to carry it forward,
// which prevents malformed legacy items (e.g. old string-formatted prices) from
// silently corrupting totals after a catalog update.
const CART_SCHEMA_VERSION = 2;

function parseCartNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : NaN;
  }
  if (typeof value === 'string') {
    var trimmed = value.trim();
    if (!trimmed) return NaN;
    var normalized = trimmed.replace(/[^0-9.-]/g, '');
    if (!normalized || normalized === '-' || normalized === '.' || normalized === '-.') {
      return NaN;
    }
    var parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  return NaN;
}

// ── Cart shape ────────────────────────────────────────────────────────────────
// {
//   items: [
//     {
//       sku: 'FB-CLS-01',
//       name: 'FarmBag Classic',
//       unit_price: 7500,
//       qty: 1,
//       image: 'assets/images/farmbag-classic.jpg',
//       type: 'farmbag' | 'prosoil' | 'product'
//     }
//   ],
//   prosoilPromoBags: 0,
// }

function getCart() {
  try {
    var data = JSON.parse(sessionStorage.getItem(CART_KEY));
    if (!data) return { items: [], _v: CART_SCHEMA_VERSION };

    // Discard carts saved under an older schema version — safer than trying to
    // migrate unknown legacy shapes forward. sessionStorage is short-lived by
    // design, so this only ever affects a customer mid-session during/just
    // after a deploy, never a returning customer.
    if (data._v !== CART_SCHEMA_VERSION) {
      console.warn('[Afams] Discarding stale cart (schema v' + data._v + ' vs current v' + CART_SCHEMA_VERSION + ')');
      sessionStorage.removeItem(CART_KEY);
      return { items: [], _v: CART_SCHEMA_VERSION };
    }

    // Normalise legacy items that were stored with `price` instead of `unit_price`
    data.items = (data.items || []).map(function(item) {
      if (item.unit_price == null) {
        item = Object.assign({}, item, { unit_price: item.price || 0 });
      }
      return item;
    });
    return data;
  } catch {
    return { items: [], _v: CART_SCHEMA_VERSION };
  }
}

function saveCart(cart) {
  cart._v = CART_SCHEMA_VERSION;
  sessionStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartBadge();
  dispatchCartEvent(cart);
}

// Shared upsert logic — the ONLY place an item is merged/pushed into the cart
// array. Both cart.js's addToCart() and app.js's addToCart() call this instead
// of each maintaining their own copy of the merge logic, so the two can never
// silently diverge again.
function upsertCartItem(cart, item) {
  const existing = cart.items.find(function(i) { return i.sku === item.sku; });
  if (existing) {
    existing.qty += (item.qty || 1);
  } else {
    cart.items.push(Object.assign({}, item, { qty: item.qty || 1 }));
  }
  return cart;
}

// ── Free Seed Promo — shared across all pages ─────────────────────────────────
// Single source of truth for the seed catalog and the "pick up to 2 free seed
// packets" picker. Previously this only existed inside products.html, so the
// promo only ever fired when a FarmBag was added from that page's own product
// grid — adding a FarmBag from index.html, prosoil.html, or a checkout.html
// deep-link never showed it. Living here means every page that includes
// cart.js (all of them) gets the same behaviour automatically.
const SEED_PRODUCTS = [
  // --- VEGETABLES ---
  { id: 'seed-kale-sukuma-wiki',         name: 'Sukuma Wiki (Kale)',            category: 'Seeds', price: 40, unit: 'packet', sku: 'SD-KAL-SW-001', description: 'High-yield, heat-tolerant kale. Matures in 6–8 weeks.', seedGroup: 'Vegetables', type: 'seed' },
  { id: 'seed-kale-pasolata',            name: 'Kale Pasolata',                  category: 'Seeds', price: 40, unit: 'packet', sku: 'SD-KAL-PA-001', description: 'Italian lacinato-type kale. Dark, tender leaves.', seedGroup: 'Vegetables', type: 'seed' },
  { id: 'seed-kale-thousand-headed',     name: 'Thousand Headed Kale',           category: 'Seeds', price: 40, unit: 'packet', sku: 'SD-KAL-TH-001', description: 'Prolific multi-shoot variety. Great for continuous harvest.', seedGroup: 'Vegetables', type: 'seed' },
  { id: 'seed-spinach-prickly',          name: 'Spinach (Prickly)',              category: 'Seeds', price: 40, unit: 'packet', sku: 'SD-SPN-PR-001', description: 'Fast-growing, high iron. Ideal for containers.', seedGroup: 'Vegetables', type: 'seed' },
  { id: 'seed-spinach-f1',               name: 'Spinach F1 Hybrid',              category: 'Seeds', price: 55, unit: 'packet', sku: 'SD-SPN-F1-001', description: 'Uniform, bolt-resistant F1. Suited to Nairobi conditions.', seedGroup: 'Vegetables', type: 'seed' },
  { id: 'seed-amaranth-local',           name: 'Amaranth (Terere) Local',        category: 'Seeds', price: 35, unit: 'packet', sku: 'SD-AMR-LO-001', description: 'Indigenous leafy green. Fast, nutritious, drought-tolerant.', seedGroup: 'Vegetables', type: 'seed' },
  { id: 'seed-amaranth-f1',              name: 'Amaranth F1 Hybrid',             category: 'Seeds', price: 50, unit: 'packet', sku: 'SD-AMR-F1-001', description: 'High-yield F1 amaranth. Excellent for urban farms.', seedGroup: 'Vegetables', type: 'seed' },
  { id: 'seed-ethiopian-kale',           name: 'Ethiopian Kale (Gitembe)',       category: 'Seeds', price: 40, unit: 'packet', sku: 'SD-ETK-GI-001', description: 'Mild flavour, fast maturing. Popular in Kenyan households.', seedGroup: 'Vegetables', type: 'seed' },
  { id: 'seed-cabbage-gloria',           name: 'Cabbage Gloria F1',              category: 'Seeds', price: 60, unit: 'packet', sku: 'SD-CAB-GL-001', description: 'Compact, dense head. Disease-resistant F1.', seedGroup: 'Vegetables', type: 'seed' },
  { id: 'seed-cabbage-drumhead',         name: 'Cabbage Drumhead',               category: 'Seeds', price: 50, unit: 'packet', sku: 'SD-CAB-DH-001', description: 'Classic large-head variety. Good for open pollination.', seedGroup: 'Vegetables', type: 'seed' },
  { id: 'seed-broccoli-green-magic',     name: 'Broccoli Green Magic F1',        category: 'Seeds', price: 70, unit: 'packet', sku: 'SD-BRO-GM-001', description: 'Tight, blue-green heads. Excellent shelf life.', seedGroup: 'Vegetables', type: 'seed' },
  { id: 'seed-cauliflower-snowball',     name: 'Cauliflower Snowball',           category: 'Seeds', price: 60, unit: 'packet', sku: 'SD-CAU-SB-001', description: 'Pure white curds. Best in cool highland conditions.', seedGroup: 'Vegetables', type: 'seed' },
  { id: 'seed-lettuce-greatlakes',       name: 'Lettuce Great Lakes',            category: 'Seeds', price: 40, unit: 'packet', sku: 'SD-LET-GL-001', description: 'Crisp iceberg-type. Superb for grow bags.', seedGroup: 'Vegetables', type: 'seed' },
  { id: 'seed-lettuce-lollo-rossa',      name: 'Lettuce Lollo Rossa',            category: 'Seeds', price: 45, unit: 'packet', sku: 'SD-LET-LR-001', description: 'Frilly red-leaf lettuce. Decorative and tasty.', seedGroup: 'Vegetables', type: 'seed' },
  { id: 'seed-lettuce-butterhead',       name: 'Lettuce Butterhead',             category: 'Seeds', price: 45, unit: 'packet', sku: 'SD-LET-BH-001', description: 'Soft, buttery leaves. Loose-head type, easy to grow.', seedGroup: 'Vegetables', type: 'seed' },
  { id: 'seed-swiss-chard-rainbow',      name: 'Swiss Chard Rainbow',            category: 'Seeds', price: 50, unit: 'packet', sku: 'SD-SCH-RB-001', description: 'Multi-coloured stems. Ornamental and edible.', seedGroup: 'Vegetables', type: 'seed' },
  { id: 'seed-bok-choy',                 name: 'Bok Choy',                        category: 'Seeds', price: 45, unit: 'packet', sku: 'SD-BOK-CH-001', description: 'Fast-maturing Asian green. Ideal for small containers.', seedGroup: 'Vegetables', type: 'seed' },
  { id: 'seed-spring-onion',             name: 'Spring Onion',                    category: 'Seeds', price: 35, unit: 'packet', sku: 'SD-SPO-ON-001', description: 'Bunching type. Continuous harvest in 6 weeks.', seedGroup: 'Vegetables', type: 'seed' },
  { id: 'seed-onion-red-creole',         name: 'Onion Red Creole',               category: 'Seeds', price: 40, unit: 'packet', sku: 'SD-ONI-RC-001', description: 'Pungent, firm bulbs. Well-adapted to Kenyan conditions.', seedGroup: 'Vegetables', type: 'seed' },
  { id: 'seed-tomato-anna-f1',           name: 'Tomato Anna F1',                 category: 'Seeds', price: 70, unit: 'packet', sku: 'SD-TOM-AN-001', description: 'Determinate, high-yield. Resistant to Fusarium and TMV.', seedGroup: 'Vegetables', type: 'seed' },
  { id: 'seed-tomato-money-maker',       name: 'Tomato Money Maker',             category: 'Seeds', price: 55, unit: 'packet', sku: 'SD-TOM-MM-001', description: 'Classic open-pollinated. Large, meaty fruits.', seedGroup: 'Vegetables', type: 'seed' },
  { id: 'seed-tomato-cherry-f1',         name: 'Tomato Cherry F1',               category: 'Seeds', price: 75, unit: 'packet', sku: 'SD-TOM-CH-001', description: 'Sweet cherry tomatoes. Prolific producer in containers.', seedGroup: 'Vegetables', type: 'seed' },
  { id: 'seed-capsicum-california',      name: 'Capsicum California Wonder',     category: 'Seeds', price: 60, unit: 'packet', sku: 'SD-CAP-CW-001', description: 'Large blocky sweet pepper. Thick walls, mild flavour.', seedGroup: 'Vegetables', type: 'seed' },
  { id: 'seed-chilli-pilipili',          name: 'Chilli Pilipili Kichaa',         category: 'Seeds', price: 40, unit: 'packet', sku: 'SD-CHL-PK-001', description: 'Hot local chilli. Very productive in small pots.', seedGroup: 'Vegetables', type: 'seed' },
  { id: 'seed-cucumber-poinsette',       name: 'Cucumber Poinsette',             category: 'Seeds', price: 55, unit: 'packet', sku: 'SD-CUC-PO-001', description: 'Straight, dark-green fruits. Disease-tolerant.', seedGroup: 'Vegetables', type: 'seed' },
  { id: 'seed-courgette-zucchini',       name: 'Courgette / Zucchini',           category: 'Seeds', price: 60, unit: 'packet', sku: 'SD-COU-ZU-001', description: 'Fast-fruiting. Perfect for vertical grow bags.', seedGroup: 'Vegetables', type: 'seed' },
  { id: 'seed-peas-sugar-snap',          name: 'Peas Sugar Snap',                category: 'Seeds', price: 50, unit: 'packet', sku: 'SD-PEA-SS-001', description: 'Edible pod peas. Sweet and crunchy straight from the vine.', seedGroup: 'Vegetables', type: 'seed' },
  { id: 'seed-french-beans-Amy',         name: 'French Beans Amy',               category: 'Seeds', price: 50, unit: 'packet', sku: 'SD-FRB-AM-001', description: 'Fine stringless pods. Widely grown for local and export.', seedGroup: 'Vegetables', type: 'seed' },
  { id: 'seed-climbing-beans-rosecoco',  name: 'Climbing Beans Rosecoco',        category: 'Seeds', price: 45, unit: 'packet', sku: 'SD-CLB-RC-001', description: 'Dual-purpose: green pods and dry beans.', seedGroup: 'Vegetables', type: 'seed' },
  // --- HERBS ---
  { id: 'seed-coriander',                name: 'Coriander (Dhania)',             category: 'Seeds', price: 35, unit: 'packet', sku: 'SD-HRB-CO-001', description: 'Essential Kenyan herb. Grow in any container.', seedGroup: 'Herbs', type: 'seed' },
  { id: 'seed-basil-sweet',              name: 'Basil Sweet',                     category: 'Seeds', price: 40, unit: 'packet', sku: 'SD-HRB-BA-001', description: 'Aromatic Italian basil. Perfect companion for tomatoes.', seedGroup: 'Herbs', type: 'seed' },
  { id: 'seed-parsley-plain',            name: 'Parsley Plain Leaf',              category: 'Seeds', price: 40, unit: 'packet', sku: 'SD-HRB-PA-001', description: 'Flat-leaf Italian parsley. Rich in vitamins C and K.', seedGroup: 'Herbs', type: 'seed' },
  { id: 'seed-dill',                     name: 'Dill',                            category: 'Seeds', price: 40, unit: 'packet', sku: 'SD-HRB-DI-001', description: 'Feathery aromatic herb. Great for salads and pickling.', seedGroup: 'Herbs', type: 'seed' },
  { id: 'seed-mint-peppermint',          name: 'Mint Peppermint',                category: 'Seeds', price: 40, unit: 'packet', sku: 'SD-HRB-MI-001', description: 'Vigorous spreader — best in its own container.', seedGroup: 'Herbs', type: 'seed' },
  { id: 'seed-rosemary',                 name: 'Rosemary',                        category: 'Seeds', price: 45, unit: 'packet', sku: 'SD-HRB-RO-001', description: 'Woody, drought-tolerant herb. Long-lived perennial.', seedGroup: 'Herbs', type: 'seed' },
  { id: 'seed-thyme',                    name: 'Thyme',                           category: 'Seeds', price: 45, unit: 'packet', sku: 'SD-HRB-TH-001', description: 'Low-growing, compact. Excellent in herb grow bags.', seedGroup: 'Herbs', type: 'seed' },
  { id: 'seed-sage',                     name: 'Sage',                            category: 'Seeds', price: 45, unit: 'packet', sku: 'SD-HRB-SA-001', description: 'Silvery aromatic leaves. Perennial in Nairobi conditions.', seedGroup: 'Herbs', type: 'seed' },
  { id: 'seed-chives',                   name: 'Chives',                          category: 'Seeds', price: 40, unit: 'packet', sku: 'SD-HRB-CH-001', description: 'Mild onion flavour. Compact and easy in containers.', seedGroup: 'Herbs', type: 'seed' },
  // --- FRUIT VEGETABLES ---
  { id: 'seed-watermelon-sugar-baby',    name: 'Watermelon Sugar Baby',          category: 'Seeds', price: 55, unit: 'packet', sku: 'SD-WMN-SB-001', description: 'Compact 2–3 kg melons. Ideal for small urban plots.', seedGroup: 'Fruit Vegetables', type: 'seed' },
  { id: 'seed-pumpkin-local',            name: 'Pumpkin Local (Malenge)',        category: 'Seeds', price: 40, unit: 'packet', sku: 'SD-PMP-LO-001', description: 'Fast-growing, high-yield. Leaves also edible.', seedGroup: 'Fruit Vegetables', type: 'seed' },
  { id: 'seed-okra-clemson-spineless',   name: 'Okra Clemson Spineless',         category: 'Seeds', price: 40, unit: 'packet', sku: 'SD-OKR-CS-001', description: 'Tender, ribbed pods. Heat-loving and productive.', seedGroup: 'Fruit Vegetables', type: 'seed' },
  // --- MICROGREENS ---
  { id: 'seed-micro-radish',             name: 'Microgreens Radish',             category: 'Seeds', price: 50, unit: 'packet', sku: 'SD-MCR-RA-001', description: 'Ready in 7 days. Peppery, nutrient-dense.', seedGroup: 'Microgreens', type: 'seed' },
  { id: 'seed-micro-sunflower',          name: 'Microgreens Sunflower',          category: 'Seeds', price: 55, unit: 'packet', sku: 'SD-MCR-SU-001', description: 'Crunchy, nutty flavour. High in vitamins B and D.', seedGroup: 'Microgreens', type: 'seed' },
  { id: 'seed-micro-wheatgrass',         name: 'Microgreens Wheatgrass',         category: 'Seeds', price: 50, unit: 'packet', sku: 'SD-MCR-WG-001', description: 'Detox superfood. Harvest in 10 days.', seedGroup: 'Microgreens', type: 'seed' },
  { id: 'seed-micro-peas',               name: 'Microgreens Pea Shoots',         category: 'Seeds', price: 55, unit: 'packet', sku: 'SD-MCR-PS-001', description: 'Sweet tender shoots. High in vitamins C and A.', seedGroup: 'Microgreens', type: 'seed' },
  // --- ROOTS & BULBS ---
  { id: 'seed-carrot-nantes',            name: 'Carrot Nantes',                  category: 'Seeds', price: 45, unit: 'packet', sku: 'SD-CRT-NA-001', description: 'Cylindrical, sweet roots. Deep containers required.', seedGroup: 'Roots & Bulbs', type: 'seed' },
  { id: 'seed-radish-scarlet-globe',     name: 'Radish Scarlet Globe',           category: 'Seeds', price: 35, unit: 'packet', sku: 'SD-RAD-SG-001', description: 'Ready in 25 days. Ideal quick-win crop for beginners.', seedGroup: 'Roots & Bulbs', type: 'seed' },
  { id: 'seed-beetroot-detroit',         name: 'Beetroot Detroit Dark Red',      category: 'Seeds', price: 45, unit: 'packet', sku: 'SD-BET-DD-001', description: 'Globe-shaped, deep red. Tops also edible as greens.', seedGroup: 'Roots & Bulbs', type: 'seed' },
  { id: 'seed-turnip-purple-top',        name: 'Turnip Purple Top',              category: 'Seeds', price: 40, unit: 'packet', sku: 'SD-TRN-PT-001', description: 'Dual-use root and leaf vegetable. Fast maturing.', seedGroup: 'Roots & Bulbs', type: 'seed' },
];

function isFarmBagProduct(item) {
  return (item && (
    (typeof item.id === 'string' && item.id.indexOf('farmbag-') === 0) ||
    item.category === 'FarmBags' ||
    (typeof item.sku === 'string' && item.sku.indexOf('FB-') === 0) ||
    item.type === 'farmbag'
  ));
}

function groupSeedProductsBySubCategory() {
  return SEED_PRODUCTS.reduce(function(acc, seed) {
    var group = seed.seedGroup || 'Seeds';
    if (!acc[group]) acc[group] = [];
    acc[group].push(seed);
    return acc;
  }, {});
}

let freeSeedModalEl = null;

function ensureFreeSeedsModal() {
  if (freeSeedModalEl) return freeSeedModalEl;
  freeSeedModalEl = document.createElement('div');
  freeSeedModalEl.id = 'free-seeds-modal';
  freeSeedModalEl.style.cssText = 'position:fixed;inset:0;background:rgba(7,26,11,0.55);z-index:10000;display:none;align-items:center;justify-content:center;padding:16px;';
  freeSeedModalEl.innerHTML = `
    <div style="background:#fff;border-radius:12px;max-width:760px;width:100%;max-height:88vh;overflow:auto;padding:16px 16px 14px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:10px;">
        <div>
          <h3 style="margin:0 0 4px;font-size:1rem;color:#071A0B;">Pick up to 2 free seed packets</h3>
          <p style="margin:0;font-size:0.82rem;color:#64748b;">Optional FarmBag promo. Selected packets are added to cart at KES 0.</p>
        </div>
        <button type="button" id="free-seeds-close" style="border:none;background:transparent;font-size:1.2rem;cursor:pointer;line-height:1;">×</button>
      </div>
      <div id="free-seeds-groups"></div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:12px;">
        <span id="free-seeds-counter" style="font-size:0.8rem;color:#475569;">0 selected</span>
        <div style="display:flex;gap:8px;">
          <button type="button" id="free-seeds-skip" class="btn-order" style="background:#64748b;">Skip</button>
          <button type="button" id="free-seeds-confirm" class="btn-order">Add selected seeds</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(freeSeedModalEl);
  return freeSeedModalEl;
}

function triggerFreeSeedsPicker(maxFree) {
  const modal = ensureFreeSeedsModal();
  if (modal.style.display === 'flex') return;
  const groupsWrap = modal.querySelector('#free-seeds-groups');
  const counter = modal.querySelector('#free-seeds-counter');
  const grouped = groupSeedProductsBySubCategory();
  const selected = new Set();

  function closeModal() {
    modal.style.display = 'none';
  }

  function rerenderState() {
    const selectedCount = selected.size;
    counter.textContent = selectedCount + ' selected';
    modal.querySelectorAll('input[type="checkbox"][data-seed-id]').forEach(function(input) {
      if (!input.checked && selectedCount >= maxFree) {
        input.disabled = true;
      } else {
        input.disabled = false;
      }
    });
  }

  groupsWrap.innerHTML = Object.keys(grouped).map(function(groupName) {
    const items = grouped[groupName];
    return '<div style="border:1px solid #e2e8f0;border-radius:10px;padding:10px;margin-bottom:10px;">'
      + '<div style="font-size:0.82rem;font-weight:700;color:#155D27;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">' + groupName + '</div>'
      + items.map(function(seed) {
        return '<label style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px dashed #edf2f7;">'
          + '<span style="font-size:0.84rem;color:#1f2937;">' + seed.name + '</span>'
          + '<input type="checkbox" data-seed-id="' + seed.id + '" />'
          + '</label>';
      }).join('')
      + '</div>';
  }).join('');

  groupsWrap.querySelectorAll('input[type="checkbox"][data-seed-id]').forEach(function(input) {
    input.addEventListener('change', function() {
      const id = input.dataset.seedId;
      if (input.checked) selected.add(id);
      else selected.delete(id);
      rerenderState();
    });
  });

  modal.querySelector('#free-seeds-close').onclick = closeModal;
  modal.querySelector('#free-seeds-skip').onclick = closeModal;
  modal.querySelector('#free-seeds-confirm').onclick = function() {
    const cart = getCart();
    Array.from(selected).forEach(function(seedId, index) {
      const seed = SEED_PRODUCTS.find(function(s) { return s.id === seedId; });
      if (!seed) return;
      const counterVal = (window.__afamsFreeSeedCounter = (window.__afamsFreeSeedCounter || 0) + 1);
      const uniqueSuffix = (window.crypto && typeof window.crypto.randomUUID === 'function')
        ? window.crypto.randomUUID()
        : (Date.now() + '-' + counterVal + '-' + index);
      cart.items.push({
        id: seed.id,
        slug: seed.id,
        sku: seed.sku + '-FREE-' + uniqueSuffix,
        name: seed.name,
        unit_price: 0,
        price: 0,
        qty: 1,
        image: '',
        type: 'seed',
        category: 'Seeds',
        freePromo: true
      });
    });
    saveCart(cart);
    closeModal();
  };

  rerenderState();
  modal.style.display = 'flex';
}

function addToCart(item) {
  // item: { sku, name, unit_price, qty, image, type }
  const cart = getCart();
  upsertCartItem(cart, item);
  cart.prosoilPromoBags = computeProsoilPromo(cart);
  saveCart(cart);
  showCartToast(item.name);
  if (isFarmBagProduct(item)) {
    triggerFreeSeedsPicker(2);
  }
}

function removeFromCart(sku) {
  const cart = getCart();
  cart.items = cart.items.filter(function(i) { return i.sku !== sku; });
  cart.prosoilPromoBags = computeProsoilPromo(cart);
  saveCart(cart);
}

function updateQty(sku, qty) {
  if (qty <= 0) { return removeFromCart(sku); }
  const cart = getCart();
  const item = cart.items.find(function(i) { return i.sku === sku; });
  if (item) { item.qty = qty; }
  cart.prosoilPromoBags = computeProsoilPromo(cart);
  saveCart(cart);
}

function clearCart() {
  sessionStorage.removeItem(CART_KEY);
  updateCartBadge();
}

function computeProsoilPromo(cart) {
  var prosoilItem = cart.items.find(function(i) { return i.sku === PROSOIL_SKU; });
  if (!prosoilItem) return 0;
  return 0;
}

// ── Cart Totals ───────────────────────────────────────────────────────────────
function getCartTotals(cart) {
  cart = cart || getCart();
  var invalidItems    = [];
  var itemsTotal      = (cart.items || []).reduce(function(sum, i, index) {
    var price = parseCartNumber(i && i.unit_price);
    var qtyRaw = parseCartNumber(i && i.qty);
    var qty = Number.isFinite(qtyRaw) ? Math.floor(qtyRaw) : NaN;

    if (!Number.isFinite(price) || !Number.isFinite(qty) || price < 0 || qty <= 0) {
      invalidItems.push({
        index: index,
        sku: i && i.sku ? i.sku : '',
        unit_price: i && i.unit_price,
        qty: i && i.qty
      });
      return sum;
    }
    return sum + (price * qty);
  }, 0);
  if (invalidItems.length > 0) {
    console.error('[Afams] Invalid cart item(s) excluded from total:', invalidItems);
  }
  var promoQty        = cart.prosoilPromoBags || computeProsoilPromo(cart);
  var promoSaving     = 0;
  var grandTotal      = itemsTotal;
  return {
    itemsTotal: itemsTotal,
    promoSaving: promoSaving,
    promoQty: promoQty,
    grandTotal: grandTotal,
    hasInvalidItems: invalidItems.length > 0,
    invalidItems: invalidItems
  };
}

// ── UI Helpers ────────────────────────────────────────────────────────────────
function updateCartBadge() {
  var cart       = getCart();
  var totalItems = cart.items.reduce(function(sum, i) { return sum + i.qty; }, 0);
  document.querySelectorAll('.cart-badge').forEach(function(el) {
    el.textContent     = totalItems;
    el.style.display   = totalItems > 0 ? 'flex' : 'none';
  });
  // Also update older .cart-count elements used in index.html nav
  document.querySelectorAll('.cart-count').forEach(function(el) {
    el.textContent   = totalItems;
    el.style.display = totalItems > 0 ? 'flex' : 'none';
  });
}

function showCartToast(productName) {
  var toast = document.getElementById('cart-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'cart-toast';
    toast.style.cssText = [
      'position:fixed', 'bottom:24px', 'right:24px', 'z-index:9999',
      'background:#2D6A4F', 'color:#fff', 'padding:12px 20px',
      'border-radius:10px', "font-family:'DM Sans',system-ui,sans-serif",
      'font-size:0.88rem', 'box-shadow:0 4px 16px rgba(0,0,0,0.18)',
      'display:flex', 'align-items:center', 'gap:10px',
      'transform:translateY(80px)', 'transition:transform 0.3s ease',
      'max-width:320px'
    ].join(';');
    document.body.appendChild(toast);
  }
  toast.innerHTML = '✓ <strong>' + productName + '</strong> added&nbsp;·&nbsp;'
    + '<a href="checkout.html" style="color:#fff;text-decoration:underline;">Checkout</a>';
  requestAnimationFrame(function() { toast.style.transform = 'translateY(0)'; });
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(function() { toast.style.transform = 'translateY(80px)'; }, 3500);
}

function dispatchCartEvent(cart) {
  window.dispatchEvent(new CustomEvent('afams:cart-updated', { detail: cart }));
}

// ── Initialise badge on page load ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', updateCartBadge);
