-- Migration: Add heartbeat system for power failure detection
-- Version: 006
-- Description: Add heartbeat tracking and session pause functionality

-- Add heartbeat tracking columns to tv_devices
ALTER TABLE tv_devices ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Add pause tracking columns to tv_sessions  
ALTER TABLE tv_sessions ADD COLUMN IF NOT EXISTS paused_at TIMESTAMP DEFAULT NULL;
ALTER TABLE tv_sessions ADD COLUMN IF NOT EXISTS paused_duration_minutes INTEGER DEFAULT 0;

-- Create heartbeat logging table
CREATE TABLE IF NOT EXISTS device_heartbeats (
    id SERIAL PRIMARY KEY,
    device_id INTEGER REFERENCES tv_devices(id) ON DELETE CASCADE,
    heartbeat_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_device_heartbeats_device_time ON device_heartbeats(device_id, heartbeat_time DESC);
CREATE INDEX IF NOT EXISTS idx_tv_devices_heartbeat ON tv_devices(last_heartbeat);
CREATE INDEX IF NOT EXISTS idx_tv_sessions_paused ON tv_sessions(paused_at);

-- Add comments for documentation
COMMENT ON COLUMN tv_devices.last_heartbeat IS 'Last heartbeat received from device, used for offline detection';
COMMENT ON COLUMN tv_sessions.paused_at IS 'Timestamp when session was paused due to device going offline';
COMMENT ON COLUMN tv_sessions.paused_duration_minutes IS 'Total minutes session has been paused (not charged to customer)';
COMMENT ON TABLE device_heartbeats IS 'Log of all heartbeats received from devices for monitoring and debugging';