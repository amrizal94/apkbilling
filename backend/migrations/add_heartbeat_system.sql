-- Migration: Add heartbeat system for power failure detection
-- File: migrations/add_heartbeat_system.sql

-- Add heartbeat tracking columns
ALTER TABLE tv_devices ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE tv_sessions ADD COLUMN IF NOT EXISTS paused_at TIMESTAMP DEFAULT NULL;
ALTER TABLE tv_sessions ADD COLUMN IF NOT EXISTS paused_duration_minutes INTEGER DEFAULT 0;

-- Create heartbeat endpoint table for logging
CREATE TABLE IF NOT EXISTS device_heartbeats (
    id SERIAL PRIMARY KEY,
    device_id INTEGER REFERENCES tv_devices(id),
    heartbeat_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_device_heartbeats_device_time ON device_heartbeats(device_id, heartbeat_time DESC);
CREATE INDEX IF NOT EXISTS idx_tv_devices_heartbeat ON tv_devices(last_heartbeat);
CREATE INDEX IF NOT EXISTS idx_tv_sessions_paused ON tv_sessions(paused_at);