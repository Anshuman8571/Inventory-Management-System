-- Lets users create their own product categories (e.g. "PPR") instead of being
-- locked to the original hardcoded CPVC/PVC/Paint set.
--
-- Kept as a lightweight lookup table rather than restructuring the products table:
-- products.category stays a plain TEXT column (no changes needed anywhere that
-- already reads/writes/groups by it), but it's now backed by a foreign key into
-- `categories` instead of the old inline CHECK constraint, so a product can only
-- ever reference a category that was actually created.
--
-- Case-insensitive uniqueness (via the lower(name) index) stops "PPR", "ppr", and
-- "Ppr" from silently becoming three different categories.

CREATE TABLE IF NOT EXISTS categories (
  name        TEXT PRIMARY KEY,
  created_at  TIMESTAMP DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS categories_name_lower_idx ON categories (lower(name));

INSERT INTO categories (name) VALUES ('CPVC'), ('PVC'), ('Paint')
ON CONFLICT (name) DO NOTHING;

-- Drop the old fixed-list CHECK constraint from 002_create_products.sql. Postgres
-- auto-named it "<table>_<column>_check" since it was declared inline without an
-- explicit name — if your database named it differently, find the real name with
-- `\d products` in psql and swap it in below before running this migration.
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_category_check;

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_category_fkey;

ALTER TABLE products
  ADD CONSTRAINT products_category_fkey
  FOREIGN KEY (category) REFERENCES categories (name)
  ON UPDATE CASCADE;