const db = require('../config/db');

function runner(client) {
  return client || db;
}

async function create({ productId, changeQty, scanEventId }, client) {
  const result = await runner(client).query(
    `INSERT INTO stock_movements (product_id, change_qty, scan_event_id)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [productId, changeQty, scanEventId || null]
  );
  return result.rows[0];
}

async function findByProduct(productId, client) {
  const result = await runner(client).query(
    'SELECT * FROM stock_movements WHERE product_id = $1 ORDER BY created_at DESC',
    [productId]
  );
  return result.rows;
}

module.exports = { create, findByProduct };
