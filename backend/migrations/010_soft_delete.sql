ALTER TABLE products ADD COLUMN deleted_at TIMESTAMP DEFAULT NULL;

-- Also add a soft delete column to categories for category deletion
ALTER TABLE categories ADD COLUMN deleted_at TIMESTAMP DEFAULT NULL;
