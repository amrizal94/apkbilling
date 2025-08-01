-- Initial Schema Migration for APK Billing
-- Migration: 001_initial_schema
-- Description: Create all initial tables for TV billing and POS system

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabel untuk manajemen TV devices
CREATE TABLE IF NOT EXISTS tv_devices (
    id SERIAL PRIMARY KEY,
    device_name VARCHAR(100) NOT NULL,
    device_id VARCHAR(50) UNIQUE NOT NULL,
    ip_address INET,
    status VARCHAR(20) DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'maintenance')),
    location VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabel untuk paket billing
CREATE TABLE IF NOT EXISTS billing_packages (
    id SERIAL PRIMARY KEY,
    package_name VARCHAR(50) NOT NULL,
    duration_minutes INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabel untuk session billing TV
CREATE TABLE IF NOT EXISTS tv_sessions (
    id SERIAL PRIMARY KEY,
    device_id INTEGER REFERENCES tv_devices(id) ON DELETE CASCADE,
    customer_name VARCHAR(100),
    package_id INTEGER REFERENCES billing_packages(id),
    start_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP WITH TIME ZONE NULL,
    duration_minutes INTEGER,
    amount_paid DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabel untuk kategori produk cafe
CREATE TABLE IF NOT EXISTS product_categories (
    id SERIAL PRIMARY KEY,
    category_name VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabel untuk produk cafe
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    product_name VARCHAR(100) NOT NULL,
    category_id INTEGER REFERENCES product_categories(id),
    price DECIMAL(10,2) NOT NULL,
    stock_quantity INTEGER DEFAULT 0,
    image_url VARCHAR(255),
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabel untuk orders cafe
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(20) UNIQUE NOT NULL,
    customer_name VARCHAR(100),
    table_number VARCHAR(10),
    total_amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'ready', 'completed', 'cancelled')),
    order_type VARCHAR(20) DEFAULT 'dine_in' CHECK (order_type IN ('dine_in', 'takeaway')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabel untuk detail order items
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    notes TEXT
);

-- Tabel untuk transaksi pembayaran
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('tv_billing', 'cafe_order')),
    reference_id INTEGER NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(20) DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card', 'digital_wallet')),
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    cashier_name VARCHAR(100),
    notes TEXT
);

-- Tabel untuk users/admin
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'cashier' CHECK (role IN ('admin', 'cashier', 'manager')),
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP WITH TIME ZONE NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabel untuk settings aplikasi
CREATE TABLE IF NOT EXISTS app_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(50) UNIQUE NOT NULL,
    setting_value TEXT,
    description VARCHAR(255),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabel untuk migrations tracking
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes untuk performance
CREATE INDEX IF NOT EXISTS idx_tv_devices_device_id ON tv_devices(device_id);
CREATE INDEX IF NOT EXISTS idx_tv_devices_status ON tv_devices(status);
CREATE INDEX IF NOT EXISTS idx_tv_sessions_device_id ON tv_sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_tv_sessions_status ON tv_sessions(status);
CREATE INDEX IF NOT EXISTS idx_tv_sessions_start_time ON tv_sessions(start_time);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_transaction_type ON transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_reference_id ON transactions(reference_id);
CREATE INDEX IF NOT EXISTS idx_transactions_transaction_date ON transactions(transaction_date);

-- Function untuk update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers untuk auto update updated_at
CREATE TRIGGER update_tv_devices_updated_at BEFORE UPDATE ON tv_devices 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_app_settings_updated_at BEFORE UPDATE ON app_settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert migration record
INSERT INTO schema_migrations (version) VALUES ('001_initial_schema') 
ON CONFLICT (version) DO NOTHING;