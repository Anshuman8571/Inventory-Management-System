-- Scan events: one row per photo-scan attempt (sticker or bill), regardless of flow.
-- Stores both the raw AI extraction and the human-corrected final data, so accuracy
-- can be reviewed/tuned later and every stock change is traceable to a specific scan.
CREATE TABLE IF NOT EXISTS scan_events (
  id                  SERIAL PRIMARY KEY,
  flow_type           TEXT NOT NULL CHECK (flow_type IN ('take_out', 'add_stock')),
  source              TEXT NOT NULL CHECK (source IN ('sticker', 'bill')),
  image_path          TEXT,
  category_selected   TEXT,
  raw_extracted       JSONB,
  final_data          JSONB,
  matched_product_id  INTEGER REFERENCES products(id),
  is_new_product      BOOLEAN NOT NULL DEFAULT false,
  qty                 INTEGER,
  confirmed_by        INTEGER REFERENCES users(id),
  created_at          TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scan_events_product ON scan_events (matched_product_id);
