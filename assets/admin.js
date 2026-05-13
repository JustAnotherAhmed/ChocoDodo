// Admin panel logic — Dashboard / Products / Orders / Users / Settings.

// Same-origin relative URLs by default — works on Railway/any host AND localhost.
const API_BASE = window.CHOCODODO_API_BASE || '';
const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => [...p.querySelectorAll(s)];

function toast(msg, icon = '✓') {
  const el = $('#toast');
  if (!el) return;
  el.innerHTML = `<span>${icon}</span> ${msg}`;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2400);
}

async function api(path, opts = {}) {
  const res = await fetch(API_BASE + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

const escapeHtml = (s = '') => String(s).replace(/[&<>"']/g, c => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));

const fmtMoney = (cents, ccy = 'EGP') => {
  const v = cents / 100;
  return `${Number.isInteger(v) ? v : v.toFixed(2)} ${ccy.toUpperCase()}`;
};
const fmtDate = (s) => new Date(s + 'Z').toLocaleString();

// ============= BOOT =============
(async function boot() {
  // Verify STAFF session (separate auth domain)
  let me;
  try {
    const data = await api('/api/staff/me');
    me = data.user;
  } catch {
    location.href = 'staff-login.html';
    return;
  }
  if (me.role !== 'admin' && me.role !== 'staff') {
    toast('Staff only — redirecting', '🚫');
    setTimeout(() => location.href = 'staff-login.html', 1200);
    return;
  }
  $('#meEmail').textContent = me.email + ' (' + me.role + ')';

  // Tabs
  $$('.admin-tab').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Logout (staff)
  $('#logoutLink')?.addEventListener('click', async (e) => {
    e.preventDefault();
    try { await api('/api/staff/logout', { method: 'POST' }); } catch {}
    location.href = '../index.html';
  });

  // Initial load — wrap each step so one broken init doesn't cascade
  const safe = async (label, fn) => {
    try { await fn(); }
    catch (e) { console.error(`[admin] ${label} failed:`, e); toast(`${label} failed: ${e.message}`, '⚠️'); }
  };
  await safe('categories',   loadCategories);
  await safe('dashboard',    loadDashboard);
  safe('products',           loadProducts);
  safe('orders',             loadOrders);
  safe('staff',              loadStaff);
  safe('customers',          loadCustomers);
  safe('reviews',            loadReviews);
  safe('slots',              loadSlots);
  safe('settings',           loadSettings);
  // Init each modal independently
  for (const [name, init] of [
    ['productModal',  initProductModal],
    ['categoryModal', initCategoryModal],
    ['inviteModal',   initInviteModal],
    ['slotModal',     initSlotModal],
    ['customerModal', initCustomerModal],
  ]) {
    try { init(); }
    catch (e) { console.error(`[admin] init ${name} failed:`, e); }
  }
})().catch(err => {
  console.error('admin boot failed:', err);
  toast('Failed to load admin: ' + err.message, '⚠️');
});

function switchTab(name) {
  $$('.admin-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  $$('.admin-section').forEach(s => s.classList.toggle('active', s.dataset.section === name));
}

// ============= DASHBOARD =============
async function loadDashboard() {
  try {
    const s = await api('/api/admin/stats');
    $('#statRevenue').textContent = (s.revenue_total_egp || 0).toLocaleString();
    $('#statOrdersToday').textContent = s.orders_today;
    $('#statOrdersTotal').textContent = s.orders_total;
    $('#statPaid').textContent = s.paid_orders;
    $('#statPending').textContent = s.pending_orders;
    $('#statProducts').textContent = s.products_count;
    $('#statUsers').textContent = s.users_count;

    // Low stock widget
    const lowWrap = $('#lowStockWidget');
    if (s.low_stock && s.low_stock.length > 0) {
      lowWrap.style.display = 'block';
      $('#lowStockList').innerHTML = s.low_stock.map(p => `
        <div class="low-stock-row">
          <div>
            <strong>${escapeHtml(p.name)}</strong>
            <code class="muted">${escapeHtml(p.id)}</code>
          </div>
          <div class="low-stock-count ${p.stock === 0 ? 'out' : 'low'}">
            ${p.stock === 0 ? 'Out of stock' : `${p.stock} left`}
          </div>
        </div>
      `).join('');
    } else if (lowWrap) {
      lowWrap.style.display = 'none';
    }

    const { orders } = await api('/api/admin/orders?limit=10');
    $('#recentOrders').innerHTML = renderOrdersTable(orders.slice(0, 10), { compact: true });
    bindOrderRowActions();
  } catch (err) {
    toast(err.message, '⚠️');
  }
}

// ============= CATEGORIES =============
let _categories = [];

async function loadCategories() {
  try {
    const { categories } = await api('/api/admin/categories');
    _categories = categories;
    renderCategoriesTable();
    populateCategoryDropdown();
  } catch (err) {
    if ($('#categoriesTable')) $('#categoriesTable').innerHTML = `<p class="muted">Error: ${escapeHtml(err.message)}</p>`;
  }
}

function renderCategoriesTable() {
  const wrap = $('#categoriesTable');
  if (!wrap) return;
  if (!_categories.length) {
    wrap.innerHTML = '<p class="muted">No categories yet — click "Add category" to create one.</p>';
    return;
  }
  wrap.innerHTML = `
    <table class="admin-table">
      <thead><tr>
        <th>Emoji</th><th>ID</th><th>Name (EN)</th><th>Name (AR)</th><th>Sort</th><th>Status</th><th></th>
      </tr></thead>
      <tbody>
        ${_categories.map(c => `
          <tr>
            <td style="font-size:1.5rem;">${escapeHtml(c.emoji || '🍫')}</td>
            <td><code>${escapeHtml(c.id)}</code></td>
            <td><strong>${escapeHtml(c.name_en)}</strong></td>
            <td lang="ar" dir="rtl">${escapeHtml(c.name_ar || '—')}</td>
            <td>${c.sort_order}</td>
            <td><span class="toggle-btn ${c.published ? 'on' : 'off'}">${c.published ? 'Published' : 'Hidden'}</span></td>
            <td><button class="btn-link" data-edit-cat="${escapeHtml(c.id)}">Edit</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  $$('[data-edit-cat]', wrap).forEach(b => b.addEventListener('click', () => openCategoryModal(b.dataset.editCat)));
}

function populateCategoryDropdown() {
  const sel = $('#pf_cat');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = _categories
    .map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.emoji)} ${escapeHtml(c.name_en)} (${escapeHtml(c.id)})</option>`)
    .join('');
  if (current && _categories.some(c => c.id === current)) sel.value = current;
}

function initCategoryModal() {
  const modal = $('#categoryModal');
  if (!modal) return;
  $$('[data-modal-close]', modal).forEach(b => b.addEventListener('click', () => closeModal(modal)));
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(modal); });

  $('#addCategoryBtn').addEventListener('click', () => openCategoryModal(null));
  $('#categoryForm').addEventListener('submit', saveCategory);
  $('#cf_delete').addEventListener('click', deleteCategory);
}

function openCategoryModal(id) {
  const modal = $('#categoryModal');
  const form = $('#categoryForm');
  form.reset();
  $('#cf_error').textContent = '';

  if (id) {
    const c = _categories.find(x => x.id === id);
    if (!c) return toast('Category not found', '⚠️');
    $('#cmTitle').textContent = `Edit · ${c.name_en}`;
    $('#cf_mode').value = 'edit';
    $('#cf_id').value = c.id;
    $('#cf_id').disabled = true;
    $('#cf_name_en').value = c.name_en;
    $('#cf_name_ar').value = c.name_ar || '';
    $('#cf_emoji').value = c.emoji || '🍫';
    $('#cf_sort').value = c.sort_order ?? 100;
    $('#cf_pub').value = c.published ? '1' : '0';
    $('#cf_delete').style.display = '';
  } else {
    $('#cmTitle').textContent = 'Add new category';
    $('#cf_mode').value = 'create';
    $('#cf_id').disabled = false;
    $('#cf_emoji').value = '🍫';
    $('#cf_sort').value = 100;
    $('#cf_pub').value = '1';
    $('#cf_delete').style.display = 'none';
  }
  modal.setAttribute('aria-hidden', 'false');
  modal.classList.add('open');
}

async function saveCategory(e) {
  e.preventDefault();
  const id = $('#cf_id').value.trim().toLowerCase();
  const isEdit = $('#cf_mode').value === 'edit';
  const payload = {
    id,
    name_en: $('#cf_name_en').value.trim(),
    name_ar: $('#cf_name_ar').value.trim(),
    emoji: $('#cf_emoji').value.trim() || '🍫',
    sort_order: Number($('#cf_sort').value || 0),
    published: $('#cf_pub').value === '1',
  };
  try {
    if (isEdit) {
      await api(`/api/admin/categories/${encodeURIComponent(id)}`, {
        method: 'PUT', body: JSON.stringify(payload),
      });
      toast('Category updated ✓');
    } else {
      await api('/api/admin/categories', {
        method: 'POST', body: JSON.stringify(payload),
      });
      toast('Category created ✓');
    }
    closeModal($('#categoryModal'));
    await loadCategories();
  } catch (err) {
    $('#cf_error').textContent = err.message;
  }
}

async function deleteCategory() {
  const id = $('#cf_id').value;
  if (!confirm(`Delete category "${id}"? Make sure no products use it.`)) return;
  try {
    await api(`/api/admin/categories/${encodeURIComponent(id)}`, { method: 'DELETE' });
    toast('Category deleted');
    closeModal($('#categoryModal'));
    await loadCategories();
  } catch (err) { $('#cf_error').textContent = err.message; }
}

// ============= INVITE USER =============
function initInviteModal() {
  const modal = $('#inviteModal');
  if (!modal) return;
  $$('[data-modal-close]', modal).forEach(b => b.addEventListener('click', () => closeModal(modal)));
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(modal); });

  $('#inviteUserBtn').addEventListener('click', () => {
    $('#inviteForm').reset();
    $('#iv_error').textContent = '';
    $('#iv_success').style.display = 'none';
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('open');
  });

  $('#inviteForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#iv_error').textContent = '';
    try {
      const data = await api('/api/admin/staff/invite', {
        method: 'POST',
        body: JSON.stringify({
          email: $('#iv_email').value.trim(),
          name: $('#iv_name').value.trim(),
          role: $('#iv_role').value,
        }),
      });
      $('#iv_success').style.display = 'block';
      $('#iv_link').textContent = data.invite_link;
      toast('Invitation sent ✓');
      loadStaff();
    } catch (err) {
      $('#iv_error').textContent = err.message;
    }
  });
}

// ============= PRODUCTS =============
let _products = [];
let _optionsBuilder = null;

async function loadProducts() {
  try {
    const { products } = await api('/api/admin/products');
    _products = products;
    $('#productsTable').innerHTML = renderProductsTable(products);
    $$('#productsTable [data-edit]').forEach(b => b.addEventListener('click', () => openProductModal(b.dataset.edit)));
    $$('#productsTable [data-toggle]').forEach(b => b.addEventListener('click', () => togglePublished(b.dataset.toggle)));
  } catch (err) {
    $('#productsTable').innerHTML = `<p class="muted">Error: ${escapeHtml(err.message)}</p>`;
  }
}

function renderProductsTable(products) {
  if (!products.length) return `<p class="muted">No products yet — click "Add product" to create one.</p>`;
  return `
    <table class="admin-table">
      <thead><tr>
        <th>Image</th><th>ID</th><th>Name</th><th>Category</th><th>Price</th>
        <th>Stock</th><th>Options</th><th>Published</th><th></th>
      </tr></thead>
      <tbody>
        ${products.map(p => {
          const imgUrl = p.image ? '../' + p.image : '';
          let stockCell = '<span class="muted">∞</span>';
          if (p.track_stock) {
            const cls = p.stock === 0 ? 'out' : (p.stock <= p.low_stock_at ? 'low' : 'ok');
            stockCell = `<span class="stock-pill ${cls}">${p.stock}</span>`;
          }
          return `
            <tr>
              <td>
                ${imgUrl
                  ? `<img src="${escapeHtml(imgUrl)}" alt="" class="admin-thumb" onerror="this.style.display='none'" />`
                  : '<span class="admin-thumb-empty">—</span>'}
              </td>
              <td><code>${escapeHtml(p.id)}</code></td>
              <td>
                <strong>${escapeHtml(p.name)}</strong>
                ${p.name_ar ? `<br/><small lang="ar" dir="rtl">${escapeHtml(p.name_ar)}</small>` : ''}
                ${p.badge ? `<span class="pill ${p.badge}">${p.badge}</span>` : ''}
              </td>
              <td>${escapeHtml(p.cat)}${p.sub ? ` · ${escapeHtml(p.sub)}` : ''}</td>
              <td><strong>${p.price} EGP</strong></td>
              <td>${stockCell}</td>
              <td>${p.options?.groups?.length ? `${p.options.groups.length} group(s)` : '—'}</td>
              <td>
                <button class="toggle-btn ${p.published ? 'on' : 'off'}" data-toggle="${escapeHtml(p.id)}">
                  ${p.published ? 'Published' : 'Draft'}
                </button>
              </td>
              <td><button class="btn-link" data-edit="${escapeHtml(p.id)}">Edit</button></td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

async function togglePublished(id) {
  const product = _products.find(p => p.id === id);
  if (!product) return;
  try {
    await api(`/api/admin/products/${encodeURIComponent(id)}/published`, {
      method: 'PATCH',
      body: JSON.stringify({ published: !product.published }),
    });
    toast(`${id}: ${product.published ? 'unpublished' : 'published'}`);
    loadProducts();
  } catch (err) { toast(err.message, '⚠️'); }
}

// ----- modal -----
function initProductModal() {
  const modal = $('#productModal');
  $$('[data-modal-close]', modal).forEach(b => b.addEventListener('click', () => closeModal(modal)));
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(modal); });

  $('#addProductBtn').addEventListener('click', () => openProductModal(null));

  $('#productForm').addEventListener('submit', saveProduct);
  $('#pf_delete').addEventListener('click', deleteProduct);

  // Image upload
  $('#pf_uploadBtn').addEventListener('click', () => $('#pf_imageFile').click());
  $('#pf_imageFile').addEventListener('change', handleImageUpload);
  // Manual path edits update preview too
  $('#pf_image').addEventListener('input', () => updateImagePreview($('#pf_image').value));

  // Mount options builder
  const builderHost = $('#pf_optionsBuilder');
  if (builderHost && window.CHOCODODO_OPTIONS) {
    _optionsBuilder = window.CHOCODODO_OPTIONS.mount(builderHost);
  }

  $('#copyFillingsTpl').addEventListener('click', () => {
    $('#pf_options').value = JSON.stringify({
      groups: [{
        id: 'filling',
        label_en: 'Choose your filling',
        label_ar: 'اختر الحشوة',
        required: true,
        multi: false,
        choices: [
          { value: 'coffee',        label_en: 'Coffee',        label_ar: 'قهوة',                price_delta_minor: 0 },
          { value: 'caramel',       label_en: 'Caramel',       label_ar: 'كراميل',              price_delta_minor: 0 },
          { value: 'almond',        label_en: 'Almond',        label_ar: 'لوز',                 price_delta_minor: 0 },
          { value: 'hazelnut',      label_en: 'Hazelnut',      label_ar: 'بندق',                price_delta_minor: 0 },
          { value: 'cashew',        label_en: 'Cashew',        label_ar: 'كاجو',                price_delta_minor: 0 },
          { value: 'walnut',        label_en: 'Walnut',        label_ar: 'عين جمل',             price_delta_minor: 0 },
          { value: 'peanut',        label_en: 'Peanut',        label_ar: 'سوداني',              price_delta_minor: 0 },
          { value: 'pistachio',     label_en: 'Pistachio',     label_ar: 'بستاشيو',             price_delta_minor: 0 },
          { value: 'lotus',         label_en: 'Lotus',         label_ar: 'لوتس',                price_delta_minor: 0 },
          { value: 'peanut_butter', label_en: 'Peanut Butter', label_ar: 'زبدة فول سوداني',    price_delta_minor: 0 },
        ],
      }],
    }, null, 2);
  });
}

function openProductModal(id) {
  const modal = $('#productModal');
  const form = $('#productForm');
  form.reset();
  $('#pf_error').textContent = '';

  if (id) {
    const p = _products.find(x => x.id === id);
    if (!p) return toast('Product not found', '⚠️');
    $('#pmTitle').textContent = `Edit · ${p.name}`;
    $('#pf_mode').value = 'edit';
    $('#pf_id').value = p.id;
    $('#pf_id').disabled = true;
    $('#pf_cat').value = p.cat;
    $('#pf_sub').value = p.sub || '';
    $('#pf_price').value = p.price;
    $('#pf_name').value = p.name;
    $('#pf_name_ar').value = p.name_ar || '';
    $('#pf_desc').value = p.desc || '';
    $('#pf_desc_ar').value = p.desc_ar || '';
    $('#pf_emoji').value = p.emoji || '';
    $('#pf_badge').value = p.badge || '';
    $('#pf_image').value = p.image || '';
    $('#pf_sort').value = p.sort_order ?? 0;
    $('#pf_pub').value = p.published ? '1' : '0';
    $('#pf_trackStock').value = p.track_stock ? '1' : '0';
    $('#pf_stock').value = p.stock ?? 0;
    $('#pf_lowAt').value = p.low_stock_at ?? 5;
    if (_optionsBuilder) _optionsBuilder.set(p.options);
    $('#pf_delete').style.display = '';
    updateImagePreview(p.image);
  } else {
    $('#pmTitle').textContent = 'Add new product';
    $('#pf_mode').value = 'create';
    $('#pf_id').disabled = false;
    $('#pf_pub').value = '1';
    $('#pf_sort').value = 100;
    $('#pf_emoji').value = '🍫';
    $('#pf_trackStock').value = '0';
    $('#pf_stock').value = '0';
    $('#pf_lowAt').value = '5';
    if (_optionsBuilder) _optionsBuilder.set(null);
    $('#pf_delete').style.display = 'none';
    updateImagePreview('');
  }
  modal.setAttribute('aria-hidden', 'false');
  modal.classList.add('open');
}

function updateImagePreview(imagePath) {
  const wrap = $('#pf_imagePreview');
  if (!wrap) return;
  if (imagePath) {
    const url = imagePath.startsWith('http') ? imagePath : '../' + imagePath;
    wrap.innerHTML = `<img src="${escapeHtml(url)}" alt="preview" onerror="this.parentNode.innerHTML='<span class=\\'image-preview-empty\\'>Could not load image</span>'" />`;
  } else {
    wrap.innerHTML = '<span class="image-preview-empty">No image yet</span>';
  }
}

async function handleImageUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    $('#pf_error').textContent = 'Image is larger than 5 MB';
    e.target.value = '';
    return;
  }
  const fd = new FormData();
  fd.append('image', file);
  const productId = $('#pf_id').value || 'product';
  fd.append('product_id', productId);

  const btn = $('#pf_uploadBtn');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Uploading…';

  try {
    const res = await fetch(API_BASE + '/api/admin/upload/image', {
      method: 'POST',
      credentials: 'include',
      body: fd, // do NOT set Content-Type — browser sets multipart boundary
    });
    let data = null;
    try { data = await res.json(); } catch {}
    if (!res.ok) throw new Error(data?.error || `Upload failed (${res.status})`);

    $('#pf_image').value = data.path;
    updateImagePreview(data.path);
    toast('Image uploaded ✓');
  } catch (err) {
    $('#pf_error').textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
    e.target.value = '';
  }
}

function closeModal(m) {
  m.classList.remove('open');
  m.setAttribute('aria-hidden', 'true');
}

async function saveProduct(e) {
  e.preventDefault();
  const id = $('#pf_id').value.trim();
  const isEdit = $('#pf_mode').value === 'edit';

  let options = null;
  if (_optionsBuilder) {
    const errs = _optionsBuilder.validate();
    if (errs.length) {
      $('#pf_error').textContent = errs.join(' · ');
      return;
    }
    options = _optionsBuilder.get();
  }

  const payload = {
    id, cat: $('#pf_cat').value, sub: $('#pf_sub').value.trim() || null,
    name: $('#pf_name').value.trim(),
    name_ar: $('#pf_name_ar').value.trim(),
    price: Number($('#pf_price').value),
    desc: $('#pf_desc').value.trim(),
    desc_ar: $('#pf_desc_ar').value.trim(),
    emoji: $('#pf_emoji').value.trim() || '🍫',
    badge: $('#pf_badge').value || null,
    image: $('#pf_image').value.trim(),
    sort_order: Number($('#pf_sort').value || 0),
    published: $('#pf_pub').value === '1',
    track_stock: $('#pf_trackStock').value === '1',
    stock: Number($('#pf_stock').value || 0),
    low_stock_at: Number($('#pf_lowAt').value || 5),
    options,
  };

  try {
    if (isEdit) {
      await api(`/api/admin/products/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      toast('Product updated ✓');
    } else {
      await api('/api/admin/products', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      toast('Product created ✓');
    }
    closeModal($('#productModal'));
    loadProducts();
  } catch (err) {
    $('#pf_error').textContent = err.message;
  }
}

async function deleteProduct() {
  const id = $('#pf_id').value;
  if (!confirm(`Delete product "${id}"? This cannot be undone.`)) return;
  try {
    await api(`/api/admin/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
    toast('Product deleted');
    closeModal($('#productModal'));
    loadProducts();
  } catch (err) { toast(err.message, '⚠️'); }
}

// ============= ORDERS =============
async function loadOrders() {
  try {
    const { orders } = await api('/api/admin/orders');
    $('#ordersTable').innerHTML = renderOrdersTable(orders);
    bindOrderRowActions();
  } catch (err) {
    $('#ordersTable').innerHTML = `<p class="muted">Error: ${escapeHtml(err.message)}</p>`;
  }
}

const ORDER_STATUSES = [
  'pending', 'paid', 'cod-confirmed', 'preparing',
  'out-for-delivery', 'delivered', 'failed', 'refunded', 'cancelled'
];

const TRACKING_STATUSES = ['received', 'preparing', 'out_for_delivery', 'delivered'];
const TRACKING_LABELS = {
  received:        '📝 Received',
  preparing:       '👩‍🍳 Preparing',
  out_for_delivery:'🛵 Out for delivery',
  delivered:       '🎉 Delivered',
};

function renderOrdersTable(orders, opts = {}) {
  if (!orders.length) return `<p class="muted">No orders yet.</p>`;
  return `
    <table class="admin-table">
      <thead><tr>
        <th>Order</th><th>When</th><th>Customer</th>
        <th>Items</th><th>Pay</th><th>Payment status</th><th>📦 Tracking</th><th>Total</th>
      </tr></thead>
      <tbody>
        ${orders.map(o => {
          const items = o.items || JSON.parse(o.items_json || '[]');
          const list = items.map(i => `${escapeHtml(i.name)}×${i.qty}`).join(', ');
          const tStatus = o.tracking_status || 'received';
          return `
            <tr>
              <td><code>${escapeHtml(o.id)}</code></td>
              <td>${escapeHtml(fmtDate(o.created_at))}</td>
              <td>
                <strong>${escapeHtml(o.customer_name)}</strong><br/>
                <small>${escapeHtml(o.customer_email)}</small><br/>
                <small>📞 ${escapeHtml(o.customer_phone || '')}</small>
              </td>
              <td><small>${list}</small><br/><small class="muted">📍 ${escapeHtml(o.address || '')}</small>${o.notes ? `<br/><small class="note">📝 ${escapeHtml(o.notes)}</small>` : ''}</td>
              <td>${escapeHtml(o.payment_method)}</td>
              <td>
                <select class="status-select" data-order-status="${escapeHtml(o.id)}">
                  ${ORDER_STATUSES.map(s => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
              </td>
              <td>
                <select class="status-select tracking-select" data-order-tracking="${escapeHtml(o.id)}">
                  ${TRACKING_STATUSES.map(s => `<option value="${s}" ${s === tStatus ? 'selected' : ''}>${TRACKING_LABELS[s]}</option>`).join('')}
                </select>
              </td>
              <td><strong>${fmtMoney(o.total_cents, o.currency)}</strong></td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function bindOrderRowActions() {
  $$('[data-order-status]').forEach(sel => {
    sel.addEventListener('change', async () => {
      const id = sel.dataset.orderStatus;
      const status = sel.value;
      try {
        await api(`/api/admin/orders/${encodeURIComponent(id)}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        });
        toast(`${id} payment → ${status}`);
        loadDashboard();
      } catch (err) { toast(err.message, '⚠️'); }
    });
  });

  // Tracking status (separate from payment status)
  $$('[data-order-tracking]').forEach(sel => {
    sel.addEventListener('change', async () => {
      const id = sel.dataset.orderTracking;
      const tracking_status = sel.value;
      try {
        await api(`/api/admin/orders/${encodeURIComponent(id)}/tracking`, {
          method: 'PATCH',
          body: JSON.stringify({ tracking_status }),
        });
        toast(`${id} tracking → ${TRACKING_LABELS[tracking_status]}`);
      } catch (err) { toast(err.message, '⚠️'); }
    });
  });
}

// ============= STAFF (was Users) =============
async function loadStaff() { return loadUsers(); }
async function loadUsers() {
  try {
    const { staff: users } = await api('/api/admin/staff');
    $('#usersTable').innerHTML = `
      <table class="admin-table">
        <thead><tr><th>ID</th><th>Email</th><th>Name</th><th>Role</th><th>Status</th><th>Last login</th><th>Actions</th></tr></thead>
        <tbody>
          ${users.map(u => `
            <tr>
              <td>${u.id}</td>
              <td>${escapeHtml(u.email)}</td>
              <td>
                <span class="staff-name" data-edit-name="${u.id}" data-current="${escapeHtml(u.name || '')}" title="Click to edit name">${escapeHtml(u.name || '—')} ✏️</span>
              </td>
              <td>
                <select class="role-select" data-staff-role="${u.id}">
                  <option value="staff" ${u.role === 'staff' ? 'selected' : ''}>staff</option>
                  <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>admin</option>
                </select>
              </td>
              <td>${u.invite_accepted ? '✅ active' : '⏳ pending invite'}</td>
              <td>${u.last_login_at ? escapeHtml(fmtDate(u.last_login_at)) : '<span class="muted">never</span>'}</td>
              <td class="user-actions">
                <button class="btn-link" data-resend-reset="${u.id}" title="Send a password reset link">🔑 Reset</button>
                <button class="btn-link" data-resend-invite="${u.id}" title="Resend invite link">📧 Resend invite</button>
                <button class="btn-link danger" data-delete-user="${u.id}" data-user-email="${escapeHtml(u.email)}" title="Delete staff member">🗑 Delete</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    $$('[data-staff-role]').forEach(sel => {
      sel.addEventListener('change', async () => {
        const id = sel.dataset.staffRole;
        const role = sel.value;
        try {
          await api(`/api/admin/staff/${id}/role`, {
            method: 'PATCH', body: JSON.stringify({ role }),
          });
          toast(`Staff #${id} → ${role}`);
        } catch (err) { toast(err.message, '⚠️'); loadStaff(); }
      });
    });
    // Click name to edit (uses prompt — simple + works on mobile)
    $$('[data-edit-name]').forEach(span => {
      span.addEventListener('click', async () => {
        const id = span.dataset.editName;
        const current = span.dataset.current || '';
        const next = prompt('Edit staff name:', current);
        if (next === null) return;
        const trimmed = next.trim();
        if (trimmed.length < 2) { toast('Name too short', '⚠️'); return; }
        if (trimmed === current) return;
        try {
          await api(`/api/admin/staff/${id}`, {
            method: 'PATCH', body: JSON.stringify({ name: trimmed }),
          });
          toast('Name updated ✓');
          loadStaff();
        } catch (err) { toast(err.message, '⚠️'); }
      });
    });
    $$('[data-resend-reset]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Send a password reset link?')) return;
        try {
          const data = await api(`/api/admin/staff/${btn.dataset.resendReset}/resend-reset`, { method: 'POST' });
          if (data.emailed) toast('Reset email sent ✓');
          else prompt('SMTP not configured — copy this link manually:', data.link);
        } catch (err) { toast(err.message, '⚠️'); }
      });
    });
    $$('[data-resend-invite]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Resend the invite link?')) return;
        try {
          const data = await api(`/api/admin/staff/${btn.dataset.resendInvite}/resend-invite`, { method: 'POST' });
          if (data.emailed) toast('Invite resent ✓');
          else prompt('SMTP not configured — copy this link manually:', data.link);
        } catch (err) { toast(err.message, '⚠️'); }
      });
    });
    $$('[data-delete-user]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm(`Delete ${btn.dataset.userEmail}? Cannot be undone.`)) return;
        try {
          await api(`/api/admin/staff/${btn.dataset.deleteUser}`, { method: 'DELETE' });
          toast('Staff deleted');
          loadStaff();
        } catch (err) { toast(err.message, '⚠️'); }
      });
    });
  } catch (err) {
    $('#usersTable').innerHTML = `<p class="muted">Error: ${escapeHtml(err.message)}</p>`;
  }
}

