/* ============================================
   ChocoDoDo — Main Script
   - Loads products from /api/products (with hardcoded fallback)
   - Cart with line-items + selected options
   - Option picker modal for customizable products
   - Auth-aware nav (Sign in / Account / Admin)
   - Animations + form handling
   ============================================ */

const API_BASE = window.CHOCODODO_API_BASE || 'http://localhost:4242';

/* ---------- HARDCODED FALLBACK PRODUCTS ----------
   Used only if /api/products is unreachable (e.g. site opened
   from filesystem without the backend running). */
const FALLBACK_FILLINGS = [
  { value: 'coffee',        label_en: 'Coffee',        label_ar: 'قهوة' },
  { value: 'caramel',       label_en: 'Caramel',       label_ar: 'كراميل' },
  { value: 'almond',        label_en: 'Almond',        label_ar: 'لوز' },
  { value: 'hazelnut',      label_en: 'Hazelnut',      label_ar: 'بندق' },
  { value: 'cashew',        label_en: 'Cashew',        label_ar: 'كاجو' },
  { value: 'walnut',        label_en: 'Walnut',        label_ar: 'عين جمل' },
  { value: 'peanut',        label_en: 'Peanut',        label_ar: 'سوداني' },
  { value: 'pistachio',     label_en: 'Pistachio',     label_ar: 'بستاشيو' },
  { value: 'lotus',         label_en: 'Lotus',         label_ar: 'لوتس' },
  { value: 'peanut_butter', label_en: 'Peanut Butter', label_ar: 'زبدة فول سوداني' },
];
const FALLBACK_FILLING_GROUP = {
  id: 'filling',
  label_en: 'Choose your filling',
  label_ar: 'اختر الحشوة',
  required: true,
  multi: false,
  choices: FALLBACK_FILLINGS.map(f => ({ ...f, price_delta_minor: 0 })),
};

const FALLBACK_PRODUCTS = [
  { id: 'sc500', cat: 'chocolate', sub: 'stuffed', name: 'Stuffed Chocolate — ½ Kilo', name_ar: 'نص كيلو شكولاتة محشى', price: 450, emoji: '🍫', image: 'assets/images/products/stuffed-half.jpg', desc: 'Premium chocolate stuffed with your choice of filling. Half kilo — perfect for sharing.', desc_ar: 'شكولاتة فاخرة محشية بالحشوة التي تختارها — نص كيلو، مثالية للمشاركة.', badge: 'hot', options: { groups: [FALLBACK_FILLING_GROUP] } },
  { id: 'sc250', cat: 'chocolate', sub: 'stuffed', name: 'Stuffed Chocolate — ¼ Kilo', name_ar: 'ربع كيلو شكولاتة محشية', price: 225, emoji: '🍫', image: 'assets/images/products/stuffed-quarter.jpg', desc: 'Premium chocolate stuffed with your choice of filling. Quarter kilo treat.', desc_ar: 'شكولاتة فاخرة محشية بالحشوة التي تختارها — ربع كيلو.', options: { groups: [FALLBACK_FILLING_GROUP] } },
  { id: 'pc500', cat: 'chocolate', sub: 'plain',    name: 'Plain Chocolate — ½ Kilo', name_ar: 'نص كيلو شكولاتة سادة', price: 400, emoji: '🍫', image: 'assets/images/products/plain-half.jpg', desc: 'Pure, smooth premium chocolate. Half kilo. No fillings, just chocolate bliss.', desc_ar: 'شكولاتة فاخرة نقية وناعمة — نص كيلو من المتعة الخالصة.' },
  { id: 'pc250', cat: 'chocolate', sub: 'plain',    name: 'Plain Chocolate — ¼ Kilo', name_ar: 'ربع كيلو شكولاتة سادة', price: 200, emoji: '🍫', image: 'assets/images/products/plain-quarter.jpg', desc: 'Pure, smooth premium chocolate. Quarter kilo.', desc_ar: 'شكولاتة فاخرة نقية وناعمة — ربع كيلو.' },
  { id: 'mc250', cat: 'chocolate', sub: 'mixed',    name: 'Mixed Chocolate w/ Snickers — ¼ Kilo', name_ar: 'ربع كيلو شكولاتة مشكل ومعاها سنيكرز', price: 250, emoji: '🍬', badge: 'new', image: 'assets/images/products/mixed-snickers.jpg', desc: 'A taste of everything — assorted chocolates plus our signature Snickers. Quarter kilo.', desc_ar: 'تشكيلة شاملة — مجموعة شكولاتات متنوعة مع سنيكرز الشهير. ربع كيلو.' },
  { id: 'sn500', cat: 'chocolate', sub: 'snickers', name: 'Snickers Chocolate — ½ Kilo', name_ar: 'نص كيلو سنيكرز', price: 350, emoji: '🥜', badge: 'hot', image: 'assets/images/products/snickers-half.jpg', desc: 'Our signature Snickers-style chocolate — peanutty, caramelly, irresistible. Half kilo.', desc_ar: 'شكولاتة سنيكرز المميزة — بالفول السوداني والكراميل، لا تُقاوم. نص كيلو.' },
  { id: 'sn250', cat: 'chocolate', sub: 'snickers', name: 'Snickers Chocolate — ¼ Kilo', name_ar: 'ربع كيلو سنيكرز', price: 175, emoji: '🥜', image: 'assets/images/products/snickers-quarter.jpg', desc: 'Our signature Snickers-style chocolate. Quarter kilo.', desc_ar: 'شكولاتة سنيكرز المميزة — ربع كيلو.' },
  { id: 'b1000', cat: 'biscuits',  sub: 'regular',  name: 'Biscuits — 1 Kilo', name_ar: 'كيلو البسكويت', price: 450, emoji: '🍪', image: 'assets/images/products/biscuits-kilo.jpg', desc: 'A full kilo of our handmade biscuits — soft, buttery, baked fresh.', desc_ar: 'كيلو كامل من البسكويت المصنوع يدوياً — طري، زبدي، طازج.' },
  { id: 'b500',  cat: 'biscuits',  sub: 'regular',  name: 'Biscuits — ½ Kilo', name_ar: 'النص كيلو البسكويت', price: 225, emoji: '🍪', image: 'assets/images/products/biscuits-half.jpg', desc: 'Half a kilo of our handmade biscuits.', desc_ar: 'نص كيلو من البسكويت المصنوع يدوياً.' },
  { id: 'd1000', cat: 'biscuits',  sub: 'diet',     name: 'Diet Biscuits — 1 Kilo', name_ar: 'كيلو بسكويت الدايت', price: 500, emoji: '🌾', badge: 'new', image: 'assets/images/products/diet-biscuits-kilo.jpg', desc: 'A full kilo of diet-friendly biscuits — wholesome, lower-sugar, full of flavor.', desc_ar: 'كيلو من البسكويت الصحي للدايت — مفيد، قليل السكر، غني بالنكهة.' },
  { id: 'd500',  cat: 'biscuits',  sub: 'diet',     name: 'Diet Biscuits — ½ Kilo', name_ar: 'النص كيلو بسكويت دايت', price: 250, emoji: '🌾', image: 'assets/images/products/diet-biscuits-half.jpg', desc: 'Half a kilo of our diet-friendly biscuits.', desc_ar: 'نص كيلو من البسكويت الصحي للدايت.' },
];

