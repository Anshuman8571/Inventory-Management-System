const db = require('../config/db');

function runner(client) {
  return client || db;
}

async function create({ productId, price, billId, tradeDiscount, schemeDiscount, gstPercent }, client) {
  const result = await runner(client).query(
    `INSERT INTO price_history (product_id, price, bill_id, trade_discount, scheme_discount, gst_percent)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [productId, price, billId || null, tradeDiscount ?? null, schemeDiscount ?? null, gstPercent ?? null]
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