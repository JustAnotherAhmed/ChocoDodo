// Auth page handlers — signup, login, account.
// Loaded on pages/signup.html, pages/login.html, pages/account.html

// API_BASE empty by default = same-origin relative URLs. Works on Railway,
// any hosted domain, and localhost where the backend serves the frontend too.
// To override for a split frontend/backend setup, set window.CHOCODODO_API_BASE
// before this script loads.
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

function showError(id, msg) {
  const el = $('#' + id);
  if (!el) return;
  el.textContent = msg || '';
  el.style.display = msg ? 'block' : 'none';
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

// ============= SIGN UP =============
const signupForm = $('#signupForm');
if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('su_error', '');
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    try {
      const data = await api('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          email: $('#su_email').value.trim(),
          password: $('#su_password').value,
          name: $('#su_name').value.trim(),
          phone: $('#su_phone').value.trim(),
        }),
      });
      toast(`Welcome, ${data.user.name}! 🍩 Check your inbox to verify.`);
      // Send the user to the email-verification page; the server has already
      // emailed them a code + magic link as part of /api/auth/signup.
      setTimeout(() => { location.href = 'verify-account.html'; }, 900);
    } catch (err) {
      showError('su_error', err.message);
      btn.disabled = false;
    }
  });
}

// ============= LOG IN =============
const loginForm = $('#loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('li_error', '');
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    try {
      const data = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: $('#li_email').value.trim(),
          password: $('#li_password').value,
        }),
      });
      toast(`Welcome back, ${data.user.name}!`);
      const next = data.user.role === 'admin' ? 'admin.html' : 'account.html';
      setTimeout(() => { location.href = next; }, 600);
    } catch (err) {
      showError('li_error', err.message);
      btn.disabled = false;
    }
  });
}

// ============= FORGOT PASSWORD =============
const forgotForm = $('#forgotForm');
if (forgotForm) {
  forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('fp_error', '');
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    try {
      await api('/api/auth/request-password-reset', {
        method: 'POST',
        body: JSON.stringify({ email: $('#fp_email').value.trim() }),
      });
      forgotForm.style.display = 'none';
      $('#fp_sent').style.display = 'block';
    } catch (err) {
      showError('fp_error', err.message);
      btn.disabled = false;
    }
  });
}

// ============= RESET PASSWORD =============
const resetForm = $('#resetForm');
if (resetForm) {
  resetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('rp_error', '');
    const np = $('#rp_new').value;
    const cf = $('#rp_confirm').value;
    if (np !== cf) {
      showError('rp_error', 'Passwords do not match');
      return;
    }
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    if (!token) {
      showError('rp_error', 'Reset link is invalid');
      return;
    }
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    try {
      await api('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, new_password: np }),
      });
      resetForm.style.display = 'none';
      $('#rp_done').style.display = 'block';
    } catch (err) {
      showError('rp_error', err.message);
      btn.disabled = false;
    }
  });
}

// ============= VERIFY EMAIL =============
if ($('#ve_loading')) {
  (async function verifyEmail() {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    if (!token) {
      $('#ve_loading').style.display = 'none';
      $('#ve_error').style.display = 'block';
      $('#ve_error_msg').textContent = 'No verification token provided.';
      return;
    }
    try {
      const data = await api('/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      $('#ve_loading').style.display = 'none';
      $('#ve_success').style.display = 'block';
      $('#ve_email').textContent = data.email || '';
    } catch (err) {
      $('#ve_loading').style.display = 'none';
      $('#ve_error').style.display = 'block';
      $('#ve_error_msg').textContent = err.message;
    }
  })();
}

// ============= ACCEPT INVITE =============
if ($('#acceptInviteForm')) {
  (async function initAcceptInvite() {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    if (!token) {
      $('#ai_intro').style.display = 'none';
      $('#ai_invalid').style.display = 'block';
      $('#ai_invalid_msg').textContent = 'No invitation token provided.';
      return;
    }
    try {
      const info = await api('/api/auth/invite-info?token=' + encodeURIComponent(token));
      $('#ai_intro').textContent = info.role === 'admin'
        ? `You've been invited as an admin. Set a password to finish creating your account.`
        : `You've been invited to ChocoDoDo. Set a password to finish creating your account.`;
      $('#ai_email').value = info.email;
      $('#ai_name').value = info.name || '';
      $('#acceptInviteForm').style.display = 'flex';
    } catch (err) {
      $('#ai_intro').style.display = 'none';
      $('#ai_invalid').style.display = 'block';
      $('#ai_invalid_msg').textContent = err.message;
      return;
    }

    $('#acceptInviteForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      showError('ai_error', '');
      const pw = $('#ai_password').value;
      const cf = $('#ai_confirm').value;
      if (pw !== cf) { showError('ai_error', 'Passwords do not match'); return; }
      const btn = e.target.querySelector('button');
      btn.disabled = true;
      try {
        const data = await api('/api/auth/accept-invite', {
          method: 'POST',
          body: JSON.stringify({ token, name: $('#ai_name').value.trim(), password: pw }),
        });
        toast(`Welcome, ${data.user.name || 'friend'}! 🍫`);
        const next = data.user.role === 'admin' ? 'admin.html' : 'account.html';
        setTimeout(() => location.href = next, 700);
      } catch (err) {
        showError('ai_error', err.message);
        btn.disabled = false;
      }
    });
  })();
}