/* ---------- STATE ---------- */
let PRODUCTS = FALLBACK_PRODUCTS.slice();   // overwritten by API on boot
let CURRENT_USER = null;

/* ---------- CART (versioned schema v2 = line-items with options) ---------- */
const CART_VERSION = 2;
{
  const stored = parseInt(localStorage.getItem('chocododo_cart_v') || '1', 10);
  if (stored < CART_VERSION) {
    localStorage.removeItem('chocododo_cart');
    localStorage.setItem('chocododo_cart_v', CART_VERSION);
  }
}
let cart = JSON.parse(localStorage.getItem('chocododo_cart') || '[]');
let favorites = JSON.parse(localStorage.getItem('chocododo_favs') || '[]');

const CATEGORY_FALLBACK = {
  chocolate: 'assets/images/products/chocolate.svg',
  biscuits:  'assets/images/products/cookie.svg',
};
let CAT_LABELS = {
  chocolate: { en: 'Chocolate', ar: 'شكولاتة', emoji: '🍫' },
  biscuits:  { en: 'Biscuits',  ar: 'بسكويت',  emoji: '🍪' },
};
let CATEGORIES = [];   // populated from API on boot

/* ---------- UTILS ---------- */
const $ = (sel, parent = document) => parent.querySelector(sel);
const $$ = (sel, parent = document) => [...parent.querySelectorAll(sel)];
const formatPrice = (n) => {
  const v = Number.isInteger(n) ? n : n.toFixed(2);
  return `${v} EGP`;
};
const saveCart = () => localStorage.setItem('chocododo_cart', JSON.stringify(cart));
const saveFavs = () => localStorage.setItem('chocododo_favs', JSON.stringify(favorites));

const PATH_PREFIX = location.pathname.includes('/pages/') ? '../' : '';
const assetPath = (p) => p && p.startsWith('http') ? p : PATH_PREFIX + (p || '');

const escapeHtml = (s = '') => String(s).replace(/[&<>"']/g, c => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));

function api(path, opts = {}) {
  return fetch(API_BASE + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  }).then(async (r) => {
    let data = null;
    try { data = await r.json(); } catch {}
    if (!r.ok) throw new Error(data?.error || `Request failed (${r.status})`);
    return data;
  });
}

/* ---------- TOAST ---------- */
function toast(msg, icon = '✓') {
  const el = $('#toast');
  if (!el) return;
  el.innerHTML = `<span>${icon}</span> ${msg}`;
  el.classList.add('show');
  clearTimeout(el._timeout);
  el._timeout = setTimeout(() => el.classList.remove('show'), 2400);
}

/* ---------- LOADER ---------- */
window.addEventListener('load', () => {
  setTimeout(() => $('#loader')?.classList.add('hidden'), 600);
});

/* ---------- HERO BANNER PROBE ---------- */
(function probeHeroBanner() {
  const hero = $('.hero');
  if (!hero) return;
  const img = new Image();
  img.onerror = () => hero.classList.add('no-banner');
  img.onload = () => hero.classList.remove('no-banner');
  img.src = (PATH_PREFIX || '') + 'assets/images/hero-bg.jpg';
})();

/* ---------- NAV ---------- */
const navbar = $('#navbar');
window.addEventListener('scroll', () => {
  if (window.scrollY > 30) navbar?.classList.add('scrolled');
  else navbar?.classList.remove('scrolled');
});
const hamburger = $('#hamburger');
const navLinks = $('#navLinks');
hamburger?.addEventListener('click', () => {
  hamburger.classList.toggle('active');
  navLinks?.classList.toggle('open');
});
$$('.nav-link').forEach(link => {
  link.addEventListener('click', () => {
    hamburger?.classList.remove('active');
    navLinks?.classList.remove('open');
  });
});

/* Active nav link by section */
const sections = $$('section[id]');
window.addEventListener('scroll', () => {
  const top = window.scrollY + 120;
  sections.forEach(s => {
    const link = $(`.nav-link[href="#${s.id}"]`);
    if (!link) return;
    if (s.offsetTop <= top && s.offsetTop + s.offsetHeight > top) {
      $$('.nav-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
    }
  });
});

/* ---------- AUTH NAV STATE ---------- */
async function loadAuthState() {
  try {
    const data = await api('/api/auth/me');
    CURRENT_USER = data.user;
  } catch { CURRENT_USER = null; }
  renderAuthNav();
}

function renderAuthNav() {
  const ul = $('#navLinks');
  if (!ul) return;
  // Remove any previously-injected auth items
  ul.querySelectorAll('[data-auth-item]').forEach(li => li.remove());

  const inPages = location.pathname.includes('/pages/');
  const prefix = inPages ? '' : 'pages/';

  if (CURRENT_USER) {
    const items = [];
    if (CURRENT_USER.role === 'admin') {
      items.push(`<li data-auth-item><a href="${prefix}admin.html" class="nav-link">Admin</a></li>`);
    }
    items.push(`<li data-auth-item><a href="${prefix}account.html" class="nav-link">${escapeHtml(CURRENT_USER.name?.split(' ')[0] || 'Account')}</a></li>`);
    items.push(`<li data-auth-item><a href="#" class="nav-link" id="navLogout">Sign out</a></li>`);
    ul.insertAdjacentHTML('beforeend', items.join(''));
    $('#navLogout')?.addEventListener('click', async (e) => {
      e.preventDefault();
      try { await api('/api/auth/logout', { method: 'POST' }); } catch {}
      CURRENT_USER = null;
      renderAuthNav();
      toast('Signed out');
    });
  } else {
    ul.insertAdjacentHTML('beforeend',
      `<li data-auth-item><a href="${prefix}login.html" class="nav-link">Sign in</a></li>` +
      `<li data-auth-item><a href="${prefix}signup.html" class="nav-link">Sign up</a></li>`
    );
  }
}

/* ---------- REVEALS ---------- */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const delay = entry.target.dataset.delay || 0;
      setTimeout(() => entry.target.classList.add('visible'), delay);
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });
$$('.reveal').forEach(el => revealObserver.observe(el));

/* ---------- COUNTERS ---------- */
const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const el = entry.target;
      const target = parseInt(el.dataset.count, 10);
      const duration = 1600;
      const start = performance.now();
      const tick = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.floor(eased * target).toLocaleString();
        if (progress < 1) requestAnimationFrame(tick);
        else el.textContent = target.toLocaleString() + (target === 100 ? '%' : '+');
      };
      requestAnimationFrame(tick);
      counterObserver.unobserve(el);
    }
  });
}, { threshold: 0.5 });
$$('[data-count]').forEach(el => counterObserver.observe(el));

/* ---------- PRODUCT CARDS ---------- */
function fillingsHint(p) {
  const groups = p.options?.groups || [];
  const filling = groups.find(g => g.id === 'filling');
  if (!filling) return '';
  const en = filling.choices.map(c => c.label_en).join(' · ');
  const ar = filling.choices.map(c => c.label_ar).join(' · ');
  return `
    <div class="product-fillings">
      <strong>Fillings <span lang="ar" dir="rtl">/ الحشوات</span>:</strong>
      <span class="fill-en">${escapeHtml(en)}</span>
      <span class="fill-ar" lang="ar" dir="rtl">${escapeHtml(ar)}</span>
      <small class="fill-note">Click + and pick your filling</small>
    </div>
  `;
}

