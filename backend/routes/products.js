// Public products API — read-only, only published items.
const express = require('express');
const dbApi = require('../lib/db');

const router = express.Router();

// GET /api/products  — public list of published products
router.get('/', (req, res) => {
  const products = dbApi.listProductsPublished().map(p => ({
    id: p.id,
    cat: p.cat,
    sub: p.sub,
    name: p.name,
    name_ar: p.name_ar,
    price: p.price,                  // EGP
    desc: p.desc,
    desc_ar: p.desc_ar,
    image: p.image,
    emoji: p.emoji,
    badge: p.badge,
    options: p.options,              // includes choices for option-picker UI
  }));
  res.json({ products });
});

// GET /api/products/:id
router.get('/:id', (req, res) => {
  const p = dbApi.getProductById(req.params.id);
  if (!p || !p.published) return res.status(404).json({ error: 'Not found' });
  res.json({ product: p });
});

module.exports = router;
module.exports.categoriesRouter = (function() {
  const r = express.Router();
  r.get('/', (req, res) => {
    res.json({ categories: dbApi.listCategoriesPublished() });
  });
  return r;
})();