// ============= ACCOUNT PAGE =============
if (document.body.classList.contains('account-body')) {
  initAccount();
}

async function initAccount() {
  let user;
  try {
    const data = await api('/api/auth/me');
    user = data.user;
  } catch {
    location.href = 'login.html';
    return;
  }

  $('#acctName').textContent = user.name || 'there';
  $('#ac_email').value = user.email;
  $('#ac_name').value = user.name || '';
  $('#ac_phone').value = stripEgPhoneAcct(user.phone || '');
  if (user.role === 'admin') {
    $('#navAdminLink').style.display = '';
  }

  // Show verification banner if not yet verified
  if (!user.email_verified) {
    const banner = $('#verifyBanner');
    if (banner) banner.style.display = 'flex';
    // Banner already has a link to verify-account.html — no JS handler needed
  }

  // Profile save
  $('#profileForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const phoneVal = ($('#ac_phone').value || '').trim();
    if (phoneVal && !isValidEgPhoneAcct(phoneVal)) {
      return toast('Phone must be a valid Egyptian mobile number', '⚠️');
    }
    try {
      await api('/api/auth/profile', {
        method: 'POST',
        body: JSON.stringify({
          name: $('#ac_name').value.trim(),
          phone: phoneVal,
        }),
      });
      toast('Profile saved ✓');
    } catch (err) { toast(err.message, '⚠️'); }
  });

  // Address book
  initAddressBook();

  // Password change
  $('#pwForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('pw_error', '');
    try {
      await api('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          current_password: $('#pw_current').value,
          new_password: $('#pw_new').value,
        }),
      });
      $('#pwForm').reset();
      toast('Password updated ✓');
    } catch (err) {
      showError('pw_error', err.message);
    }
  });

  // Logout
  $('#logoutLink')?.addEventListener('click', async (e) => {
    e.preventDefault();
    try { await api('/api/auth/logout', { method: 'POST' }); } catch {}
    location.href = '../index.html';
  });

  // Load orders
  try {
    const { orders } = await api('/api/auth/orders');
    renderOrders(orders);
  } catch (err) {
    $('#ordersList').innerHTML = `<p class="muted">${err.message}</p>`;
  }
}

/* ============= ADDRESS BOOK ============= */

function stripEgPhoneAcct(s) {
  if (!s) return '';
  const c = String(s).replace(/[\s\-()]/g, '');
  if (c.startsWith('+20')) return c.slice(3);
  if (c.startsWith('20'))  return c.slice(2);
  return c;
}

function isValidEgPhoneAcct(s) {
  const c = String(s || '').replace(/[\s\-()]/g, '');
  return /^(\+?20|0)?1[0125]\d{8}$/.test(c);
}

let _addresses = [];

async function initAddressBook() {
  await loadAddresses();
  $('#addAddrBtn')?.addEventListener('click', () => openAddressModal(null));
  initAddrModal();
}

