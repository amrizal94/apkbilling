-- Migration: 002_add_pending_payment_status
-- Description: Add pending_payment status to tv_sessions for payment confirmation workflow

-- Add payment confirmation fields to tv_sessions
ALTER TABLE tv_sessions 
ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMP WITH TIME ZONE NULL,
ADD COLUMN IF NOT EXISTS payment_confirmed_by INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS payment_notes TEXT;

-- Update status constraint to include pending_payment
ALTER TABLE tv_sessions 
DROP CONSTRAINT IF EXISTS tv_sessions_status_check;

ALTER TABLE tv_sessions 
ADD CONSTRAINT tv_sessions_status_check 
CHECK (status IN ('active', 'completed', 'cancelled', 'pending_payment'));

-- Insert migration record
INSERT INTO schema_migrations (version) VALUES ('002_add_pending_payment_status') 
ON CONFLICT (version) DO NOTHING;