// ============= CUSTOMERS =============
let _customers = [];

async function loadCustomers() {
  try {
    const { customers } = await api('/api/admin/customers');
    _customers = customers;
    if (!customers.length) {
      $('#customersTable').innerHTML = '<p class="muted">No customers yet — click "+ Add customer" to add one manually.</p>';
      return;
    }
    $('#customersTable').innerHTML = `
      <table class="admin-table">
        <thead><tr><th>Email</th><th>Name</th><th>Phone</th><th>Points 🎁</th><th>Joined</th><th>Verified</th><th>Actions</th></tr></thead>
        <tbody>
          ${customers.map(c => `
            <tr>
              <td>${escapeHtml(c.email)}</td>
              <td><span class="staff-name" data-edit-customer="${c.id}" title="Click to edit">${escapeHtml(c.name || '—')} ✏️</span></td>
              <td>${escapeHtml(c.phone || '—')}</td>
              <td><strong>${c.points || 0}</strong></td>
              <td><small>${escapeHtml(fmtDate(c.created_at))}</small></td>
              <td>
                ${c.email_verified
                  ? '<span class="pill new" style="background:#C8E6C9;color:#1B5E20;">✅ Verified</span>'
                  : `<button class="btn-link" data-verify-customer="${c.id}" data-customer-name="${escapeHtml(c.name || c.email)}">⏳ ✓ Verify</button>`}
              </td>
              <td class="user-actions">
                <button class="btn-link" data-grant-points="${c.id}">🎁 Points</button>
                <button class="btn-link" data-reset-customer="${c.id}" data-customer-name="${escapeHtml(c.name || c.email)}" title="Generate a fresh temporary password">🔑 Reset</button>
                <button class="btn-link danger" data-delete-customer="${c.id}" data-customer-name="${escapeHtml(c.name || c.email)}">🗑 Delete</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    $$('[data-edit-customer]').forEach(btn => {
      btn.addEventListener('click', () => openCustomerModal(Number(btn.dataset.editCustomer)));
    });
    $$('[data-verify-customer]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm(`Verify ${btn.dataset.customerName}? They'll be marked as verified and can place orders.`)) return;
        try {
          await api(`/api/admin/customers/${btn.dataset.verifyCustomer}/verify`, { method: 'POST' });
          toast('Customer verified ✅');
          loadCustomers();
        } catch (err) { toast(err.message, '⚠️'); }
      });
    });
    $$('[data-grant-points]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const points = parseInt(prompt('How many points to grant?'), 10);
        if (!points) return;
        try {
          await api(`/api/admin/customers/${btn.dataset.grantPoints}/grant-points`, {
            method: 'POST', body: JSON.stringify({ points }),
          });
          toast(`+${points} points 🎁`);
          loadCustomers();
        } catch (err) { toast(err.message, '⚠️'); }
      });
    });
    $$('[data-reset-customer]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm(`Generate a NEW temporary password for ${btn.dataset.customerName}? Their old password stops working.`)) return;
        try {
          const data = await api(`/api/admin/customers/${btn.dataset.resetCustomer}/reset-password`, { method: 'POST' });
          prompt(`New password for ${btn.dataset.customerName}. Copy & send it to them now — it's not stored in plain text:`, data.temp_password);
        } catch (err) { toast(err.message, '⚠️'); }
      });
    });
    $$('[data-delete-customer]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm(`Permanently delete ${btn.dataset.customerName}? This removes their account, addresses, and reviews. Order history stays for accounting.`)) return;
        try {
          await api(`/api/admin/customers/${btn.dataset.deleteCustomer}`, { method: 'DELETE' });
          toast('Customer deleted');
          loadCustomers();
        } catch (err) { toast(err.message, '⚠️'); }
      });
    });
  } catch (err) {
    $('#customersTable').innerHTML = `<p class="muted">Error: ${escapeHtml(err.message)}</p>`;
  }
}