function stockBadge(p) {
  if (!p.track_stock) return '';
  if (p.stock <= 0) return `<span class="stock-badge out">Out of stock</span>`;
  if (p.stock <= (p.low_stock_at || 5)) return `<span class="stock-badge low">Only ${p.stock} left!</span>`;
  return '';
}

function productCard(p) {
  const inFav = favorites.includes(p.id);
  const realImg = assetPath(p.image);
  const fallbackSvg = assetPath(CATEGORY_FALLBACK[p.cat] || CATEGORY_FALLBACK.chocolate);
  const catLabel = CAT_LABELS[p.cat] || { en: p.cat, ar: '' };
  const soldOut = p.track_stock && p.stock <= 0;
  return `
    <article class="product-card reveal ${soldOut ? 'sold-out' : ''}" data-id="${p.id}">
      <div class="product-img-wrap">
        ${p.badge ? `<span class="product-badge ${p.badge}">${p.badge === 'new' ? 'New' : 'Hot'}</span>` : ''}
        ${stockBadge(p)}
        <button class="product-fav ${inFav ? 'active' : ''}" data-fav="${p.id}" aria-label="Favorite">${inFav ? '❤️' : '🤍'}</button>
        <img src="${realImg}" alt="${escapeHtml(p.name)}"
             data-fallback="${fallbackSvg}"
             onerror="this.onerror=null; if(this.dataset.fallback){this.src=this.dataset.fallback; this.dataset.fallback='';} else {this.style.display='none'; this.nextElementSibling.style.display='block';}" />
        <span class="product-emoji" style="display:none;">${p.emoji || '🍫'}</span>
      </div>
      <div class="product-info">
        <span class="product-cat">${catLabel.en} · <span lang="ar" dir="rtl">${catLabel.ar}</span></span>
        <h3 class="product-name">${escapeHtml(p.name)}</h3>
        ${p.name_ar ? `<p class="product-name-ar" lang="ar" dir="rtl">${escapeHtml(p.name_ar)}</p>` : ''}
        ${renderStars(p.id)}
        ${p.desc ? `<p class="product-desc">${escapeHtml(p.desc)}</p>` : ''}
        ${p.desc_ar ? `<p class="product-desc-ar" lang="ar" dir="rtl">${escapeHtml(p.desc_ar)}</p>` : ''}
        ${fillingsHint(p)}
        <div class="product-footer">
          <button class="product-reviews-btn" data-reviews="${p.id}" type="button">⭐ <span data-i18n="reviews.button">Reviews</span></button>
          <span class="product-price">${formatPrice(p.price)}</span>
          <button class="product-add" data-add="${p.id}" aria-label="${soldOut ? 'Sold out' : 'Add to cart'}" ${soldOut ? 'disabled' : ''}>${soldOut ? '✕' : '+'}</button>
        </div>
      </div>
    </article>
  `;
}

/* ---------- LOAD PRODUCTS FROM API ---------- */
/* ---------- REVIEW SUMMARIES (cached map: productId -> {avg, count}) ---------- */
const REVIEW_SUMMARIES = {};

async function loadReviewSummaries() {
  try {
    const r = await fetch(`${API_BASE}/api/reviews/summary`);
    if (!r.ok) return;
    const data = await r.json();
    Object.assign(REVIEW_SUMMARIES, data.summary || {});
  } catch { /* non-fatal */ }
}

function renderStars(productId) {
  const s = REVIEW_SUMMARIES[productId];
  if (!s || !s.count) return '';   // no rating yet → don't show anything
  const full = Math.round(s.avg);
  const stars = '★'.repeat(full) + '☆'.repeat(5 - full);
  return `<button class="product-rating" data-reviews="${productId}" type="button" aria-label="See reviews">
    <span class="product-rating-stars">${stars}</span>
    <span class="product-rating-num">${s.avg.toFixed(1)}</span>
    <span class="product-rating-count">(${s.count})</span>
  </button>`;
}

async function loadProducts() {
  try {
    const { products } = await api('/api/products');
    if (Array.isArray(products) && products.length) {
      PRODUCTS = products;
    }
  } catch {
    // Backend unreachable — keep hardcoded fallback.
  }
}

async function loadCategories() {
  try {
    const { categories } = await api('/api/categories');
    if (Array.isArray(categories) && categories.length) {
      CATEGORIES = categories;
      // Rebuild label map
      CAT_LABELS = {};
      for (const c of categories) {
        CAT_LABELS[c.id] = { en: c.name_en, ar: c.name_ar || '', emoji: c.emoji || '🍫' };
      }
    }
  } catch { /* keep defaults */ }
}

function renderMenuFilters() {
  const wrap = document.querySelector('.menu-filters');
  if (!wrap || CATEGORIES.length === 0) return;
  // Preserve current "All" + active state
  const params = new URLSearchParams(location.search);
  const activeCat = params.get('cat') || 'all';
  wrap.innerHTML =
    `<button class="filter-btn ${activeCat === 'all' ? 'active' : ''}" data-cat="all">All · <span lang="ar" dir="rtl">الكل</span></button>` +
    CATEGORIES.map(c => `
      <button class="filter-btn ${activeCat === c.id ? 'active' : ''}" data-cat="${c.id}">
        ${c.emoji || ''} ${c.name_en}${c.name_ar ? ` · <span lang="ar" dir="rtl">${c.name_ar}</span>` : ''}
      </button>
    `).join('');
}

/* ---------- RENDER FEATURED (homepage) ---------- */
async function renderFeatured() {
  const featuredEl = $('#featuredProducts');
  if (!featuredEl) return;
  const featuredIds = ['sc500', 'sn500', 'mc250', 'pc500', 'b1000', 'd1000'];
  const items = featuredIds.map(id => PRODUCTS.find(p => p.id === id)).filter(Boolean);
  // If menu doesn't have those exact IDs, fall back to first 6 published
  const finalList = items.length >= 3 ? items : PRODUCTS.slice(0, 6);
  featuredEl.innerHTML = finalList.map(productCard).join('');
  $$('.product-card.reveal', featuredEl).forEach(el => revealObserver.observe(el));
  attachProductHandlers(featuredEl);
}

/* ---------- RENDER MENU (menu page) ---------- */
function setupMenu() {
  const menuGrid = $('#menuGrid');
  if (!menuGrid) return;
  const params = new URLSearchParams(location.search);
  const initialCat = params.get('cat') || 'all';
  $$('.filter-btn').forEach(btn => {
    if (btn.dataset.cat === initialCat) {
      $$('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    }
    btn.addEventListener('click', () => {
      $$('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderMenu(btn.dataset.cat);
    });
  });
  renderMenu(initialCat);
}

function renderMenu(cat) {
  const menuGrid = $('#menuGrid');
  if (!menuGrid) return;
  const filtered = cat === 'all' ? PRODUCTS : PRODUCTS.filter(p => p.cat === cat);
  menuGrid.style.opacity = '0';
  setTimeout(() => {
    menuGrid.innerHTML = filtered.length
      ? filtered.map(productCard).join('')
      : `<p class="muted" style="grid-column:1/-1;text-align:center;padding:40px;">No items in this category yet.</p>`;
    $$('.product-card.reveal', menuGrid).forEach(el => el.classList.add('visible'));
    attachProductHandlers(menuGrid);
    menuGrid.style.opacity = '1';
  }, 200);
}

function attachProductHandlers(scope) {
  $$('[data-add]', scope).forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleAddClick(btn.dataset.add);
    });
  });
  $$('[data-fav]', scope).forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFav(btn.dataset.fav, btn);
    });
  });
  $$('[data-reviews]', scope).forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openReviewsModal(btn.dataset.reviews);
    });
  });
}

