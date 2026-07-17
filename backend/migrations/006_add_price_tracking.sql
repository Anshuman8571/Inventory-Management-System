-- Phase 5: price tracking. bill_line_items needs to record what price was extracted per
-- item, and price_history keeps a running per-product log so future bills can compare
-- against the last known price (see prd.md: price comparison at bill time).

ALTER TABLE bill_line_items ADD COLUMN IF NOT EXISTS unit_price NUMERIC;

CREATE TABLE IF NOT EXISTS price_history (
  id           SERIAL PRIMARY KEY,
  product_id   INTEGER NOT NULL REFERENCES products(id),
  price        NUMERIC NOT NULL,
  bill_id      INTEGER REFERENCES bills(id),
  recorded_at  TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_price_history_product ON price_history (product_id);