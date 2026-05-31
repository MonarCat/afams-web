const PRODUCTS = [
  { id: 'rtd-plain', variety: 'rtd', flavor: 'plain', name: 'SuChai Classic', tagline: 'The original. Bold, clean, no sieving.', rating: 4.9, reviews: 284, badge: 'Best Seller', badgeGold: false, image: 'assets/img/products/rtd-plain.jpg' },
  { id: 'rtd-ginger', variety: 'rtd', flavor: 'ginger', name: 'SuChai Tangawizi', tagline: 'RTD with a warm ginger kick.', rating: 4.8, reviews: 196, badge: 'Fan Favourite', badgeGold: true, image: 'assets/img/products/rtd-ginger.jpg' },
  { id: 'rtd-lemon', variety: 'rtd', flavor: 'lemon', name: 'SuChai Lemon', tagline: 'Bright citrus, light and refreshing.', rating: 4.7, reviews: 143, badge: '', badgeGold: false, image: 'assets/img/products/rtd-lemon.jpg' },
  { id: 'ord-plain', variety: 'ordinary', flavor: 'plain', name: 'SuChai Traditional', tagline: 'For the jiko. Less sugar, full depth.', rating: 4.8, reviews: 221, badge: 'Classic', badgeGold: false, image: 'assets/img/products/ord-plain.jpg' },
  { id: 'ord-ginger', variety: 'ordinary', flavor: 'ginger', name: 'SuChai Tangawizi', tagline: 'Traditional brew with a ginger twist.', rating: 4.9, reviews: 178, badge: 'Fan Favourite', badgeGold: true, image: 'assets/img/products/ord-ginger.jpg' },
  { id: 'ord-lemon', variety: 'ordinary', flavor: 'lemon', name: 'SuChai Lemon', tagline: 'Ordinary brew, citrus brightened.', rating: 4.7, reviews: 102, badge: '', badgeGold: false, image: 'assets/img/products/ord-lemon.jpg' },
];

const PRICES = {
  rtd: { '50g': 120, '100g': 220, '150g': 310, '200g': 390, '250g': 460 },
  ordinary: { '50g': 100, '100g': 190, '150g': 275, '200g': 350, '250g': 415 },
};

const SIZES = ['50g', '100g', '150g', '200g', '250g'];
const DEFAULT_SIZE = '100g';
const FLAVOR_LABEL = { plain: 'Plain', ginger: 'Ginger (Tangawizi)', lemon: 'Lemon' };
const VARIETY_LABEL = { rtd: 'Ready to Drink', ordinary: 'Ordinary' };
const FLAVOR_ACCENT = { plain: '#C9A020', ginger: '#E07820', lemon: '#A0B808' };

let cart = [];
let subMode = 'once';
const selectedSize = {};
PRODUCTS.forEach((p) => (selectedSize[p.id] = DEFAULT_SIZE));

function starsHtml(rating) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
}

function fallbackSvg(p) {
  const accent = FLAVOR_ACCENT[p.flavor];
  const bg = p.variety === 'rtd' ? '#C9A020' : '#0B1E12';
  const pouch = p.variety === 'rtd' ? '#0B1E12' : '#C9A020';
  const text = p.variety === 'rtd' ? '#C9A020' : '#0B1E12';
  return `<svg viewBox="0 0 400 500" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${p.name}">
    <rect width="400" height="500" fill="${bg}"/>
    <path d="M90 85h220l-20 320H110z" fill="${pouch}"/>
    <rect x="110" y="200" width="180" height="22" rx="11" fill="${accent}"/>
    <text x="200" y="165" text-anchor="middle" fill="${text}" font-size="28" font-family="Georgia">SuChai</text>
    <text x="200" y="255" text-anchor="middle" fill="${text}" font-size="18" font-family="system-ui">${FLAVOR_LABEL[p.flavor]}</text>
  </svg>`;
}