/* ============================================
   REVIEWS MODAL — list approved reviews + leave-a-review form
   ============================================ */
function ensureReviewsModal() {
  let m = document.getElementById('reviewsModal');
  if (m) return m;
  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-overlay reviews-modal" id="reviewsModal" aria-hidden="true">
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-header">
          <div>
            <h2 id="rvTitle">Reviews</h2>
            <p id="rvSubtitle" class="muted" style="font-size:13px;margin:4px 0 0;"></p>
          </div>
          <button class="modal-close" id="rvClose" aria-label="Close">×</button>
        </div>
        <div class="modal-body">
          <div id="rvList" class="reviews-list"><p class="muted">Loading…</p></div>

          <div id="rvComposer" class="review-composer hidden">
            <h3 style="font-family:'Fredoka',sans-serif;color:var(--choc-deep);margin:8px 0 12px;">Leave a review</h3>
            <div class="review-stars-input" id="rvRating">
              ${[1,2,3,4,5].map(n => `<button type="button" data-rating="${n}" aria-label="${n} stars">☆</button>`).join('')}
            </div>
            <input id="rvFormTitle" type="text" placeholder="Title (optional)" maxlength="80" />
            <textarea id="rvFormBody" placeholder="Tell us what you thought…" rows="3" maxlength="1500"></textarea>
            <div class="modal-error" id="rvError"></div>
            <button class="btn btn-primary" id="rvSubmit">Submit review</button>
            <p class="muted" style="font-size:12px;margin-top:8px;">Your review will be visible right away. Be kind 💕</p>
          </div>

          <div id="rvSignInPrompt" class="hidden" style="background:var(--cream);padding:16px;border-radius:12px;text-align:center;">
            <p style="margin:0 0 12px;color:var(--choc-deep);">Sign in to leave a review.</p>
            <a href="${location.pathname.includes('/pages/') ? '' : 'pages/'}login.html" class="btn btn-primary">Sign in</a>
          </div>
        </div>
      </div>
    </div>
  `);
  m = document.getElementById('reviewsModal');
  m.addEventListener('click', e => { if (e.target === m) closeReviewsModal(); });
  document.getElementById('rvClose').addEventListener('click', closeReviewsModal);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeReviewsModal(); });
  return m;
}
function closeReviewsModal() {
  const m = document.getElementById('reviewsModal');
  if (m) { m.classList.remove('open'); m.setAttribute('aria-hidden', 'true'); }
}

let _currentReviewProductId = null;
let _currentRating = 0;

async function openReviewsModal(productId) {
  const product = PRODUCTS.find(p => p.id === productId);
  if (!product) return;
  _currentReviewProductId = productId;
  _currentRating = 0;
  const m = ensureReviewsModal();
  document.getElementById('rvTitle').textContent = product.name;
  document.getElementById('rvSubtitle').textContent = product.name_ar || '';
  m.classList.add('open');
  m.setAttribute('aria-hidden', 'false');

  // Show composer if signed in, otherwise sign-in prompt
  const composer = document.getElementById('rvComposer');
  const prompt = document.getElementById('rvSignInPrompt');
  if (CURRENT_USER) {
    composer.classList.remove('hidden');
    prompt.classList.add('hidden');
    // Reset star rating UI
    document.querySelectorAll('#rvRating button').forEach(b => b.textContent = '☆');
    document.getElementById('rvFormTitle').value = '';
    document.getElementById('rvFormBody').value = '';
    document.getElementById('rvError').textContent = '';

    // Wire star clicks (only once per modal lifetime)
    document.querySelectorAll('#rvRating button').forEach(b => {
      b.onclick = () => {
        _currentRating = Number(b.dataset.rating);
        document.querySelectorAll('#rvRating button').forEach(x => {
          x.textContent = Number(x.dataset.rating) <= _currentRating ? '★' : '☆';
        });
      };
    });
    document.getElementById('rvSubmit').onclick = submitReview;
  } else {
    composer.classList.add('hidden');
    prompt.classList.remove('hidden');
  }

  // Load reviews
  const list = document.getElementById('rvList');
  list.innerHTML = '<p class="muted">Loading…</p>';
  try {
    const r = await fetch(`${API_BASE}/api/reviews/${encodeURIComponent(productId)}`);
    const data = await r.json();
    renderReviewsList(list, data.reviews, data.summary);
  } catch (err) {
    list.innerHTML = `<p class="muted">Couldn't load reviews: ${err.message}</p>`;
  }
}

function renderReviewsList(wrap, reviews, summary) {
  if (!reviews || reviews.length === 0) {
    wrap.innerHTML = `<p class="muted" style="text-align:center;padding:24px 0;">No reviews yet — be the first to share your thoughts!</p>`;
    return;
  }
  const avg = summary?.avg ? summary.avg.toFixed(1) : '—';
  const stars = summary?.avg ? '★'.repeat(Math.round(summary.avg)) + '☆'.repeat(5 - Math.round(summary.avg)) : '';
  wrap.innerHTML = `
    <div class="reviews-summary">
      <div class="reviews-avg">${avg}</div>
      <div>
        <div class="reviews-summary-stars">${stars}</div>
        <small class="muted">${summary.count} review${summary.count === 1 ? '' : 's'}</small>
      </div>
    </div>
    ${reviews.map(r => `
      <div class="review-item">
        <div class="review-head">
          <strong>${escapeHtml(r.customer_name || 'Anonymous')}</strong>
          <span class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
        </div>
        ${r.title ? `<div class="review-title">${escapeHtml(r.title)}</div>` : ''}
        ${r.body ? `<p class="review-body">${escapeHtml(r.body)}</p>` : ''}
        <small class="muted">${new Date(r.created_at + 'Z').toLocaleDateString()}</small>
      </div>
    `).join('')}
  `;
}

async function submitReview() {
  const error = document.getElementById('rvError');
  error.textContent = '';
  if (!_currentRating) {
    error.textContent = 'Please pick a rating (1–5 stars)';
    return;
  }
  const title = document.getElementById('rvFormTitle').value.trim();
  const body = document.getElementById('rvFormBody').value.trim();
  const btn = document.getElementById('rvSubmit');
  btn.disabled = true; btn.textContent = 'Submitting…';
  try {
    await api('/api/reviews', {
      method: 'POST',
      body: JSON.stringify({
        product_id: _currentReviewProductId,
        rating: _currentRating,
        title: title || null,
        body: body || null,
      }),
    });
    toast('Thanks! Your review is live ⭐');
    closeReviewsModal();
    // Refresh summaries + the menu so the new rating appears instantly
    await loadReviewSummaries();
    if (typeof renderMenu === 'function') {
      const cat = document.querySelector('.filter-btn.active')?.dataset.cat || 'all';
      renderMenu(cat);
    }
    if (typeof renderFeatured === 'function') renderFeatured();
  } catch (err) {
    error.textContent = err.message;
  } finally {
    btn.disabled = false; btn.textContent = 'Submit review';
  }
}

