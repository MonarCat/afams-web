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

function addToCart(item) {
  // item: { sku, name, unit_price, qty, image, type }
  const cart = getCart();
  upsertCartItem(cart, item);
  cart.prosoilPromoBags = computeProsoilPromo(cart);
  saveCart(cart);
  showCartToast(item.name);
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
