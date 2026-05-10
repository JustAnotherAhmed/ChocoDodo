// Public delivery slots API
const express = require('express');
const dbApi = require('../lib/db');
const router = express.Router();

router.get('/', (req, res) => {
  const slots = dbApi.listSlots().map(s => ({
    id: s.id,
    label: s.label,
    starts_at: s.starts_at,
    capacity: s.capacity,
    booked: s.booked,
    full: s.booked >= s.capacity,
  }));
  res.json({ slots });
});

module.exports = router;