/* ---------- ADD TO CART (with option picker if needed) ---------- */
function handleAddClick(productId) {
  const p = PRODUCTS.find(x => x.id === productId);
  if (!p) return;
  if (p.track_stock && p.stock <= 0) {
    toast('Sorry — that item is sold out', '⚠️');
    return;
  }
  if (p.options?.groups?.length) {
    openOptionPicker(p);
  } else {
    addToCart(p, {});
  }
}

function lineIdFor(productId, selected) {
  const keys = Object.keys(selected || {}).sort();
  if (keys.length === 0) return productId;
  return productId + '|' + keys.map(k => {
    const v = selected[k];
    return `${k}:${Array.isArray(v) ? v.join(',') : v}`;
  }).join('|');
}

function describeSelected(product, selected) {
  const groups = product?.options?.groups || [];
  const parts = [];
  for (const g of groups) {
    const raw = selected?.[g.id];
    if (raw === undefined || raw === null || raw === '') continue;
    const values = Array.isArray(raw) ? raw : [raw];
    const labels = values.map(v => (g.choices || []).find(c => c.value === v)?.label_en || v);
    parts.push(`${g.label_en}: ${labels.join(', ')}`);
  }
  return parts.join(' · ');
}

function describeSelectedAr(product, selected) {
  const groups = product?.options?.groups || [];
  const parts = [];
  for (const g of groups) {
    const raw = selected?.[g.id];
    if (raw === undefined || raw === null || raw === '') continue;
    const values = Array.isArray(raw) ? raw : [raw];
    const labels = values.map(v => (g.choices || []).find(c => c.value === v)?.label_ar || v);
    parts.push(`${g.label_ar || ''}: ${labels.join('، ')}`);
  }
  return parts.join(' · ');
}

function addToCart(product, selectedOptions) {
  const lineId = lineIdFor(product.id, selectedOptions);
  const existing = cart.find(c => c.lineId === lineId);
  if (existing) existing.qty++;
  else cart.push({ lineId, productId: product.id, qty: 1, options: selectedOptions || {} });
  saveCart();
  updateCartUI();
  bumpCart();
  const optDesc = describeSelected(product, selectedOptions);
  toast(`${product.name}${optDesc ? ` (${optDesc})` : ''} added!`, '🛒');
}

function removeFromCart(lineId) {
  cart = cart.filter(c => c.lineId !== lineId);
  saveCart();
  updateCartUI();
}

function changeQty(lineId, delta) {
  const item = cart.find(c => c.lineId === lineId);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) removeFromCart(lineId);
  else { saveCart(); updateCartUI(); }
}

function cartTotal() {
  return cart.reduce((sum, line) => {
    const p = PRODUCTS.find(p => p.id === line.productId);
    if (!p) return sum;
    let unit = p.price;
    // Apply option price deltas
    const groups = p.options?.groups || [];
    for (const g of groups) {
      const sel = line.options?.[g.id];
      if (sel === undefined) continue;
      const values = Array.isArray(sel) ? sel : [sel];
      for (const v of values) {
        const c = (g.choices || []).find(c => c.value === v);
        if (c?.price_delta_minor) unit += c.price_delta_minor / 100;
      }
    }
    return sum + unit * line.qty;
  }, 0);
}
function cartCount() { return cart.reduce((s, c) => s + c.qty, 0); }

