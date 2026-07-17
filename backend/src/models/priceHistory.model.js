const db = require('../config/db');

function runner(client) {
  return client || db;
}

async function create({ productId, price, billId }, client) {
  const result = await runner(client).query(
    `INSERT INTO price_history (product_id, price, bill_id)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [productId, price, billId || null]
  );
  return result.rows[0];
}

async function findByProduct(productId, client) {
  const result = await runner(client).query(
    'SELECT * FROM price_history WHERE product_id = $1 ORDER BY recorded_at DESC',
    [productId]
  );
  return result.rows;
}

module.exports = { create, findByProduct };