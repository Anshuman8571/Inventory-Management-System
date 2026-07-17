// All SQL for the products table. Functions accept an optional `client` (a pg transaction
// client) as the last argument — when provided (from inventory.service.js), queries run
// inside that transaction; otherwise they use the shared pool directly.

const db = require('../config/db');

function runner(client) {
  return client || db;
}

async function findByCategory(category, client) {
  const query = category
    ? 'SELECT id, name, company, unit, current_qty, attributes FROM products WHERE category = $1'
    : 'SELECT id, name, company, unit, current_qty, attributes FROM products';
  const params = category ? [category] : [];

  const result = await runner(client).query(query, params);
  return result.rows;
}

async function findById(id, client) {
  const result = await runner(client).query('SELECT * FROM products WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function create({ category, name, company, unit, attributes, initialQty }, client) {
  const result = await runner(client).query(
    `INSERT INTO products (category, name, company, unit, current_qty, attributes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [category, name, company || null, unit || 'pcs', initialQty || 0, attributes || {}]
  );
  return result.rows[0];
}

// delta can be negative (take-out) or positive (add-stock) — this is the only function
// that should ever change current_qty.
async function incrementQty(id, delta, client) {
  const result = await runner(client).query(
    `UPDATE products SET current_qty = current_qty + $1 WHERE id = $2 RETURNING *`,
    [delta, id]
  );
  return result.rows[0];
}

// The only function that should ever change last_known_price — called from
// pricing.service.js during bill confirmation.
async function updatePrice(id, price, client) {
  const result = await runner(client).query(
    `UPDATE products SET last_known_price = $1 WHERE id = $2 RETURNING *`,
    [price, id]
  );
  return result.rows[0];
}

async function list(client) {
  const result = await runner(client).query(
    'SELECT id, category, name, company, unit, current_qty, last_known_price, low_stock_at, attributes FROM products ORDER BY category, name'
  );
  return result.rows;
}

module.exports = { findByCategory, findById, create, incrementQty, updatePrice, list };