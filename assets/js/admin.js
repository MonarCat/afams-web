/* ── AFAMS LTD · Admin Dashboard JS · 2026 ── */

// ── CONFIG ──────────────────────────────────────────────────────────
const CFG_URL_KEY = 'afams_admin_supabase_url';
const CFG_KEY_KEY = 'afams_admin_supabase_key';

let supabase = null;
let allOrders = [];

// ── INIT ─────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  const url = localStorage.getItem(CFG_URL_KEY);
  const key = localStorage.getItem(CFG_KEY_KEY);

  if (!url || !key) {
    showOverlay('config-overlay');
    return;
  }

  initSupabase(url, key);
});

function initSupabase(url, key) {
  supabase = window.supabase.createClient(url, key);
  checkSession();
}

// ── SUPABASE CONFIG ──────────────────────────────────────────────────
function saveConfig() {
  const url = document.getElementById('cfg-url').value.trim();
  const key = document.getElementById('cfg-key').value.trim();

  if (!url || !key) {
    showAdminToast('⚠️ Please fill in both fields');
    return;
  }

  localStorage.setItem(CFG_URL_KEY, url);
  localStorage.setItem(CFG_KEY_KEY, key);
  hideOverlay('config-overlay');
  initSupabase(url, key);
}

function showConfig() {
  document.getElementById('cfg-url').value = localStorage.getItem(CFG_URL_KEY) || '';
  document.getElementById('cfg-key').value = localStorage.getItem(CFG_KEY_KEY) || '';
  showOverlay('config-overlay');
  hideOverlay('login-overlay');
}

// ── AUTH ─────────────────────────────────────────────────────────────
async function checkSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    showDashboard();
  } else {
    showOverlay('login-overlay');
  }
}

async function signIn() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');

  errEl.style.display = 'none';

  if (!email || !password) {
    errEl.textContent = 'Please enter your email and password.';
    errEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Signing in…';

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  btn.disabled = false;
  btn.textContent = 'Sign in';

  if (error) {
    errEl.textContent = error.message;
    errEl.style.display = 'block';
    return;
  }

  hideOverlay('login-overlay');
  showDashboard();
}

async function signOut() {
  await supabase.auth.signOut();
  hideLayout();
  showOverlay('login-overlay');
}

// ── LAYOUT HELPERS ────────────────────────────────────────────────────
function showOverlay(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'flex';
}
function hideOverlay(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}
function showDashboard() {
  document.getElementById('admin-layout').style.display = 'grid';
  setView('orders');
  loadOrders();
}
function hideLayout() {
  document.getElementById('admin-layout').style.display = 'none';
}

// ── VIEWS ─────────────────────────────────────────────────────────────
function setView(view) {
  document.querySelectorAll('.sidebar-link').forEach(el => el.classList.remove('active'));
  document.getElementById('view-orders').style.display = view === 'orders' ? 'block' : 'none';
  document.getElementById('view-analytics').style.display = view === 'analytics' ? 'block' : 'none';

  if (view === 'orders') {
    document.getElementById('view-title').textContent = 'Orders';
    document.getElementById('view-sub').textContent = 'All customer pre-orders';
    document.querySelector('[onclick="setView(\'orders\')"]').classList.add('active');
    loadOrders();
  } else {
    document.getElementById('view-title').textContent = 'Analytics';
    document.getElementById('view-sub').textContent = 'Revenue and order insights';
    document.querySelector('[onclick="setView(\'analytics\')"]').classList.add('active');
    loadAnalytics();
  }
}

// ── ORDERS ────────────────────────────────────────────────────────────
async function loadOrders() {
  const paymentFilter = document.getElementById('filter-payment')?.value;
  const orderFilter   = document.getElementById('filter-order')?.value;

  showTableState('loading');

  let query = supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (paymentFilter) query = query.eq('payment_status', paymentFilter);
  if (orderFilter)   query = query.eq('order_status', orderFilter);

  const { data, error } = await query;

  if (error) {
    showAdminToast('⚠️ Failed to load orders: ' + error.message);
    showTableState('empty');
    return;
  }

  allOrders = data || [];
  renderStats(allOrders);
  renderTable(allOrders);
}

function filterTable() {
  const search = document.getElementById('filter-search')?.value.toLowerCase() || '';
  if (!search) {
    renderTable(allOrders);
    return;
  }
  const filtered = allOrders.filter(o =>
    (o.customer_name || '').toLowerCase().includes(search) ||
    (o.phone         || '').toLowerCase().includes(search) ||
    (o.paystack_reference || '').toLowerCase().includes(search) ||
    (o.email         || '').toLowerCase().includes(search)
  );
  renderTable(filtered);
}

function renderStats(orders) {
  const paid    = orders.filter(o => o.payment_status === 'paid');
  const pending = orders.filter(o => o.payment_status === 'pending');
  const revenue = paid.reduce((sum, o) => sum + (o.total_amount || 0), 0);

  document.getElementById('stat-total-orders').textContent = orders.length;
  document.getElementById('stat-paid').textContent = paid.length;
  document.getElementById('stat-revenue').textContent = 'KES ' + revenue.toLocaleString();
  document.getElementById('stat-pending').textContent = pending.length;
}

