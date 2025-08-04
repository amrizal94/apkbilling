-- Create packages table for billing management
CREATE TABLE IF NOT EXISTS packages (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default packages
INSERT INTO packages (name, description, duration_minutes, price) VALUES
('1 Hour Gaming', 'Perfect for casual gaming session', 60, 15000),
('2 Hours Gaming', 'Extended gaming session', 120, 28000),
('3 Hours Gaming', 'Long gaming session', 180, 40000),
('5 Hours Gaming', 'All day gaming package', 300, 65000),
('10 Hours Gaming', 'Premium gaming package', 600, 120000);

-- Create indexes for better performance
CREATE INDEX idx_packages_active ON packages(is_active);