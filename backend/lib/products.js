// Server-side product catalog — DB-backed.
// On first boot, seeds the products table from DEFAULT_PRODUCTS.
// After that, the admin panel becomes the source of truth.
//
// Prices are stored as piastres (×100 EGP).

const dbApi = require('./db');

const FILLINGS = [
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

const FILLING_GROUP = {
  id: 'filling',
  label_en: 'Choose your filling',
  label_ar: 'اختر الحشوة',
  required: true,
  multi: false,
  choices: FILLINGS.map(f => ({ ...f, price_delta_minor: 0 })),
};

// Initial seed catalog. Prices in EGP.
const DEFAULT_PRODUCTS = [
  // Stuffed
  { id: 'sc500', cat: 'chocolate', sub: 'stuffed',
    name: 'Stuffed Chocolate — ½ Kilo',
    name_ar: 'نص كيلو شكولاتة محشى',
    price: 450, badge: 'hot', emoji: '🍫',
    image: 'assets/images/products/stuffed-half.jpg',
    desc: 'Premium chocolate stuffed with your choice of filling. Half kilo — perfect for sharing.',
    desc_ar: 'شكولاتة فاخرة محشية بالحشوة التي تختارها — نص كيلو، مثالية للمشاركة.',
    options: { groups: [FILLING_GROUP] }, sort_order: 10 },
  { id: 'sc250', cat: 'chocolate', sub: 'stuffed',
    name: 'Stuffed Chocolate — ¼ Kilo',
    name_ar: 'ربع كيلو شكولاتة محشية',
    price: 225, emoji: '🍫',
    image: 'assets/images/products/stuffed-quarter.jpg',
    desc: 'Premium chocolate stuffed with your choice of filling. Quarter kilo treat.',
    desc_ar: 'شكولاتة فاخرة محشية بالحشوة التي تختارها — ربع كيلو.',
    options: { groups: [FILLING_GROUP] }, sort_order: 20 },

  // Plain
  { id: 'pc500', cat: 'chocolate', sub: 'plain',
    name: 'Plain Chocolate — ½ Kilo', name_ar: 'نص كيلو شكولاتة سادة',
    price: 400, emoji: '🍫',
    image: 'assets/images/products/plain-half.jpg',
    desc: 'Pure, smooth premium chocolate. Half kilo. No fillings, just chocolate bliss.',
    desc_ar: 'شكولاتة فاخرة نقية وناعمة — نص كيلو من المتعة الخالصة.',
    sort_order: 30 },
  { id: 'pc250', cat: 'chocolate', sub: 'plain',
    name: 'Plain Chocolate — ¼ Kilo', name_ar: 'ربع كيلو شكولاتة سادة',
    price: 200, emoji: '🍫',
    image: 'assets/images/products/plain-quarter.jpg',
    desc: 'Pure, smooth premium chocolate. Quarter kilo.',
    desc_ar: 'شكولاتة فاخرة نقية وناعمة — ربع كيلو.',
    sort_order: 40 },

  // Mixed
  { id: 'mc250', cat: 'chocolate', sub: 'mixed',
    name: 'Mixed Chocolate w/ Snickers — ¼ Kilo',
    name_ar: 'ربع كيلو شكولاتة مشكل ومعاها سنيكرز',
    price: 250, emoji: '🍬', badge: 'new',
    image: 'assets/images/products/mixed-snickers.jpg',
    desc: 'A taste of everything — assorted chocolates plus our signature Snickers. Quarter kilo.',
    desc_ar: 'تشكيلة شاملة — مجموعة شكولاتات متنوعة مع سنيكرز الشهير. ربع كيلو.',
    sort_order: 50 },

  // Snickers
  { id: 'sn500', cat: 'chocolate', sub: 'snickers',
    name: 'Snickers Chocolate — ½ Kilo', name_ar: 'نص كيلو سنيكرز',
    price: 350, emoji: '🥜', badge: 'hot',
    image: 'assets/images/products/snickers-half.jpg',
    desc: 'Our signature Snickers-style chocolate — peanutty, caramelly, irresistible. Half kilo.',
    desc_ar: 'شكولاتة سنيكرز المميزة — بالفول السوداني والكراميل، لا تُقاوم. نص كيلو.',
    sort_order: 60 },
  { id: 'sn250', cat: 'chocolate', sub: 'snickers',
    name: 'Snickers Chocolate — ¼ Kilo', name_ar: 'ربع كيلو سنيكرز',
    price: 175, emoji: '🥜',
    image: 'assets/images/products/snickers-quarter.jpg',
    desc: 'Our signature Snickers-style chocolate. Quarter kilo.',
    desc_ar: 'شكولاتة سنيكرز المميزة — ربع كيلو.',
    sort_order: 70 },

  // Biscuits
  { id: 'b1000', cat: 'biscuits', sub: 'regular',
    name: 'Biscuits — 1 Kilo', name_ar: 'كيلو البسكويت',
    price: 450, emoji: '🍪',
    image: 'assets/images/products/biscuits-kilo.jpg',
    desc: 'A full kilo of our handmade biscuits — soft, buttery, baked fresh.',
    desc_ar: 'كيلو كامل من البسكويت المصنوع يدوياً — طري، زبدي، طازج.',
    sort_order: 100 },
  { id: 'b500', cat: 'biscuits', sub: 'regular',
    name: 'Biscuits — ½ Kilo', name_ar: 'النص كيلو البسكويت',
    price: 225, emoji: '🍪',
    image: 'assets/images/products/biscuits-half.jpg',
    desc: 'Half a kilo of our handmade biscuits.',
    desc_ar: 'نص كيلو من البسكويت المصنوع يدوياً.',
    sort_order: 110 },

  // Diet Biscuits
  { id: 'd1000', cat: 'biscuits', sub: 'diet',
    name: 'Diet Biscuits — 1 Kilo', name_ar: 'كيلو بسكويت الدايت',
    price: 500, emoji: '🌾', badge: 'new',
    image: 'assets/images/products/diet-biscuits-kilo.jpg',
    desc: 'A full kilo of diet-friendly biscuits — wholesome, lower-sugar, full of flavor.',
    desc_ar: 'كيلو من البسكويت الصحي للدايت — مفيد، قليل السكر، غني بالنكهة.',
    sort_order: 120 },
  { id: 'd500', cat: 'biscuits', sub: 'diet',
    name: 'Diet Biscuits — ½ Kilo', name_ar: 'النص كيلو بسكويت دايت',
    price: 250, emoji: '🌾',
    image: 'assets/images/products/diet-biscuits-half.jpg',
    desc: 'Half a kilo of our diet-friendly biscuits.',
    desc_ar: 'نص كيلو من البسكويت الصحي للدايت.',
    sort_order: 130 },
];

function toRow(p) {
  return {
    id: p.id,
    cat: p.cat,
    sub: p.sub || null,
    name: p.name,
    name_ar: p.name_ar || '',
    price_minor: Math.round((p.price ?? 0) * 100),
    desc: p.desc || '',
    desc_ar: p.desc_ar || '',
    image: p.image || '',
    emoji: p.emoji || '🍫',
    badge: p.badge || null,
    options_json: p.options ? JSON.stringify(p.options) : null,
    published: p.published === false ? 0 : 1,
    sort_order: p.sort_order ?? 0,
    track_stock: p.track_stock ? 1 : 0,
    stock: Number.isFinite(Number(p.stock)) ? Math.max(0, Math.floor(Number(p.stock))) : 0,
    low_stock_at: Number.isFinite(Number(p.low_stock_at)) ? Math.max(0, Math.floor(Number(p.low_stock_at))) : 5,
  };
}

/** Seed products on first boot — only if table is empty. */
function seedProductsIfEmpty() {
  if (dbApi.productCount() > 0) return false;
  const insert = dbApi.db.transaction((items) => {
    for (const p of items) dbApi.insertProduct(toRow(p));
  });
  insert(DEFAULT_PRODUCTS);
  console.log(`✅ Seeded ${DEFAULT_PRODUCTS.length} products`);
  return true;
}

const DEFAULT_CATEGORIES = [
  { id: 'chocolate', name_en: 'Chocolate', name_ar: 'شكولاتة', emoji: '🍫', sort_order: 10 },
  { id: 'biscuits',  name_en: 'Biscuits',  name_ar: 'بسكويت',  emoji: '🍪', sort_order: 20 },
];

function seedCategoriesIfEmpty() {
  if (dbApi.categoryCount() > 0) return false;
  for (const c of DEFAULT_CATEGORIES) {
    dbApi.insertCategory({ ...c, published: 1 });
  }
  console.log(`✅ Seeded ${DEFAULT_CATEGORIES.length} categories`);
  return true;
}

const byId = (id) => dbApi.getProductById(id);
const allPublished = () => dbApi.listProductsPublished();
const allProducts = () => dbApi.listProductsAll();

module.exports = {
  DEFAULT_PRODUCTS,
  DEFAULT_CATEGORIES,
  FILLINGS,
  toRow,
  seedProductsIfEmpty,
  seedCategoriesIfEmpty,
  byId,
  allProducts,
  allPublished,
};