function initCustomerModal() {
  const modal = $('#customerModal');
  if (!modal) return;
  $$('[data-modal-close]', modal).forEach(b => b.addEventListener('click', () => closeModal(modal)));
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(modal); });
  $('#addCustomerBtn')?.addEventListener('click', () => openCustomerModal(null));
  $('#customerForm').addEventListener('submit', saveCustomer);
  $('#cms_delete').addEventListener('click', deleteCustomerFromModal);
}

function openCustomerModal(id) {
  const modal = $('#customerModal');
  const form = $('#customerForm');
  form.reset();
  $('#cms_error').textContent = '';
  if (id) {
    const c = _customers.find(x => x.id === id);
    if (!c) return toast('Customer not found', '⚠️');
    $('#cmsTitle').textContent = `Edit · ${c.name || c.email}`;
    $('#cms_id').value = c.id;
    $('#cms_name').value = c.name || '';
    $('#cms_email').value = c.email || '';
    $('#cms_phone').value = stripEgPhone(c.phone || '');
    $('#cms_pwField').style.display = 'none';   // edit mode hides password field
    $('#cms_delete').style.display = '';
  } else {
    $('#cmsTitle').textContent = 'Add new customer';
    $('#cms_id').value = '';
    $('#cms_pwField').style.display = '';
    $('#cms_delete').style.display = 'none';
  }
  modal.setAttribute('aria-hidden', 'false');
  modal.classList.add('open');
}