function bumpCart() {
  const el = $('#cartCount');
  if (!el) return;
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

function updateCartUI() {
  const countEl = $('#cartCount');
  const itemsEl = $('#cartItems');
  const footerEl = $('#cartFooter');
  const totalEl = $('#cartTotal');
  const count = cartCount();

  if (countEl) {
    countEl.textContent = count;
    countEl.classList.toggle('has-items', count > 0);
  }
  if (!itemsEl) return;

  if (cart.length === 0) {
    itemsEl.innerHTML = '<p class="cart-empty">Your cart is empty 🍩<br/><small>Add some sweet treats!</small></p>';
    if (footerEl) footerEl.style.display = 'none';
    return;
  }

  itemsEl.innerHTML = cart.map(line => {
    const p = PRODUCTS.find(p => p.id === line.productId);
    if (!p) return '';
    const realImg = assetPath(p.image);
    const fallbackSvg = assetPath(CATEGORY_FALLBACK[p.cat] || CATEGORY_FALLBACK.chocolate);
    const optDescEn = describeSelected(p, line.options);
    const optDescAr = describeSelectedAr(p, line.options);
    let unit = p.price;
    const groups = p.options?.groups || [];
    for (const g of groups) {
      const sel = line.options?.[g.id];
      const values = Array.isArray(sel) ? sel : [sel].filter(Boolean);
      for (const v of values) {
        const c = (g.choices || []).find(c => c.value === v);
        if (c?.price_delta_minor) unit += c.price_delta_minor / 100;
      }
    }
    return `
      <div class="cart-item">
        <div class="cart-item-img">
          <img src="${realImg}" alt="${escapeHtml(p.name)}"
               data-fallback="${fallbackSvg}"
               onerror="this.onerror=null; if(this.dataset.fallback){this.src=this.dataset.fallback; this.dataset.fallback='';} else {this.style.display='none';this.parentNode.innerHTML='${p.emoji || '🍫'}';}" />
        </div>
        <div class="cart-item-info">
          <div class="cart-item-name">${escapeHtml(p.name)}</div>
          ${p.name_ar ? `<div class="cart-item-name-ar" lang="ar" dir="rtl">${escapeHtml(p.name_ar)}</div>` : ''}
          ${optDescEn ? `<div class="cart-item-opts">${escapeHtml(optDescEn)}</div>` : ''}
          ${optDescAr ? `<div class="cart-item-opts" lang="ar" dir="rtl">${escapeHtml(optDescAr)}</div>` : ''}
          <div class="cart-item-price">${formatPrice(unit)}</div>
          <div class="cart-item-controls">
            <button class="qty-btn" data-dec="${line.lineId}" aria-label="Decrease">−</button>
            <span class="qty-display">${line.qty}</span>
            <button class="qty-btn" data-inc="${line.lineId}" aria-label="Increase">+</button>
            <button class="cart-item-remove" data-rm="${line.lineId}">Remove</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  $$('[data-inc]', itemsEl).forEach(b => b.onclick = () => changeQty(b.dataset.inc, 1));
  $$('[data-dec]', itemsEl).forEach(b => b.onclick = () => changeQty(b.dataset.dec, -1));
  $$('[data-rm]', itemsEl).forEach(b => b.onclick = () => removeFromCart(b.dataset.rm));

  if (footerEl) footerEl.style.display = 'block';
  if (totalEl) totalEl.textContent = formatPrice(cartTotal());
}

/* ---------- FAVORITES ---------- */
function toggleFav(id, btn) {
  const idx = favorites.indexOf(id);
  if (idx > -1) {
    favorites.splice(idx, 1);
    btn.classList.remove('active');
    btn.textContent = '🤍';
    toast('Removed from favorites', '💔');
  } else {
    favorites.push(id);
    btn.classList.add('active');
    btn.textContent = '❤️';
    toast('Added to favorites', '❤️');
  }
  saveFavs();
}

/* ---------- OPTION PICKER MODAL ---------- */
function openOptionPicker(product) {
  const modal = $('#optionModal') || createOptionModal();
  const groups = product.options?.groups || [];
  $('#opTitle', modal).textContent = product.name;
  $('#opTitleAr', modal).textContent = product.name_ar || '';
  $('#opPrice', modal).textContent = formatPrice(product.price);

  const body = $('#opBody', modal);
  const selected = {};   // groupId -> value (or array)

  body.innerHTML = groups.map(g => {
    const inputName = `op_${g.id}`;
    return `
      <fieldset class="op-group">
        <legend>
          <strong>${escapeHtml(g.label_en)}</strong>
          ${g.label_ar ? `<span lang="ar" dir="rtl">${escapeHtml(g.label_ar)}</span>` : ''}
          ${g.required ? `<small class="req">required</small>` : ''}
        </legend>
        <div class="op-choices">
          ${(g.choices || []).map(c => `
            <label class="op-choice">
              <input type="${g.multi ? 'checkbox' : 'radio'}"
                     name="${inputName}"
                     value="${escapeHtml(c.value)}"
                     ${g.required && !g.multi ? 'required' : ''} />
              <span class="op-bubble">
                <span class="op-en">${escapeHtml(c.label_en)}</span>
                ${c.label_ar ? `<span class="op-ar" lang="ar" dir="rtl">${escapeHtml(c.label_ar)}</span>` : ''}
                ${c.price_delta_minor ? `<span class="op-delta">+${(c.price_delta_minor/100).toFixed(0)} EGP</span>` : ''}
              </span>
            </label>
          `).join('')}
        </div>
      </fieldset>
    `;
  }).join('');

  // Track selections
  $$('input', body).forEach(input => {
    input.addEventListener('change', () => {
      const name = input.name;
      const groupId = name.replace(/^op_/, '');
      const group = groups.find(g => g.id === groupId);
      if (group?.multi) {
        selected[groupId] = $$(`input[name="${name}"]:checked`, body).map(i => i.value);
      } else {
        selected[groupId] = input.value;
      }
    });
  });

  modal.setAttribute('aria-hidden', 'false');
  modal.classList.add('open');

  // Confirm handler
  const confirmBtn = $('#opConfirm', modal);
  confirmBtn.onclick = () => {
    const errors = [];
    for (const g of groups) {
      const sel = selected[g.id];
      if (g.required && (sel === undefined || sel === '' || (Array.isArray(sel) && sel.length === 0))) {
        errors.push(`${g.label_en} is required`);
      }
    }
    if (errors.length) {
      $('#opError', modal).textContent = errors.join(' · ');
      return;
    }
    addToCart(product, selected);
    closeOptionPicker();
  };
  $('#opError', modal).textContent = '';
}

function closeOptionPicker() {
  const m = $('#optionModal');
  if (!m) return;
  m.classList.remove('open');
  m.setAttribute('aria-hidden', 'true');
}

function createOptionModal() {
  const html = `
    <div class="modal-overlay" id="optionModal" aria-hidden="true">
      <div class="modal" role="dialog" aria-labelledby="opTitle" aria-modal="true">
        <div class="modal-header">
          <div>
            <h2 id="opTitle">Customize</h2>
            <p id="opTitleAr" lang="ar" dir="rtl"></p>
          </div>
          <button class="modal-close" id="opClose" aria-label="Close">×</button>
        </div>
        <div class="modal-body" id="opBody"></div>
        <div class="modal-error" id="opError" role="alert"></div>
        <div class="modal-actions">
          <span class="op-price-display">Price: <strong id="opPrice"></strong></span>
          <button class="btn btn-ghost" id="opCancel">Cancel</button>
          <button class="btn btn-primary" id="opConfirm">Add to cart</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);
  const m = $('#optionModal');
  $('#opClose', m).addEventListener('click', closeOptionPicker);
  $('#opCancel', m).addEventListener('click', closeOptionPicker);
  m.addEventListener('click', (e) => { if (e.target === m) closeOptionPicker(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeOptionPicker(); });
  return m;
}

/* ---------- CART DRAWER OPEN/CLOSE ---------- */
const cartBtn = $('#cartBtn');
const cartClose = $('#cartClose');
const cartDrawer = $('#cartDrawer');
const cartOverlay = $('#cartOverlay');

function openCart() {
  cartDrawer?.classList.add('open');
  cartOverlay?.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeCart() {
  cartDrawer?.classList.remove('open');
  cartOverlay?.classList.remove('open');
  document.body.style.overflow = '';
}
cartBtn?.addEventListener('click', openCart);
cartClose?.addEventListener('click', closeCart);
cartOverlay?.addEventListener('click', closeCart);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCart(); });

/* ---------- NEWSLETTER + CONTACT ---------- */
$('#newsletterForm')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const email = e.target.querySelector('input').value;
  if (!email) return;
  e.target.reset();
  toast(`Welcome aboard! Check ${email} for your code 🎉`, '🎉');
});
// Contact form was replaced by a direct WhatsApp / Instagram CTA.
// Keep this no-op for backwards compat in case any old form is still on a cached page.
$('#contactForm')?.addEventListener('submit', (e) => { e.preventDefault(); });

// Sync the contact CTA WhatsApp link to the live owner number from /api/config-public
fetch(`${API_BASE}/api/config-public`)
  .then(r => r.ok ? r.json() : null)
  .then(c => {
    const link = $('#contactWhatsapp');
    if (link && c?.whatsapp_number) {
      link.href = `https://wa.me/${c.whatsapp_number}`;
    }
  })
  .catch(() => {});

