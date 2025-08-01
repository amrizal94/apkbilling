-- APK Billing Database Schema

-- Tabel untuk manajemen TV devices
CREATE TABLE tv_devices (
    id INT PRIMARY KEY AUTO_INCREMENT,
    device_name VARCHAR(100) NOT NULL,
    device_id VARCHAR(50) UNIQUE NOT NULL,
    ip_address VARCHAR(15),
    status ENUM('online', 'offline', 'maintenance') DEFAULT 'offline',
    location VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabel untuk paket billing
CREATE TABLE billing_packages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    package_name VARCHAR(50) NOT NULL,
    duration_minutes INT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabel untuk session billing TV
CREATE TABLE tv_sessions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    device_id INT,
    customer_name VARCHAR(100),
    package_id INT,
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP NULL,
    duration_minutes INT,
    amount_paid DECIMAL(10,2),
    status ENUM('active', 'completed', 'cancelled') DEFAULT 'active',
    FOREIGN KEY (device_id) REFERENCES tv_devices(id),
    FOREIGN KEY (package_id) REFERENCES billing_packages(id)
);

-- Tabel untuk kategori produk cafe
CREATE TABLE product_categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    category_name VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabel untuk produk cafe
CREATE TABLE products (
    id INT PRIMARY KEY AUTO_INCREMENT,
    product_name VARCHAR(100) NOT NULL,
    category_id INT,
    price DECIMAL(10,2) NOT NULL,
    stock_quantity INT DEFAULT 0,
    image_url VARCHAR(255),
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES product_categories(id)
);

-- Tabel untuk orders cafe
CREATE TABLE orders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_number VARCHAR(20) UNIQUE NOT NULL,
    customer_name VARCHAR(100),
    table_number VARCHAR(10),
    total_amount DECIMAL(10,2) NOT NULL,
    status ENUM('pending', 'preparing', 'ready', 'completed', 'cancelled') DEFAULT 'pending',
    order_type ENUM('dine_in', 'takeaway') DEFAULT 'dine_in',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabel untuk detail order items
CREATE TABLE order_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT,
    product_id INT,
    quantity INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    notes TEXT,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Tabel untuk transaksi pembayaran
CREATE TABLE transactions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    transaction_type ENUM('tv_billing', 'cafe_order') NOT NULL,
    reference_id INT NOT NULL, -- ID dari tv_sessions atau orders
    amount DECIMAL(10,2) NOT NULL,
    payment_method ENUM('cash', 'card', 'digital_wallet') DEFAULT 'cash',
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cashier_name VARCHAR(100),
    notes TEXT
);

-- Tabel untuk users/admin
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role ENUM('admin', 'cashier', 'manager') DEFAULT 'cashier',
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabel untuk settings aplikasi
CREATE TABLE app_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(50) UNIQUE NOT NULL,
    setting_value TEXT,
    description VARCHAR(255),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert data awal
INSERT INTO billing_packages (package_name, duration_minutes, price) VALUES
('1 Jam', 60, 5000.00),
('2 Jam', 120, 9000.00),
('3 Jam', 180, 12000.00),
('Overnight (8 Jam)', 480, 30000.00);

INSERT INTO product_categories (category_name) VALUES
('Mie Instan'),
('Minuman'),
('Snack'),
('Makanan Berat');

INSERT INTO products (product_name, category_id, price, stock_quantity) VALUES
('Indomie Goreng', 1, 7000.00, 50),
('Indomie Kuah', 1, 7000.00, 50),
('Susu Ultra', 2, 5000.00, 30),
('Teh Botol', 2, 4000.00, 25),
('Chitato', 3, 8000.00, 20),
('Nasi Goreng', 4, 15000.00, 0);

INSERT INTO app_settings (setting_key, setting_value, description) VALUES
('cafe_name', 'Warnet & Cafe ABC', 'Nama cafe/warnet'),
('logo_url', '', 'URL logo cafe'),
('tax_rate', '0.10', 'Persentase pajak (10%)'),
('currency', 'IDR', 'Mata uang'),
('timezone', 'Asia/Jakarta', 'Timezone aplikasi');