async function loadAddresses() {
  const wrap = $('#addressList');
  if (!wrap) return;
  try {
    const { addresses } = await api('/api/auth/addresses');
    _addresses = addresses || [];
    if (_addresses.length === 0) {
      wrap.innerHTML = '<p class="muted">No saved addresses yet.</p>';
      return;
    }
    wrap.innerHTML = _addresses.map(a => `
      <div class="addr-row ${a.is_default ? 'default' : ''}">
        <div class="addr-row-main">
          <strong>${escapeHtml(a.label || 'Address')}</strong>
          ${a.is_default ? '<span class="addr-default-pill">⭐ Default</span>' : ''}
          <div>${escapeHtml(a.line1)}${a.city ? ', ' + escapeHtml(a.city) : ''}</div>
          ${a.phone ? `<small class="muted">📞 ${escapeHtml(a.phone)}</small>` : ''}
          ${a.notes ? `<small class="muted">📝 ${escapeHtml(a.notes)}</small>` : ''}
        </div>
        <div class="addr-row-actions">
          ${!a.is_default ? `<button class="btn-link" data-make-default="${a.id}">Set default</button>` : ''}
          <button class="btn-link" data-edit-addr="${a.id}">Edit</button>
        </div>
      </div>
    `).join('');
    document.querySelectorAll('[data-edit-addr]').forEach(b =>
      b.addEventListener('click', () => openAddressModal(Number(b.dataset.editAddr)))
    );
    document.querySelectorAll('[data-make-default]').forEach(b =>
      b.addEventListener('click', async () => {
        try {
          await api(`/api/auth/addresses/${b.dataset.makeDefault}/default`, { method: 'POST' });
          toast('Default address set ⭐');
          loadAddresses();
        } catch (err) { toast(err.message, '⚠️'); }
      })
    );
  } catch (err) {
    wrap.innerHTML = `<p class="muted">${err.message}</p>`;
  }
}

function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function initAddrModal() {
  const modal = $('#addrModal');
  if (!modal) return;
  modal.querySelectorAll('[data-modal-close]').forEach(b =>
    b.addEventListener('click', () => closeAddrModal())
  );
  modal.addEventListener('click', e => { if (e.target === modal) closeAddrModal(); });
  $('#addrForm').addEventListener('submit', saveAddress);
  $('#addr_delete').addEventListener('click', deleteAddress);
}

function openAddressModal(id) {
  const modal = $('#addrModal');
  $('#addrForm').reset();
  $('#addr_error').textContent = '';
  if (id) {
    const a = _addresses.find(x => x.id === id);
    if (!a) return toast('Address not found', '⚠️');
    $('#addrTitle').textContent = `Edit · ${a.label || 'Address'}`;
    $('#addr_id').value = a.id;
    $('#addr_label').value = a.label || '';
    $('#addr_default').value = a.is_default ? '1' : '0';
    $('#addr_full_name').value = a.full_name || '';
    $('#addr_phone').value = stripEgPhoneAcct(a.phone || '');
    $('#addr_line1').value = a.line1 || '';
    $('#addr_city').value = a.city || '';
    $('#addr_notes').value = a.notes || '';
    $('#addr_delete').style.display = '';
  } else {
    $('#addrTitle').textContent = 'New address';
    $('#addr_id').value = '';
    $('#addr_label').value = 'Home';
    $('#addr_delete').style.display = 'none';
  }
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}
function closeAddrModal() {
  const m = $('#addrModal');
  m.classList.remove('open');
  m.setAttribute('aria-hidden', 'true');
}

