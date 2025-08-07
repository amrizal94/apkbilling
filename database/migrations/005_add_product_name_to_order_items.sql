-- Migration: 005_add_product_name_to_order_items
-- Description: Add product_name column to order_items table for historical data

BEGIN;

-- Add product_name column to order_items table
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS product_name VARCHAR(100);

-- Update existing records to populate product_name from products table
UPDATE order_items 
SET product_name = p.product_name 
FROM products p 
WHERE order_items.product_id = p.id 
AND order_items.product_name IS NULL;

-- Insert migration record
INSERT INTO schema_migrations (version) VALUES ('005_add_product_name_to_order_items') 
ON CONFLICT (version) DO NOTHING;

COMMIT;