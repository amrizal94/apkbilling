-- Migration: create_session_packages_table
-- Description: Track all packages used in each session for detailed reporting

-- Create session_packages table
CREATE TABLE IF NOT EXISTS session_packages (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES tv_sessions(id) ON DELETE CASCADE,
    package_id INTEGER REFERENCES packages(id),
    package_name VARCHAR(100) NOT NULL,
    duration_minutes INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    package_type VARCHAR(20) DEFAULT 'initial' CHECK (package_type IN ('initial', 'additional')),
    added_at TIMESTAMP DEFAULT NOW(),
    added_by INTEGER REFERENCES users(id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_session_packages_session_id ON session_packages(session_id);
CREATE INDEX IF NOT EXISTS idx_session_packages_added_at ON session_packages(added_at);

-- Insert migration record
INSERT INTO schema_migrations (version) VALUES ('create_session_packages_table') 
ON CONFLICT (version) DO NOTHING;