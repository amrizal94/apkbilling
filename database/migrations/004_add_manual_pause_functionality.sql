-- Migration: 004_add_manual_pause_functionality
-- Description: Add manual pause functionality with reasons and operator tracking

-- Add manual pause fields to tv_sessions
ALTER TABLE tv_sessions 
ADD COLUMN IF NOT EXISTS pause_reason VARCHAR(100),
ADD COLUMN IF NOT EXISTS pause_notes TEXT,
ADD COLUMN IF NOT EXISTS paused_by INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS resumed_by INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS is_manually_paused BOOLEAN DEFAULT FALSE;

-- Add pause reason types check constraint
ALTER TABLE tv_sessions 
ADD CONSTRAINT tv_sessions_pause_reason_check 
CHECK (pause_reason IS NULL OR pause_reason IN (
    'prayer_time', 'power_outage', 'customer_request', 'technical_issue', 
    'device_offline', 'maintenance', 'emergency', 'other'
));

-- Create index for pause queries
CREATE INDEX IF NOT EXISTS idx_tv_sessions_pause_status ON tv_sessions(is_manually_paused, paused_at);

-- Insert migration record
INSERT INTO schema_migrations (version) VALUES ('004_add_manual_pause_functionality') 
ON CONFLICT (version) DO NOTHING;