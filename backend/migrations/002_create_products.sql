-- Products table: single table for all categories (CPVC / PVC / Paint).
-- Category-specific fields (size, fitting_type, can_size, shade, etc.) live in the
-- `attributes` JSONB column rather than as separate rigid columns or separate tables.
CREATE TABLE IF NOT EXISTS products (
  id                SERIAL PRIMARY KEY,
  category          TEXT NOT NULL CHECK (category IN ('CPVC', 'PVC', 'Paint')),
  name              TEXT NOT NULL,
  company           TEXT,
  unit              TEXT NOT NULL DEFAULT 'pcs',
  current_qty       INTEGER NOT NULL DEFAULT 0,
  last_known_price  NUMERIC,
  low_stock_at      INTEGER DEFAULT 0,
  attributes        JSONB DEFAULT '{}',
  created_at        TIMESTAMP DEFAULT now()
);

-- Speeds up fuzzy-match lookups scoped by category (matching.service.js always filters
-- by category first, since the user selects it before scanning).
CREATE INDEX IF NOT EXISTS idx_products_category ON products (category);
