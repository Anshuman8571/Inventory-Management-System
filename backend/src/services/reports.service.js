// Aggregation queries for the owner-facing Reports view. Read-only — never mutates
// anything, so no transaction handling needed here (unlike inventory.service.js).

const db = require('../config/db');

// Total stock value (qty × last known price), overall and per category. Products with
// no recorded price yet contribute 0 to value (not counted as unknown/error) — a price
// only exists once a bill has been confirmed for that product at least once.
async function getStockValueSummary() {
  const totalResult = await db.query(
    `SELECT COALESCE(SUM(current_qty * COALESCE(last_known_price, 0)), 0) AS total_value
     FROM products`
  );

  const byCategoryResult = await db.query(
    `SELECT category, COALESCE(SUM(current_qty * COALESCE(last_known_price, 0)), 0) AS value
     FROM products
     GROUP BY category
     ORDER BY category`
  );

  return {
    totalValue: Number(totalResult.rows[0].total_value),
    byCategory: byCategoryResult.rows.map((r) => ({ category: r.category, value: Number(r.value) })),
  };
}

// Products taken out the most over the given period — "fastest movers." Only counts
// take-out movements (negative change_qty), since add-stock movements aren't sales/usage.
async function getTopMovers({ days = 30, limit = 10 } = {}) {
  const result = await db.query(
    `SELECT p.id, p.name, p.category, p.unit, SUM(ABS(sm.change_qty)) AS total_taken_out
     FROM stock_movements sm
     JOIN products p ON sm.product_id = p.id
     WHERE sm.change_qty < 0 AND sm.created_at >= NOW() - ($1 || ' days')::INTERVAL
     GROUP BY p.id, p.name, p.category, p.unit
     ORDER BY total_taken_out DESC
     LIMIT $2`,
    [days, limit]
  );
  return result.rows.map((r) => ({
    productId: r.id,
    name: r.name,
    category: r.category,
    unit: r.unit,
    totalTakenOut: Number(r.total_taken_out),
  }));
}

// Most recent price changes across all products (not per-product history — this is
// "what changed recently," for a quick at-a-glance view). Uses a window function to
// compare each price entry to the one before it for the same product.
async function getRecentPriceChanges({ limit = 20 } = {}) {
  const result = await db.query(
    `SELECT * FROM (
       SELECT
         ph.product_id,
         p.name,
         p.category,
         ph.price,
         ph.recorded_at,
         LAG(ph.price) OVER (PARTITION BY ph.product_id ORDER BY ph.recorded_at) AS previous_price
       FROM price_history ph
       JOIN products p ON ph.product_id = p.id
     ) sub
     WHERE previous_price IS NULL OR previous_price != price
     ORDER BY recorded_at DESC
     LIMIT $1`,
    [limit]
  );

  return result.rows.map((r) => {
    const previousPrice = r.previous_price != null ? Number(r.previous_price) : null;
    const price = Number(r.price);
    let changeType = 'first';
    if (previousPrice != null) {
      changeType = price > previousPrice ? 'increase' : price < previousPrice ? 'decrease' : 'same';
    }
    return {
      productId: r.product_id,
      name: r.name,
      category: r.category,
      price,
      previousPrice,
      changeType,
      recordedAt: r.recorded_at,
    };
  });
}

module.exports = { getStockValueSummary, getTopMovers, getRecentPriceChanges };