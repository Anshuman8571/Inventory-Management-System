CREATE TABLE IF NOT EXISTS bills (
  id SERIAL PRIMARY KEY,
  uploaded_by_user_id INTEGER REFERENCES users(id),
  supplier_name TEXT,
  total_items INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bill_line_items (
  id SERIAL PRIMARY KEY,
  bill_id INTEGER REFERENCES bills(id) ON DELETE CASCADE,
  matched_product_id INTEGER REFERENCES products(id),
  raw_extracted JSONB NOT NULL,
  is_new_product BOOLEAN DEFAULT false,
  confirmed_qty INTEGER,
  confirmed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bill_line_items_bill_id ON bill_line_items(bill_id);