/* ---------- FOOTER YEAR ---------- */
const yearEl = $('#year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

/* ---------- CHECKOUT ---------- */
const DEPOSIT_PCT = 50;  // must match server's DEPOSIT_PCT default
// initCheckout() is called from boot() AFTER auth state has loaded — moved there
// to fix the prefill bug.

async function initCheckout() {
  initPaymentSelector();
  initPayModeSelector();
  await loadDeliverySlots();

  // Show guest banner OR autofill from signed-in user
  if (CURRENT_USER) {
    $('#fullName').value  = CURRENT_USER.name  || '';
    $('#email').value     = CURRENT_USER.email || '';
    $('#phone').value     = stripEgPhone(CURRENT_USER.phone || '');

    // Load addresses
    try {
      const { addresses } = await api('/api/auth/addresses');
      if (addresses?.length) {
        renderAddressPicker(addresses);
      }
    } catch { /* ignored */ }
  } else {
    $('#guestPromptBanner').style.display = 'flex';
  }

  $('#checkoutForm')?.addEventListener('submit', handleCheckout);

  renderOrderSummary();
  // Re-render summary when payMode changes
  $$('input[name="payMode"]').forEach(r => r.addEventListener('change', renderOrderSummary));
}

/* Load available delivery slots and render them as picker chips.
   Shows only slots ≥ 3 days from now (we don't do same-day). */
async function loadDeliverySlots() {
  const wrap = $('#slotsWrap');
  if (!wrap) return;
  try {
    const { slots } = await api('/api/slots');
    const minDeliveryAt = Date.now() + 3 * 24 * 60 * 60 * 1000;  // 3-day minimum lead
    const eligible = (slots || []).filter(s => {
      const t = new Date(s.starts_at + (s.starts_at.endsWith('Z') ? '' : 'Z')).getTime();
      return t >= minDeliveryAt && !s.full;
    });
    if (eligible.length === 0) {
      wrap.innerHTML = `
        <p class="muted" style="padding:12px;background:var(--cream-2);border-radius:10px;text-align:center;">
          No delivery slots are open right now. Place your order anyway — we'll WhatsApp you to schedule.
        </p>
      `;
      return;
    }
    wrap.innerHTML = eligible.map(s => {
      const d = new Date(s.starts_at + (s.starts_at.endsWith('Z') ? '' : 'Z'));
      const dateStr = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
      const timeStr = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
      const left = s.capacity - s.booked;
      return `
        <label class="slot-option">
          <input type="radio" name="slotPick" value="${s.id}" />
          <div class="slot-bubble">
            <strong>${escapeHtml(s.label)}</strong>
            <small>${dateStr} · ${timeStr}</small>
            <span class="slot-capacity">${left} of ${s.capacity} left</span>
          </div>
        </label>
      `;
    }).join('');
    $$('input[name="slotPick"]', wrap).forEach(r => {
      r.addEventListener('change', () => {
        $('#deliverySlotId').value = r.value;
        $$('.slot-option', wrap).forEach(o => o.classList.toggle('selected', o.querySelector('input').checked));
      });
    });
  } catch (err) {
    wrap.innerHTML = `<p class="muted">Couldn't load slots: ${err.message}</p>`;
  }
}

/* Strip a stored phone down to digits-only for the input */
function stripEgPhone(s) {
  if (!s) return '';
  const c = String(s).replace(/[\s\-()]/g, '');
  if (c.startsWith('+20')) return c.slice(3);
  if (c.startsWith('20'))  return c.slice(2);
  return c;
}

function isValidEgPhone(s) {
  const c = String(s || '').replace(/[\s\-()]/g, '');
  return /^(\+?20|0)?1[0125]\d{8}$/.test(c);
}

function renderAddressPicker(addresses) {
  const wrap = $('#savedAddrPicker');
  const sel = $('#savedAddrSelect');
  wrap.style.display = 'block';
  sel.innerHTML =
    '<option value="">— Use a saved address (or fill in below) —</option>' +
    addresses.map(a => `
      <option value="${a.id}">
        ${escapeHtml(a.label || 'Address')}${a.is_default ? ' ⭐' : ''} · ${escapeHtml(a.line1)}${a.city ? ', ' + escapeHtml(a.city) : ''}
      </option>
    `).join('');
  // If there's a default, preselect it
  const def = addresses.find(a => a.is_default);
  if (def) {
    sel.value = String(def.id);
    fillFromAddress(def);
  }
  sel.addEventListener('change', () => {
    const id = sel.value;
    if (!id) return;
    const a = addresses.find(x => String(x.id) === id);
    if (a) fillFromAddress(a);
  });
}

function fillFromAddress(a) {
  $('#address').value = a.line1 || '';
  if (a.city) $('#city').value = a.city;
  if (a.full_name && !$('#fullName').value) $('#fullName').value = a.full_name;
  if (a.phone && !$('#phone').value) $('#phone').value = stripEgPhone(a.phone);
  if (a.notes && !$('#orderNotes').value) $('#orderNotes').value = a.notes;
}

function renderOrderSummary() {
  const wrap = $('#summaryItems');
  if (!wrap) return;
  if (cart.length === 0) {
    wrap.innerHTML = '<p class="cart-empty">No items in cart yet.<br/><a href="../menu.html" class="btn btn-primary" style="margin-top:16px;">Browse Menu</a></p>';
    $('#summaryTotals')?.style.setProperty('display', 'none');
    return;
  }
  wrap.innerHTML = cart.map(line => {
    const p = PRODUCTS.find(p => p.id === line.productId);
    if (!p) return '';
    let unit = p.price;
    const groups = p.options?.groups || [];
    for (const g of groups) {
      const sel = line.options?.[g.id];
      const values = Array.isArray(sel) ? sel : [sel].filter(Boolean);
      for (const v of values) {
        const c = (g.choices || []).find(c => c.value === v);
        if (c?.price_delta_minor) unit += c.price_delta_minor / 100;
      }
    }
    const optDesc = describeSelected(p, line.options);
    return `
      <div class="summary-line">
        <span>${p.emoji || '🍫'} ${escapeHtml(p.name)} × ${line.qty}${optDesc ? `<br><small class="muted">${escapeHtml(optDesc)}</small>` : ''}</span>
        <span>${formatPrice(unit * line.qty)}</span>
      </div>
    `;
  }).join('');
  const subtotal = cartTotal();
  const delivery = subtotal > 0 ? 30 : 0;
  const tax = 0;
  const total = subtotal + delivery + tax;
  $('#sumSubtotal').textContent = formatPrice(subtotal);
  $('#sumDelivery').textContent = formatPrice(delivery);
  $('#sumTax').textContent = formatPrice(tax);
  $('#sumTotal').textContent = formatPrice(total);

  // Deposit math
  const mode = (document.querySelector('input[name="payMode"]:checked')?.value) || 'deposit';
  const deposit = mode === 'full' ? total : Math.ceil(total * (DEPOSIT_PCT / 100));
  const remaining = total - deposit;

  $('#depositAmount').textContent = formatPrice(Math.ceil(total * (DEPOSIT_PCT / 100)));
  $('#depositRemaining').textContent = formatPrice(total - Math.ceil(total * (DEPOSIT_PCT / 100)));
  $('#fullAmount').textContent = formatPrice(total);

  if (mode === 'deposit' && remaining > 0) {
    $('#sumDepositLine').style.display = 'flex';
    $('#sumRemainingLine').style.display = 'flex';
    $('#sumDeposit').textContent = formatPrice(deposit);
    $('#sumRemaining').textContent = formatPrice(remaining);
  } else {
    $('#sumDepositLine').style.display = 'none';
    $('#sumRemainingLine').style.display = 'none';
  }
}

function initPaymentSelector() {
  $$('.payment-option').forEach(opt => {
    opt.addEventListener('click', () => {
      $$('.payment-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      $('#paymentMethod').value = opt.dataset.method;
      const m = opt.dataset.method;
      ['codNotice', 'vcashNotice', 'instapayNotice'].forEach(id => {
        const el = $('#' + id);
        if (el) el.style.display = 'none';
      });
      const map = { cod: 'codNotice', vcash: 'vcashNotice', instapay: 'instapayNotice' };
      const noticeId = map[m];
      if (noticeId) {
        const el = $('#' + noticeId);
        if (el) el.style.display = 'block';
      }
    });
  });
  $('.payment-option')?.click();

  // Populate Vodafone / InstaPay numbers from public config
  fetch(`${API_BASE}/api/config-public`)
    .then(r => r.ok ? r.json() : null)
    .then(c => {
      if (c?.whatsapp_number) {
        const num = '+' + c.whatsapp_number;
        if ($('#vcashNumber')) $('#vcashNumber').textContent = num;
        if ($('#instapayPhone')) $('#instapayPhone').textContent = num;
      }
      if (c?.instapay_handle && $('#instapayHandle')) {
        $('#instapayHandle').textContent = c.instapay_handle;
      }
    })
    .catch(() => {});
}

function initPayModeSelector() {
  $$('.pay-mode-option').forEach(opt => {
    const radio = opt.querySelector('input[type="radio"]');
    opt.addEventListener('click', () => {
      radio.checked = true;
      $$('.pay-mode-option').forEach(o => o.classList.toggle('selected', o.querySelector('input').checked));
      renderOrderSummary();
    });
  });
  // Initial state
  $$('.pay-mode-option').forEach(o => o.classList.toggle('selected', o.querySelector('input').checked));
}

async function handleCheckout(e) {
  e.preventDefault();
  if (cart.length === 0) { toast('Your cart is empty!', '⚠️'); return; }

  const phone = ($('#phone')?.value || '').trim();
  if (!isValidEgPhone(phone)) {
    toast('Please enter a valid Egyptian mobile number (e.g. 01012345678)', '⚠️');
    $('#phone')?.focus();
    return;
  }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  const original = submitBtn?.innerHTML;
  if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<span>Processing…</span>'; }

  const payMode = (document.querySelector('input[name="payMode"]:checked')?.value) || 'deposit';
  const saveAddrAs = $('#saveAddr')?.value;

  const payload = {
    items: cart.map(line => ({ id: line.productId, qty: line.qty, options: line.options || {} })),
    customer: {
      name:    $('#fullName')?.value || CURRENT_USER?.name || '',
      email:   $('#email')?.value    || CURRENT_USER?.email || '',
      phone,
      address: ($('#address')?.value || '') + ($('#city')?.value ? `, ${$('#city').value}` : ''),
      notes:   $('#orderNotes')?.value || '',
    },
    payment_method: $('#paymentMethod')?.value || 'vcash',
    payment_mode: payMode,
    delivery_slot_id: $('#deliverySlotId')?.value ? Number($('#deliverySlotId').value) : null,
  };

  try {
    // Optionally save the address first (signed-in users only)
    if (saveAddrAs && CURRENT_USER) {
      api('/api/auth/addresses', {
        method: 'POST',
        body: JSON.stringify({
          label: saveAddrAs,
          full_name: payload.customer.name,
          phone: payload.customer.phone,
          line1: $('#address').value || '',
          city: $('#city').value || '',
          notes: payload.customer.notes || '',
          is_default: false,
        }),
      }).catch(() => { /* non-fatal */ });
    }

    const data = await api('/api/checkout', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    cart = []; saveCart(); updateCartUI();
    if (['cod', 'vcash', 'instapay'].includes(data.mode) && data.redirect) location.href = data.redirect;
    else if (data.orderId) location.href = 'confirmation.html?id=' + encodeURIComponent(data.orderId);
  } catch (err) {
    toast(`Checkout failed: ${err.message}`, '⚠️');
    if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = original; }
  }
}

/* ---------- CONFIRMATION ---------- */
if (document.body.classList.contains('confirmation-body')) {
  const params = new URLSearchParams(location.search);
  const id = params.get('id') || 'CD-XXXXXX';
  const orderEl = $('#orderId');
  if (orderEl) orderEl.textContent = id;

  // Tracking link
  const trackLink = $('#trackLink');
  if (trackLink && id !== 'CD-XXXXXX') trackLink.href = 'track.html?id=' + encodeURIComponent(id);

  if (id && id !== 'CD-XXXXXX') {
    fetch(`${API_BASE}/api/order/${encodeURIComponent(id)}`)
      .then(r => r.ok ? r.json() : null)
      .then(o => {
        if (!o) return;
        const statusEl = $('#orderStatus');
        if (statusEl) {
          statusEl.textContent = ({
            paid: 'Paid ✅',
            'cod-confirmed': 'Cash on Delivery ✅',
            pending: 'Awaiting payment…',
            failed: 'Payment failed',
            refunded: 'Refunded',
          }[o.status]) || o.status;
        }

        // ----- Build receipt + WhatsApp share -----
        const receipt = buildReceiptText(o);
        if ($('#receiptText')) {
          $('#receiptText').textContent = receipt;
          $('#receiptCard').style.display = 'block';
        }
        // WhatsApp share — opens the share picker so the customer
        // can forward the full receipt to anyone (themselves, family).
        const trackUrl = `${location.origin}/pages/track.html?id=${encodeURIComponent(o.id)}`;
        const shareText = `${receipt}\n\n📦 Track live: ${trackUrl}`;
        const shareLink = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
        const wa = $('#whatsappShareLink');
        if (wa) {
          wa.href = shareLink;
          wa.style.display = 'inline-flex';
        }
        // Copy-to-clipboard button
        $('#copyReceiptBtn')?.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(receipt);
            toast('Receipt copied to clipboard ✓');
          } catch { toast('Could not copy', '⚠️'); }
        });

        // Loyalty earned
        const paid = o.payment_mode === 'full' ? o.total_cents : (o.deposit_cents || 0);
        const pts = Math.floor(paid / 1000);
        if (pts > 0) {
          const badge = $('#loyaltyBadge');
          if (badge) {
            $('#ptsEarned').textContent = pts;
            badge.style.display = 'block';
          }
        }
      })
      .catch(() => {});
  }
}