function stripEgPhone(s) {
  if (!s) return '';
  const c = String(s).replace(/[\s\-()]/g, '');
  if (c.startsWith('+20')) return c.slice(3);
  if (c.startsWith('20'))  return c.slice(2);
  return c;
}

async function saveCustomer(e) {
  e.preventDefault();
  const id = $('#cms_id').value;
  const isEdit = !!id;
  const payload = {
    name: $('#cms_name').value.trim(),
    email: $('#cms_email').value.trim(),
    phone: $('#cms_phone').value.trim(),
  };
  if (!isEdit) payload.password = $('#cms_password').value.trim() || null;
  try {
    if (isEdit) {
      await api(`/api/admin/customers/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      toast('Customer updated ✓');
    } else {
      const data = await api('/api/admin/customers', { method: 'POST', body: JSON.stringify(payload) });
      if (data.temp_password) {
        prompt('Customer created. Their temporary password (copy & give them now — not stored in plain text):', data.temp_password);
      } else {
        toast('Customer created ✓');
      }
    }
    closeModal($('#customerModal'));
    loadCustomers();
  } catch (err) {
    $('#cms_error').textContent = err.message;
  }
}

async function deleteCustomerFromModal() {
  const id = $('#cms_id').value;
  if (!id) return;
  if (!confirm('Permanently delete this customer? Their addresses + reviews are removed; order history stays for accounting.')) return;
  try {
    await api(`/api/admin/customers/${id}`, { method: 'DELETE' });
    toast('Customer deleted');
    closeModal($('#customerModal'));
    loadCustomers();
  } catch (err) {
    $('#cms_error').textContent = err.message;
  }
}

// ============= REVIEWS =============
async function loadReviews() {
  try {
    const { reviews } = await api('/api/admin/reviews');
    if (!reviews.length) {
      $('#reviewsTable').innerHTML = '<p class="muted">No reviews yet — when customers leave one, it appears here automatically.</p>';
      return;
    }
    $('#reviewsTable').innerHTML = `
      <table class="admin-table">
        <thead><tr><th>Product</th><th>Customer</th><th>Rating</th><th>Title / body</th><th>When</th><th></th></tr></thead>
        <tbody>
          ${reviews.map(r => `
            <tr>
              <td><code>${escapeHtml(r.product_id)}</code></td>
              <td>${escapeHtml(r.customer_name || 'anon')}</td>
              <td>${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</td>
              <td><strong>${escapeHtml(r.title || '')}</strong><br><small>${escapeHtml((r.body || '').slice(0, 200))}</small></td>
              <td><small>${escapeHtml(fmtDate(r.created_at))}</small></td>
              <td>
                <button class="btn-link danger" data-delete-review="${r.id}" title="Remove this review">🗑 Delete</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    $$('[data-delete-review]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Delete this review? It will be removed from the product page.')) return;
      try { await api(`/api/admin/reviews/${b.dataset.deleteReview}`, { method: 'DELETE' }); toast('Review deleted'); loadReviews(); }
      catch (err) { toast(err.message, '⚠️'); }
    }));
  } catch (err) {
    $('#reviewsTable').innerHTML = `<p class="muted">Error: ${escapeHtml(err.message)}</p>`;
  }
}

// ============= DELIVERY SLOTS =============
async function loadSlots() {
  try {
    const { slots } = await api('/api/admin/slots');
    if (!slots.length) {
      $('#slotsTable').innerHTML = '<p class="muted">No slots yet — click "+ Add slot" to create one.</p>';
      return;
    }
    $('#slotsTable').innerHTML = `
      <table class="admin-table">
        <thead><tr><th>Label</th><th>Starts at</th><th>Capacity</th><th>Booked</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${slots.map(s => `
            <tr>
              <td><strong>${escapeHtml(s.label)}</strong></td>
              <td>${escapeHtml(fmtDate(s.starts_at))}</td>
              <td>${s.capacity}</td>
              <td>${s.booked} / ${s.capacity}</td>
              <td>
                <button class="toggle-btn ${s.enabled ? 'on' : 'off'}" data-toggle-slot="${s.id}" data-enabled="${s.enabled}">
                  ${s.enabled ? 'Enabled' : 'Disabled'}
                </button>
              </td>
              <td><button class="btn-link danger" data-delete-slot="${s.id}">🗑 Delete</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    $$('[data-toggle-slot]').forEach(b => b.addEventListener('click', async () => {
      try {
        await api(`/api/admin/slots/${b.dataset.toggleSlot}/enabled`, {
          method: 'PATCH', body: JSON.stringify({ enabled: b.dataset.enabled !== '1' }),
        });
        loadSlots();
      } catch (err) { toast(err.message, '⚠️'); }
    }));
    $$('[data-delete-slot]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Delete this slot?')) return;
      try { await api(`/api/admin/slots/${b.dataset.deleteSlot}`, { method: 'DELETE' }); toast('Slot deleted'); loadSlots(); }
      catch (err) { toast(err.message, '⚠️'); }
    }));
  } catch (err) {
    $('#slotsTable').innerHTML = `<p class="muted">Error: ${escapeHtml(err.message)}</p>`;
  }
}

function initSlotModal() {
  const modal = $('#slotModal');
  if (!modal) return;
  modal.querySelectorAll('[data-modal-close]').forEach(b => b.addEventListener('click', () => closeModal(modal)));
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(modal); });
  $('#addSlotBtn')?.addEventListener('click', () => {
    $('#slotForm').reset();
    $('#slot_error').textContent = '';
    modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false');
  });
  $('#slotForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/api/admin/slots', {
        method: 'POST',
        body: JSON.stringify({
          label: $('#slot_label').value.trim(),
          starts_at: $('#slot_starts').value,
          capacity: Number($('#slot_capacity').value),
        }),
      });
      toast('Slot created ✓');
      closeModal(modal);
      loadSlots();
    } catch (err) {
      $('#slot_error').textContent = err.message;
    }
  });
}

// ============= SETTINGS =============
async function loadSettings() {
  try {
    const cfg = await api('/api/config');
    $('#cfgCurrency').textContent = (cfg.currency || 'egp').toUpperCase();
    $('#cfgDelivery').textContent = `${(cfg.delivery_minor / 100).toFixed(2)} ${(cfg.currency || 'egp').toUpperCase()}`;
    $('#cfgTax').textContent = `${(cfg.tax_rate * 100).toFixed(1)}%`;
    $('#cfgDeposit').textContent = `${cfg.deposit_pct || 50}%`;
    $('#cfgTelegram').textContent = cfg.notifications?.telegram ? '✅ configured' : '⚠️  set TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID in .env';
    $('#cfgWhatsapp').textContent = cfg.notifications?.whatsapp ? '✅ CallMeBot ready' : '⚠️  set CALLMEBOT_PHONE + CALLMEBOT_API_KEY in .env';
    $('#cfgWaLink').textContent = cfg.notifications?.wa_link ? '✅ WHATSAPP_OWNER_NUMBER set' : '⚠️  set WHATSAPP_OWNER_NUMBER in .env';
    $('#cfgSmtp').textContent = cfg.notifications?.smtp ? '✅ configured' : '⚠️  prints to console (silent fallback)';

    // Theme override + Store info (both read from /api/admin/settings)
    const adminSettings = await api('/api/admin/settings');
    const settings = adminSettings.settings || {};
    const current = settings.theme_override || 'auto';
    $('#themeOverride').value = current;
    if (window.CHOCODODO_THEMES) {
      $('#themeAutoLabel').textContent = `Auto would currently pick: ${window.CHOCODODO_THEMES.detectTheme()}`;
    }

    // Store info fields
    if ($('#setStoreName'))      $('#setStoreName').value      = settings.store_name      || '';
    if ($('#setInstapayHandle')) $('#setInstapayHandle').value = settings.instapay_handle || '';
    if ($('#setInstagramHandle')) $('#setInstagramHandle').value = settings.instagram_handle || '';

    $('#saveStoreInfoBtn')?.addEventListener('click', async () => {
      const status = $('#saveStoreInfoStatus');
      const btn = $('#saveStoreInfoBtn');
      btn.disabled = true; btn.textContent = 'Saving…';
      status.textContent = '';
      try {
        const updates = [
          ['store_name',       $('#setStoreName').value.trim()],
          ['instapay_handle',  $('#setInstapayHandle').value.trim()],
          ['instagram_handle', $('#setInstagramHandle').value.trim()],
        ];
        for (const [key, value] of updates) {
          await api('/api/admin/settings/' + key, {
            method: 'PUT', body: JSON.stringify({ value }),
          });
        }
        status.textContent = '✅ Saved — customers see these on the next page load.';
        toast('Store info saved ✓');
      } catch (err) {
        status.textContent = '❌ ' + err.message;
        toast(err.message, '⚠️');
      } finally {
        btn.disabled = false; btn.textContent = 'Save store info';
      }
    });
    // Test notification button
    $('#testNotifyBtn')?.addEventListener('click', async () => {
      const btn = $('#testNotifyBtn');
      const out = $('#testNotifyResult');
      btn.disabled = true; btn.textContent = '⏳ Sending…';
      out.style.display = 'block';
      out.textContent = 'Sending test notifications…';
      try {
        const r = await api('/api/admin/notify/test', { method: 'POST' });
        const fmt = (label, res) => {
          const ok = res?.ok;
          const reason = res?.reason || '';
          return `${ok ? '✅' : '⚠️'}  ${label}: ${ok ? 'sent' : reason}`;
        };
        out.textContent = [
          fmt('Telegram (owner)', r.telegram),
          fmt('WhatsApp (owner)', r.whatsapp),
          fmt('Email (owner)',    r.email),
        ].join('\n');
        toast('Test notifications fired — check your phone/inbox');
      } catch (err) {
        out.textContent = '❌ ' + err.message;
        toast(err.message, '⚠️');
      } finally {
        btn.disabled = false; btn.textContent = '🧪 Send test notification';
      }
    });

    $('#saveThemeBtn').addEventListener('click', async () => {
      const value = $('#themeOverride').value;
      try {
        await api('/api/admin/settings/theme_override', {
          method: 'PUT', body: JSON.stringify({ value }),
        });
        toast('Theme saved ✓ — refresh the site to see it');
        if (window.CHOCODODO_THEMES) {
          window.CHOCODODO_THEMES.applyTheme(value === 'auto' ? window.CHOCODODO_THEMES.detectTheme() : value);
        }
      } catch (err) { toast(err.message, '⚠️'); }
    });
  } catch (err) {
    toast(err.message, '⚠️');
  }
}
