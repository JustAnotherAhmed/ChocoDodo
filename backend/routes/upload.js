// Admin-only image upload route.
// Accepts a single file under field name "image", saves it to
// /assets/images/products/<safe-filename>.<ext>, returns the relative path.
//
// Validation:
//   - allowed mime types: image/jpeg, image/png, image/webp, image/gif
//   - max size: 5 MB

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const dbApi = require('../lib/db');

const router = express.Router();

const UPLOAD_DIR = path.resolve(__dirname, '..', '..', 'assets', 'images', 'products');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_BYTES = 5 * 1024 * 1024;
const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png':  '.png',
  'image/webp': '.webp',
  'image/gif':  '.gif',
};

function safeBase(name) {
  return String(name || 'image')
    .toLowerCase()
    .replace(/\.[^.]+$/, '')                // strip ext
    .replace(/[^a-z0-9_-]+/g, '-')          // keep slug chars
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'image';
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const productId = (req.params.id || req.body.product_id || 'product').replace(/[^a-z0-9_-]/gi, '');
    const base = productId || safeBase(file.originalname);
    const ext = EXT_BY_MIME[file.mimetype] || path.extname(file.originalname).toLowerCase() || '.jpg';
    const stamp = crypto.randomBytes(4).toString('hex');
    cb(null, `${base}-${Date.now().toString(36)}${stamp}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) {
      return cb(new Error('Only JPG, PNG, WebP, or GIF images are allowed'));
    }
    cb(null, true);
  },
});

// POST /api/admin/upload/image           — generic upload (returns path)
router.post('/image', (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const relPath = `assets/images/products/${req.file.filename}`;
    res.json({
      ok: true,
      path: relPath,
      bytes: req.file.size,
      mime: req.file.mimetype,
    });
  });
});

// POST /api/admin/upload/product/:id     — upload AND auto-attach to a product
router.post('/product/:id', (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const product = dbApi.getProductById(req.params.id);
    if (!product) {
      // Clean up the file we just wrote
      try { fs.unlinkSync(path.join(UPLOAD_DIR, req.file.filename)); } catch {}
      return res.status(404).json({ error: 'Product not found' });
    }
    const relPath = `assets/images/products/${req.file.filename}`;
    dbApi.setProductImage(req.params.id, relPath);
    res.json({
      ok: true,
      path: relPath,
      product: dbApi.getProductById(req.params.id),
    });
  });
});

module.exports = router;