function buildReceiptText(o) {
  const fmt = (cents) => {
    const v = (cents || 0) / 100;
    return `${Number.isInteger(v) ? v : v.toFixed(2)} EGP`;
  };
  const items = (o.items || []).map(i => `• ${i.name} × ${i.qty} — ${fmt(i.price_cents * i.qty)}`).join('\n');
  const lines = [
    '🍫 ChocoDoDo — Order Receipt',
    `Order ID: ${o.id}`,
    `Date: ${new Date(o.created_at + 'Z').toLocaleString()}`,
    '',
    items,
    '',
    `Total: ${fmt(o.total_cents)}`,
  ];
  if (o.payment_mode === 'deposit' && o.deposit_cents) {
    lines.push(`Deposit paid: ${fmt(o.deposit_cents)}`);
    lines.push(`Remaining on delivery: ${fmt(o.remaining_cents)}`);
  }
  lines.push('');
  lines.push('From our kitchen to you 🍫');
  return lines.join('\n');
}

/* ---------- BOOT ---------- */
async function boot() {
  // Auth state must complete before we hit the checkout, so the
  // form prefill knows the signed-in user (CURRENT_USER).
  await Promise.all([loadProducts(), loadCategories(), loadAuthState(), loadReviewSummaries()]);
  renderMenuFilters();
  await renderFeatured();
  setupMenu();
  if (document.body.classList.contains('checkout-body')) {
    await initCheckout();
  }
  updateCartUI();
}
boot();
