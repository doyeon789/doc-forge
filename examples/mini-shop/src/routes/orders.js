const express = require('express');
const auth = require('../middleware/auth');
const orderService = require('../services/orderService');

const router = express.Router();

router.post('/orders', auth, async (req, res, next) => {
  try {
    const order = await orderService.createOrder(req.user.id, req.body.items || []);
    res.status(201).json(order);
  } catch (e) {
    next(e);
  }
});

router.get('/orders', auth, async (req, res, next) => {
  try {
    res.json(await orderService.listOrders(req.user.id));
  } catch (e) {
    next(e);
  }
});

module.exports = router;
