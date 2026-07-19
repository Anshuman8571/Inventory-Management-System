-- Add new fields for bill extraction Phase 2

ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(50);

ALTER TABLE bill_line_items 
  ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS trade_discount NUMERIC,
  ADD COLUMN IF NOT EXISTS scheme_discount NUMERIC,
  ADD COLUMN IF NOT EXISTS gst_percent NUMERIC,
  ADD COLUMN IF NOT EXISTS net_amount NUMERIC;

-- Also add to price history to track discounts on specific historical price points
ALTER TABLE price_history
  ADD COLUMN IF NOT EXISTS trade_discount NUMERIC,
  ADD COLUMN IF NOT EXISTS scheme_discount NUMERIC,
  ADD COLUMN IF NOT EXISTS gst_percent NUMERIC;
