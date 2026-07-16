-- Stock movements: the append-only ledger of every quantity change, ever.
-- This is the ONLY table that should ever be written to when stock changes —
-- always via inventory.service.js, never directly from a controller.
CREATE TABLE IF NOT EXISTS stock_movements (
  id             SERIAL PRIMARY KEY,
  product_id     INTEGER NOT NULL REFERENCES products(id),
  change_qty     INTEGER NOT NULL, -- negative = take-out, positive = add-stock
  scan_event_id  INTEGER REFERENCES scan_events(id),
  created_at     TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements (product_id);