function renderTable(orders) {
  const tbody = document.getElementById('orders-body');

  if (!orders.length) {
    showTableState('empty');
    return;
  }

  showTableState('table');
  tbody.innerHTML = orders.map(o => {
    const date = new Date(o.created_at).toLocaleDateString('en-KE', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
    return `
      <tr data-id="${o.id}">
        <td data-label="Reference"><span class="order-ref">${o.paystack_reference || '—'}</span></td>
        <td data-label="Customer">
          <div class="customer-name">${escapeHtml(o.customer_name || '—')}</div>
          <div class="customer-phone">${escapeHtml(o.email || '')}</div>
        </td>
        <td data-label="Phone">${escapeHtml(o.phone || '—')}</td>
        <td data-label="Location">${escapeHtml(o.location || '—')}</td>
        <td data-label="Amount">KES ${(o.total_amount || 0).toLocaleString()}</td>
        <td data-label="Payment"><span class="badge badge-${o.payment_status || 'pending'}">${o.payment_status || 'pending'}</span></td>
        <td data-label="Status">
          <select class="status-select" id="status-${o.id}">
            ${['pending','confirmed','processing','shipped','delivered'].map(s =>
              `<option value="${s}" ${o.order_status === s ? 'selected' : ''}>${s}</option>`
            ).join('')}
          </select>
        </td>
        <td data-label="Date">${date}</td>
        <td data-label="Action">
          <div class="action-cell">
            <button class="btn-update" onclick="updateOrderStatus('${o.id}')">Update</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function updateOrderStatus(orderId) {
  const select = document.getElementById('status-' + orderId);
  if (!select) return;
  const newStatus = select.value;

  const { error } = await supabase
    .from('orders')
    .update({ order_status: newStatus })
    .eq('id', orderId);

  if (error) {
    showAdminToast('⚠️ Update failed: ' + error.message);
    return;
  }

  showAdminToast('✓ Order status updated to ' + newStatus);
  // Refresh badge in row
  const row = select.closest('tr');
  if (row) {
    const badge = row.querySelector('.badge:not(.badge-paid):not(.badge-pending):not(.badge-failed)');
    // No payment badge to update here — just reload to be safe
  }
  // Update local cache
  const cached = allOrders.find(o => o.id === orderId);
  if (cached) cached.order_status = newStatus;
}

function showTableState(state) {
  document.getElementById('table-loading').style.display = state === 'loading' ? 'block' : 'none';
  document.getElementById('orders-table').style.display  = state === 'table'   ? 'table' : 'none';
  document.getElementById('table-empty').style.display  = state === 'empty'   ? 'block' : 'none';
}

// ── ANALYTICS ────────────────────────────────────────────────────────
async function loadAnalytics() {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*');

  if (error) {
    showAdminToast('⚠️ Failed to load analytics: ' + error.message);
    return;
  }

  const total   = orders.length;
  const paid    = orders.filter(o => o.payment_status === 'paid');
  const revenue = paid.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const avg     = paid.length ? Math.round(revenue / paid.length) : 0;
  const convPct = total ? Math.round((paid.length / total) * 100) : 0;

  document.getElementById('an-total').textContent   = total;
  document.getElementById('an-revenue').textContent = 'KES ' + revenue.toLocaleString();
  document.getElementById('an-avg').textContent     = 'KES ' + avg.toLocaleString();
  document.getElementById('an-conversion').textContent = convPct + '%';

  // Status breakdown
  const statusCount = {};
  orders.forEach(o => { statusCount[o.order_status] = (statusCount[o.order_status] || 0) + 1; });
  const locationCount = {};
  orders.forEach(o => {
    const loc = o.location || 'Unknown';
    locationCount[loc] = (locationCount[loc] || 0) + 1;
  });

  const breakdown = document.getElementById('analytics-breakdown');
  breakdown.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem">
      <div>
        <h3>Orders by Status</h3>
        ${Object.entries(statusCount).sort((a,b)=>b[1]-a[1]).map(([k,v]) => `
          <div class="breakdown-row">
            <span class="breakdown-label"><span class="badge badge-${k}">${k}</span></span>
            <span class="breakdown-val">${v}</span>
          </div>`).join('')}
      </div>
      <div>
        <h3>Orders by Location</h3>
        ${Object.entries(locationCount).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([k,v]) => `
          <div class="breakdown-row">
            <span class="breakdown-label">${escapeHtml(k)}</span>
            <span class="breakdown-val">${v}</span>
          </div>`).join('')}
      </div>
    </div>
  `;
}

// ── UTILS ─────────────────────────────────────────────────────────────
function showAdminToast(msg) {
  const el = document.getElementById('admin-toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3500);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
