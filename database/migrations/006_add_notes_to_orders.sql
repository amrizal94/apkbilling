-- Migration: 006_add_notes_to_orders
-- Description: Add notes column to orders table for status update comments

BEGIN;

-- Add notes column to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Insert migration record
INSERT INTO schema_migrations (version) VALUES ('006_add_notes_to_orders') 
ON CONFLICT (version) DO NOTHING;

COMMIT;