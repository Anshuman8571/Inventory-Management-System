// All SQL for the products table. Functions accept an optional `client` (a pg transaction
// client) as the last argument — when provided (from inventory.service.js), queries run
// inside that transaction; otherwise they use the shared pool directly.

const db = require('../config/db');

function runner(client) {
  return client || db;
}

async function findByCategory(category, client) {
  const query = category
    ? 'SELECT id, name, company, unit, current_qty, attributes FROM products WHERE category = $1 AND deleted_at IS NULL'
    : 'SELECT id, name, company, unit, current_qty, attributes FROM products WHERE deleted_at IS NULL';
  const params = category ? [category] : [];

  const result = await runner(client).query(query, params);
  return result.rows;
}

async function findById(id, client) {
  const result = await runner(client).query('SELECT * FROM products WHERE id = $1 AND deleted_at IS NULL', [id]);
  return result.rows[0] || null;
}

async function create({ category, name, company, unit, attributes, initialQty, hsnCode, lowStockAt }, client) {
  const result = await runner(client).query(
    `INSERT INTO products (category, name, company, unit, current_qty, attributes, hsn_code, low_stock_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      category,
      name,
      company || null,
      unit || 'pcs',
      initialQty || 0,
      attributes || {},
      hsnCode || null,
      lowStockAt != null ? lowStockAt : 0,
    ]
  );
  return result.rows[0];
}

// Partial update for fixing a mis-scanned entry (name/size/company/unit) or setting
// a reorder threshold after the fact — neither had any UI/API path before this.
// Only touches fields actually provided; attributes are shallow-merged (not replaced)
// so e.g. updating `size` doesn't wipe out other attribute keys already on the product.
async function update(id, { name, company, unit, lowStockAt, attributes }, client) {
  const existing = await findById(id, client);
  if (!existing) return null;

  const mergedAttributes = attributes
    ? { ...(existing.attributes || {}), ...attributes }
    : existing.attributes;

  const result = await runner(client).query(
    `UPDATE products
     SET name = $1, company = $2, unit = $3, low_stock_at = $4, attributes = $5
     WHERE id = $6
     RETURNING *`,
    [
      name != null ? name : existing.name,
      company !== undefined ? company : existing.company,
      unit != null ? unit : existing.unit,
      lowStockAt != null ? lowStockAt : existing.low_stock_at,
      mergedAttributes,
      id,
    ]
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
     WHERE p.deleted_at IS NULL
     ORDER BY p.category, p.name`
  );
  return result.rows;
}

async function softDelete(id, client) {
  const result = await runner(client).query(
    `UPDATE products SET deleted_at = NOW() WHERE id = $1 RETURNING *`,
    [id]
  );
  return result.rows[0];
}

module.exports = { findByCategory, findById, create, update, incrementQty, updatePrice, list, softDelete };