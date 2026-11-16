const db = require('../db');
const events = require('../events');
const { findProduct } = require('../data/catalog');

async function createOrder(userId, items) {
  let total = 0;
  for (const item of items) {
    const product = findProduct(item.sku);
    if (!product) {
      const err = new Error(`unknown sku ${item.sku}`);
      err.status = 400;
      throw err;
    }
    total += product.price * item.qty;
  }
  const { rows } = await db.query(
    'INSERT INTO orders (user_id, items, total) VALUES ($1, $2, $3) RETURNING id',
    [userId, JSON.stringify(items), total],
  );
  const order = { id: rows[0].id, userId, items, total };
  events.emit('order:created', order);
  return order;
}

async function listOrders(userId) {
  const { rows } = await db.query('SELECT id, items, total FROM orders WHERE user_id = $1', [userId]);
  return rows;
}

module.exports = { createOrder, listOrders };
