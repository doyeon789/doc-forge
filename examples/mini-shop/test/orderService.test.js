const test = require('node:test');
const assert = require('node:assert');
const Module = require('module');
const users = require('./fixtures/users.json');

// stub the db before orderService loads it
const dbPath = require.resolve('../src/db');
Module._cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { query: async () => ({ rows: [{ id: 42 }] }) } };

const events = require('../src/events');
const orderService = require('../src/services/orderService');

test('createOrder emits order:created', async () => {
  let seen = null;
  events.once('order:created', o => { seen = o; });
  const order = await orderService.createOrder(users[0].id, [{ sku: 'SKU-0001', qty: 2 }]);
  assert.strictEqual(order.id, 42);
  assert.strictEqual(seen.id, 42);
});
