-- Migration: Role-Based Access Control System
-- Created: 2025-01-08

-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    role_name VARCHAR(50) UNIQUE NOT NULL,
    role_description TEXT,
    permissions JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Update users table to include role_id
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL;

-- Create user_sessions table for better session management
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default roles with permissions
INSERT INTO roles (role_name, role_description, permissions) VALUES 
('super_admin', 'Super Administrator - Full system access', '{
    "user_management": true,
    "system_settings": true,
    "tv_management": true,
    "package_management": true,
    "pos_system": true,
    "supplier_management": true,
    "purchase_orders": true,
    "financial_reports": true,
    "stock_movements": true,
    "delete_operations": true
}'),
('manager', 'Manager - Operational management access', '{
    "user_management": false,
    "system_settings": false,
    "tv_management": true,
    "package_management": true,
    "pos_system": true,
    "supplier_management": true,
    "purchase_orders": true,
    "financial_reports": true,
    "stock_movements": true,
    "delete_operations": false
}'),
('cashier', 'Cashier/Staff - Daily operations access', '{
    "user_management": false,
    "system_settings": false,
    "tv_management": true,
    "package_management": false,
    "pos_system": true,
    "supplier_management": false,
    "purchase_orders": false,
    "financial_reports": "basic",
    "stock_movements": "view_only",
    "delete_operations": false
}'),
('kitchen_staff', 'Kitchen/F&B Staff - Food service operations', '{
    "user_management": false,
    "system_settings": false,
    "tv_management": false,
    "package_management": false,
    "pos_system": "orders_only",
    "supplier_management": false,
    "purchase_orders": false,
    "financial_reports": false,
    "stock_movements": "view_only",
    "delete_operations": false
}'),
('viewer', 'Viewer/Readonly - Monitoring and reporting only', '{
    "user_management": false,
    "system_settings": false,
    "tv_management": "view_only",
    "package_management": "view_only",
    "pos_system": "view_only",
    "supplier_management": "view_only",
    "purchase_orders": "view_only",
    "financial_reports": true,
    "stock_movements": "view_only",
    "delete_operations": false
}')
ON CONFLICT (role_name) DO NOTHING;

-- Update existing users to have roles (set admins as super_admin, others as cashier by default)
UPDATE users SET role_id = (SELECT id FROM roles WHERE role_name = 'super_admin') 
WHERE role = 'admin' AND role_id IS NULL;

UPDATE users SET role_id = (SELECT id FROM roles WHERE role_name = 'cashier') 
WHERE role != 'admin' AND role_id IS NULL;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles 
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_user_sessions_updated_at BEFORE UPDATE ON user_sessions 
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();