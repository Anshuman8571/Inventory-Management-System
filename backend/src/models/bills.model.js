const db = require('../config/db');

async function createBill({ uploadedByUserId, supplierName }, client = db) {
  const result = await client.query(
    'INSERT INTO bills (uploaded_by_user_id, supplier_name) VALUES ($1, $2) RETURNING *',
    [uploadedByUserId, supplierName || null]
  );
  return result.rows[0];
}

async function createBillLineItem(
  { billId, matchedProductId, rawExtracted, isNewProduct, unitPrice, hsnCode, tradeDiscount, schemeDiscount, gstPercent, netAmount },
  client = db
) {
  const result = await client.query(
    `INSERT INTO bill_line_items 
      (bill_id, matched_product_id, raw_extracted, is_new_product, unit_price, hsn_code, trade_discount, scheme_discount, gst_percent, net_amount) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [billId, matchedProductId, rawExtracted, isNewProduct, unitPrice ?? null, hsnCode ?? null, tradeDiscount ?? null, schemeDiscount ?? null, gstPercent ?? null, netAmount ?? null]
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

async function updateBillLineItem(id, fields, client = db) {
  let query = 'UPDATE bill_line_items SET confirmed = $1';
  const params = [fields.confirmed];
  let paramIdx = 2;

  if (fields.confirmedQty !== undefined) {
    query += `, confirmed_qty = $${paramIdx++}`;
    params.push(fields.confirmedQty);
  }
  if (fields.unitPrice !== undefined) {
    query += `, unit_price = $${paramIdx++}`;
    params.push(fields.unitPrice);
  }
  if (fields.hsnCode !== undefined) {
    query += `, hsn_code = $${paramIdx++}`;
    params.push(fields.hsnCode);
  }
  if (fields.tradeDiscount !== undefined) {
    query += `, trade_discount = $${paramIdx++}`;
    params.push(fields.tradeDiscount);
  }
  if (fields.schemeDiscount !== undefined) {
    query += `, scheme_discount = $${paramIdx++}`;
    params.push(fields.schemeDiscount);
  }
  if (fields.gstPercent !== undefined) {
    query += `, gst_percent = $${paramIdx++}`;
    params.push(fields.gstPercent);
  }

  query += ` WHERE id = $${paramIdx} RETURNING *`;
  params.push(id);

  const result = await client.query(query, params);
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