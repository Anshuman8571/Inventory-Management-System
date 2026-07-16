const db = require('../config/db');

function runner(client) {
  return client || db;
}

async function create(
  { flowType, source, imagePath, categorySelected, rawExtracted, matchedProductId, isNewProduct },
  client
) {
  const result = await runner(client).query(
    `INSERT INTO scan_events
       (flow_type, source, image_path, category_selected, raw_extracted, matched_product_id, is_new_product)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      flowType,
      source,
      imagePath || null,
      categorySelected,
      rawExtracted,
      matchedProductId || null,
      isNewProduct || false,
    ]
  );
  return result.rows[0];
}

async function findById(id, client) {
  const result = await runner(client).query('SELECT * FROM scan_events WHERE id = $1', [id]);
  return result.rows[0] || null;
}

// Locks the row for the duration of a transaction so two people can't confirm the
// same scan event twice concurrently (e.g. two taps on "Confirm" in quick succession).
async function findByIdForUpdate(id, client) {
  const result = await client.query('SELECT * FROM scan_events WHERE id = $1 FOR UPDATE', [id]);
  return result.rows[0] || null;
}

async function confirm({ id, finalData, qty, confirmedBy }, client) {
  const result = await runner(client).query(
    `UPDATE scan_events
     SET final_data = $1, qty = $2, confirmed_by = $3
     WHERE id = $4
     RETURNING *`,
    [finalData, qty, confirmedBy, id]
  );
  return result.rows[0];
}

module.exports = { create, findById, findByIdForUpdate, confirm };
