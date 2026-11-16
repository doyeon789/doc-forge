const express = require('express');
const { products, findProduct } = require('../data/catalog');

const router = express.Router();

router.get('/products', (req, res) => {
  res.json(products.slice(0, 50));
});

router.get('/products/:sku', (req, res) => {
  const p = findProduct(req.params.sku);
  if (!p) return res.status(404).json({ error: 'not found' });
  res.json(p);
});

module.exports = router;
