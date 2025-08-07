-- Migration: 003_add_fb_orders_integration
-- Description: Add F&B ordering integration with TV sessions

-- Add payment_type to tv_sessions
ALTER TABLE tv_sessions 
ADD COLUMN IF NOT EXISTS payment_type VARCHAR(20) DEFAULT 'pay_later' 
CHECK (payment_type IN ('pay_now', 'pay_later'));

-- Create session_orders table for F&B orders linked to TV sessions
CREATE TABLE IF NOT EXISTS session_orders (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES tv_sessions(id) ON DELETE CASCADE,
    device_id INTEGER REFERENCES tv_devices(id) ON DELETE CASCADE,
    customer_name VARCHAR(100),
    order_items JSONB NOT NULL, -- Array of {product_id, product_name, quantity, price, subtotal}
    total_amount DECIMAL(10,2) NOT NULL,
    order_notes TEXT,
    order_status VARCHAR(20) DEFAULT 'pending' CHECK (order_status IN ('pending', 'preparing', 'ready', 'delivered', 'cancelled')),
    ordered_by INTEGER REFERENCES users(id), -- Operator who took the order
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_session_orders_session_id ON session_orders(session_id);
CREATE INDEX IF NOT EXISTS idx_session_orders_device_id ON session_orders(device_id);
CREATE INDEX IF NOT EXISTS idx_session_orders_status ON session_orders(order_status);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_session_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_session_orders_updated_at
    BEFORE UPDATE ON session_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_session_orders_updated_at();

-- Insert migration record
INSERT INTO schema_migrations (version) VALUES ('003_add_fb_orders_integration') 
ON CONFLICT (version) DO NOTHING;