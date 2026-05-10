// Reviews — public read (approved only) + customer create + admin moderate
const express = require('express');
const dbApi = require('../lib/db');
const auth = require('../lib/auth');

const router = express.Router();

// GET /api/reviews/summary — { productId: {avg, count}, ... } for ALL products at once
router.get('/summary', (req, res) => {
  const rows = dbApi.db.prepare(`
    SELECT product_id, AVG(rating) AS avg, COUNT(*) AS n
    FROM reviews
    WHERE approved = 1
    GROUP BY product_id
  `).all();
  const summary = {};
  for (const r of rows) {
    summary[r.product_id] = {
      avg: r.avg ? Number(r.avg.toFixed(2)) : null,
      count: r.n || 0,
    };
  }
  res.json({ summary });
});

// GET /api/reviews/:productId — list approved reviews + summary
router.get('/:productId', (req, res) => {
  const reviews = dbApi.listReviewsForProduct(req.params.productId);
  const summary = dbApi.reviewSummary(req.params.productId);
  res.json({
    reviews,
    summary: { avg: summary.avg ? Number(summary.avg.toFixed(2)) : null, count: summary.n || 0 },
  });
});

// POST /api/reviews — signed-in customer leaves a review
router.post('/', auth.attachCustomer, auth.requireCustomer, (req, res) => {
  const { product_id, rating, title, body } = req.body || {};
  if (!product_id) return res.status(400).json({ error: 'product_id required' });
  const r = Math.max(1, Math.min(5, parseInt(rating, 10) || 0));
  if (!r) return res.status(400).json({ error: 'rating must be 1-5' });
  const product = dbApi.getProductById(product_id);
  if (!product) return res.status(404).json({ error: 'Unknown product' });

  dbApi.insertReview({
    product_id,
    customer_id: req.customer.id,
    rating: r,
    title: (title || '').trim().slice(0, 80) || null,
    body: (body || '').trim().slice(0, 1500) || null,
    photo: null,
    approved: 1,  // auto-publish — admin can delete later if needed
  });
  res.json({ ok: true, message: 'Thanks! Your review is live.' });
});

module.exports = router;
