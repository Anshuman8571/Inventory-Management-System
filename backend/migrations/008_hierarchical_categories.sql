-- Allow categories to be nested within other categories to form a hierarchy
-- e.g. Paints -> Nerolac -> Emulsion Paint -> Interior Emulsion
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS parent_name TEXT REFERENCES categories(name) ON UPDATE CASCADE ON DELETE RESTRICT;
