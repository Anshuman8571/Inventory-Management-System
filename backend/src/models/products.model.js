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

// previous_price comes from a LATERAL join to price_history: the second-most-recent
// price entry for each product (the one before last_known_price), so the frontend can
// show a real up/down trend arrow instead of guessing from a single data point.
async function list(client) {
  const result = await runner(client).query(
    `SELECT p.id, p.category, p.name, p.company, p.unit, p.current_qty, p.last_known_price,
            p.low_stock_at, p.attributes, ph.price AS previous_price
     FROM products p
     LEFT JOIN LATERAL (
       SELECT price FROM price_history
       WHERE product_id = p.id
       ORDER BY recorded_at DESC
       OFFSET 1 LIMIT 1
     ) ph ON true
     ORDER BY p.category, p.name`
  );
  return result.rows;
}

module.exports = { findByCategory, findById, create, incrementQty, updatePrice, list };