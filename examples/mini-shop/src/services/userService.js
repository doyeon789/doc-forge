const jwt = require('jsonwebtoken');
const db = require('../db');
const config = require('../config');

async function login(email, password) {
  const { rows } = await db.query('SELECT id, email, password FROM users WHERE email = $1', [email]);
  const user = rows[0];
  if (!user || user.password !== password) {
    const err = new Error('bad credentials');
    err.status = 401;
    throw err;
  }
  return jwt.sign({ id: user.id, email: user.email }, config.jwtSecret, { expiresIn: '1h' });
}

async function findById(id) {
  const { rows } = await db.query('SELECT id, email FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

module.exports = { login, findById };