async function saveAddress(e) {
  e.preventDefault();
  const id = $('#addr_id').value;
  const phone = $('#addr_phone').value.trim();
  if (phone && !isValidEgPhoneAcct(phone)) {
    $('#addr_error').textContent = 'Phone must be a valid Egyptian mobile number';
    return;
  }
  const payload = {
    label: $('#addr_label').value.trim() || 'Home',
    full_name: $('#addr_full_name').value.trim(),
    phone,
    line1: $('#addr_line1').value.trim(),
    city: $('#addr_city').value.trim(),
    notes: $('#addr_notes').value.trim(),
    is_default: $('#addr_default').value === '1',
  };
  try {
    if (id) {
      await api(`/api/auth/addresses/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      toast('Address updated ✓');
    } else {
      await api('/api/auth/addresses', { method: 'POST', body: JSON.stringify(payload) });
      toast('Address added ✓');
    }
    closeAddrModal();
    loadAddresses();
  } catch (err) {
    $('#addr_error').textContent = err.message;
  }
}

async function deleteAddress() {
  const id = $('#addr_id').value;
  if (!id) return;
  if (!confirm('Delete this address?')) return;
  try {
    await api(`/api/auth/addresses/${id}`, { method: 'DELETE' });
    toast('Address removed');
    closeAddrModal();
    loadAddresses();
  } catch (err) { toast(err.message, '⚠️'); }
}

function fmtMoney(cents, currency = 'EGP') {
  const v = (cents / 100);
  const num = Number.isInteger(v) ? v.toString() : v.toFixed(2);
  return `${num} ${currency.toUpperCase()}`;
}

function renderOrders(orders) {
  const wrap = $('#ordersList');
  if (!orders || orders.length === 0) {
    wrap.innerHTML = `<p class="muted">No orders yet. <a href="../menu.html">Browse the menu →</a></p>`;
    return;
  }
  // Map for tracking labels
  const TRACK_LABELS = {
    received: { en: '📝 Received', cls: 'ok' },
    preparing: { en: '👩‍🍳 Preparing', cls: 'ok' },
    out_for_delivery: { en: '🛵 On the way', cls: 'ok' },
    delivered: { en: '🎉 Delivered', cls: 'ok' },
    cancelled: { en: '❌ Cancelled', cls: 'fail' },
  };
  wrap.innerHTML = orders.map(o => {
    const itemSummary = o.items.map(i => `${i.name} × ${i.qty}`).join(', ');
    const date = new Date(o.created_at + 'Z').toLocaleString();
    const cancelled = o.tracking_status === 'cancelled' || o.status === 'cancelled';
    const statusClass = cancelled ? 'fail'
                      : ['paid', 'cod-confirmed', 'delivered'].includes(o.status) ? 'ok'
                      : ['pending'].includes(o.status) ? 'wait'
                      : ['failed', 'refunded'].includes(o.status) ? 'fail' : '';
    const t = TRACK_LABELS[o.tracking_status || 'received'] || TRACK_LABELS.received;
    const trackBadge = cancelled
      ? `<span class="order-status fail">❌ Cancelled</span>`
      : `<span class="order-status ${t.cls}">${t.en}</span>`;
    return `
      <div class="order-row ${cancelled ? 'cancelled' : ''}">
        <div style="flex:1;">
          <div class="order-row-id">
            <strong>${o.id}</strong>
            ${trackBadge}
            <span class="order-status ${statusClass}">${o.status.replace(/-/g, ' ')}</span>
          </div>
          <div class="muted">${date}</div>
          <div class="order-row-items">${itemSummary}</div>
        </div>
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px;">
          <div class="order-row-total">${fmtMoney(o.total_cents, o.currency)}</div>
          ${!cancelled
            ? `<a href="track.html?id=${encodeURIComponent(o.id)}" class="btn btn-ghost" style="padding:6px 14px;font-size:13px;">📦 Track</a>`
            : ''}
          <button type="button" class="btn btn-primary reorder-btn"
                  data-reorder='${JSON.stringify(o.items).replace(/'/g, "&#39;")}'
                  style="padding:6px 14px;font-size:13px;">
            🔁 Order again
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Wire up the "Order again" buttons
  document.querySelectorAll('.reorder-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      try {
        const items = JSON.parse(btn.dataset.reorder.replace(/&#39;/g, "'"));
        // Build cart entries in the same shape script.js expects: {id, qty, options}
        const cart = items.map(it => ({
          id: it.id,
          qty: it.qty || 1,
          options: it.options || {},
        }));
        localStorage.setItem('chocododo_cart', JSON.stringify(cart));
        toast('🛒 Items added to cart — heading to checkout…');
        setTimeout(() => { location.href = 'checkout.html'; }, 700);
      } catch (e) {
        toast('Could not reorder. Browse the menu and add items again.');
      }
    });
  });
}