function productCardHTML(p) {
  const sz = selectedSize[p.id] || DEFAULT_SIZE;
  const pr = PRICES[p.variety][sz];
  const ac = FLAVOR_ACCENT[p.flavor];
  const badgeHtml = p.badge ? `<div class="img-badge${p.badgeGold ? ' img-badge--gold' : ''}">${p.badge}</div>` : '';
  return `<div class="prod-card" data-variety="${p.variety}" id="card-${p.id}" role="listitem">
    <div class="prod-img">
      <img src="${p.image}" alt="${p.name} — SuChai ${FLAVOR_LABEL[p.flavor]}" loading="lazy" width="400" height="500"
      onerror="this.style.display='none';document.getElementById('fb-${p.id}').style.display='flex'">
      <div class="prod-img-fallback" id="fb-${p.id}" style="display:none" data-variety="${p.variety}" data-flavor="${p.flavor}">${fallbackSvg(p)}</div>
      ${badgeHtml}
    </div>
    <div class="prod-body">
      <div class="variety-badge variety-badge--${p.variety}">${VARIETY_LABEL[p.variety]}</div>
      <div class="prod-name">${p.name}</div>
      <div class="stars-row"><span class="stars" style="color:${ac}">${starsHtml(p.rating)}</span><span class="review-count">${p.rating} (${p.reviews})</span></div>
      <div class="prod-flavor">${FLAVOR_LABEL[p.flavor]}</div>
      <div class="size-row" id="sizes-${p.id}">${SIZES.map((size) => `<button class="sz-btn${size === sz ? ' active' : ''}" data-pid="${p.id}" data-size="${size}">${size}</button>`).join('')}</div>
      <div class="price-line"><span class="price" id="price-${p.id}">KES ${pr.toLocaleString()}</span><span class="price-note" id="pnote-${p.id}">${sz} pack</span></div>
      <button class="add-btn" data-pid="${p.id}" aria-label="Add ${p.name} to cart">+ Add to Cart</button>
    </div>
  </div>`;
}

function renderGrid() {
  const grid = document.getElementById('prod-grid');
  grid.innerHTML = PRODUCTS.map((p) => productCardHTML(p)).join('');
  wireCardEvents();
}

function wireCardEvents() {
  document.querySelectorAll('.sz-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pid = btn.dataset.pid;
      const size = btn.dataset.size;
      selectedSize[pid] = size;
      document.querySelectorAll(`#sizes-${pid} .sz-btn`).forEach((b) => b.classList.toggle('active', b.dataset.size === size));
      const p = PRODUCTS.find((x) => x.id === pid);
      document.getElementById(`price-${pid}`).textContent = `KES ${PRICES[p.variety][size].toLocaleString()}`;
      document.getElementById(`pnote-${pid}`).textContent = `${size} pack`;
    });
  });

  document.querySelectorAll('.add-btn').forEach((btn) => btn.addEventListener('click', () => addToCart(btn.dataset.pid)));
  document.querySelectorAll('.ftab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.ftab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const f = tab.dataset.filter;
      document.querySelectorAll('.prod-card').forEach((card) => {
        card.hidden = f !== 'all' && card.dataset.variety !== f;
      });
    });
  });
}

function effectivePrice(item) {
  return subMode === 'sub' ? Math.round(item.basePrice * 0.9) : item.basePrice;
}

function addToCart(pid) {
  const p = PRODUCTS.find((x) => x.id === pid);
  const sz = selectedSize[pid];
  const key = `${pid}-${sz}`;
  const existing = cart.find((i) => i.key === key);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ key, id: pid, variety: p.variety, flavor: p.flavor, size: sz, name: p.name, basePrice: PRICES[p.variety][sz], qty: 1 });
  }
  syncCartUI();
  renderCartItems();
  openCart();
  showToast(`${p.name} (${sz}) added`);
}

function removeCartItem(key) {
  cart = cart.filter((i) => i.key !== key);
  syncCartUI();
  renderCartItems();
}

function setSubMode(mode) {
  subMode = mode;
  document.getElementById('tog-once').classList.toggle('active', mode === 'once');
  document.getElementById('tog-sub').classList.toggle('active', mode === 'sub');
  syncCartUI();
  renderCartItems();
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
  el.innerHTML = cart.map((it) => `<div class="cart-item"><div class="ci-info"><div class="ci-name">${it.name} · ${FLAVOR_LABEL[it.flavor]}</div><div class="ci-sub">${it.size} × ${it.qty}</div></div><div class="ci-right"><div class="ci-price">KES ${(effectivePrice(it) * it.qty).toLocaleString()}</div><button class="ci-remove" onclick="removeCartItem('${it.key}')" aria-label="Remove item">🗑</button></div></div>`).join('');
}

function openCart() {
  const panel = document.getElementById('cart-panel');
  panel.classList.add('open');
  panel.removeAttribute('aria-hidden');
}

function closeCart() {
  const panel = document.getElementById('cart-panel');
  panel.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');
}

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

document.addEventListener('DOMContentLoaded', () => {
  renderGrid();
  document.getElementById('cart-toggle').addEventListener('click', openCart);
  document.getElementById('cart-close').addEventListener('click', closeCart);
  syncCartUI();
  renderCartItems();
});
