const db = require('../config/db');

async function createBill({ uploadedByUserId, supplierName }, client = db) {
  const result = await client.query(
    'INSERT INTO bills (uploaded_by_user_id, supplier_name) VALUES ($1, $2) RETURNING *',
    [uploadedByUserId, supplierName || null]
  );
  return result.rows[0];
}

async function createBillLineItem(
  { billId, matchedProductId, rawExtracted, isNewProduct },
  client = db
) {
  const result = await client.query(
    `INSERT INTO bill_line_items 
      (bill_id, matched_product_id, raw_extracted, is_new_product) 
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [billId, matchedProductId, rawExtracted, isNewProduct]
  );
  return result.rows[0];
}

async function getBillLineItems(billId, client = db) {
  const result = await client.query(
    `SELECT bli.*, p.name as matched_name, p.current_qty 
     FROM bill_line_items bli 
     LEFT JOIN products p ON bli.matched_product_id = p.id 
     WHERE bli.bill_id = $1 ORDER BY bli.id`,
    [billId]
  );
  return result.rows;
}

// Locks the row for the duration of a transaction so the same line item can't be
// confirmed twice concurrently (e.g. a double-tap or a retried network request) —
// same pattern as scanEvents.model.js's findByIdForUpdate.
async function findLineItemForUpdate(id, client) {
  const result = await client.query(
    'SELECT * FROM bill_line_items WHERE id = $1 FOR UPDATE',
    [id]
  );
  return result.rows[0] || null;
}

async function updateBillLineItem(id, { confirmedQty, confirmed }, client = db) {
  const result = await client.query(
    'UPDATE bill_line_items SET confirmed_qty = $1, confirmed = $2 WHERE id = $3 RETURNING *',
    [confirmedQty, confirmed, id]
  );
  return result.rows[0];
}

async function updateTotalItems(billId, count, client = db) {
  const result = await client.query(
    'UPDATE bills SET total_items = $1 WHERE id = $2 RETURNING *',
    [count, billId]
  );
  return result.rows[0];
}

module.exports = {
  createBill,
  createBillLineItem,
  getBillLineItems,
  findLineItemForUpdate,
  updateBillLineItem,
  updateTotalItems,
};