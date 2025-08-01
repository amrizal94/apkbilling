-- Initial Data Seeds for APK Billing
-- Seed: 001_initial_data
-- Description: Insert initial data for billing packages, categories, products, and settings

-- Insert billing packages
INSERT INTO billing_packages (package_name, duration_minutes, price) VALUES
('1 Jam', 60, 5000.00),
('2 Jam', 120, 9000.00),
('3 Jam', 180, 12000.00),
('4 Jam', 240, 15000.00),
('6 Jam', 360, 22000.00),
('Overnight (8 Jam)', 480, 30000.00),
('12 Jam', 720, 40000.00),
('24 Jam', 1440, 70000.00)
ON CONFLICT DO NOTHING;

-- Insert product categories
INSERT INTO product_categories (category_name) VALUES
('Mie Instan'),
('Minuman Panas'),
('Minuman Dingin'),
('Snack & Keripik'),
('Makanan Berat'),
('Rokok'),
('Es Krim'),
('Kopi & Teh')
ON CONFLICT DO NOTHING;

-- Insert products
INSERT INTO products (product_name, category_id, price, stock_quantity) VALUES
-- Mie Instan (category_id: 1)
('Indomie Goreng', 1, 7000.00, 50),
('Indomie Kuah Ayam Bawang', 1, 7000.00, 50),
('Indomie Soto Mie', 1, 7500.00, 30),
('Mie Sedaap Goreng', 1, 6500.00, 40),
('Sarimi Ayam Kremes', 1, 6000.00, 35),

-- Minuman Panas (category_id: 2)
('Kopi Hitam', 2, 3000.00, 100),
('Kopi Susu', 2, 4000.00, 100),
('Teh Manis', 2, 2500.00, 100),
('Teh Tawar', 2, 2000.00, 100),
('Susu Jahe', 2, 5000.00, 50),

-- Minuman Dingin (category_id: 3)
('Es Teh Manis', 3, 3000.00, 100),
('Es Jeruk', 3, 4000.00, 80),
('Susu Ultra Coklat', 3, 5000.00, 30),
('Susu Ultra Strawberry', 3, 5000.00, 30),
('Teh Botol Sosro', 3, 4000.00, 25),
('Coca Cola', 3, 5000.00, 20),
('Sprite', 3, 5000.00, 20),

-- Snack & Keripik (category_id: 4)
('Chitato Rasa Sapi Panggang', 4, 8000.00, 20),
('Chitato Rasa Ayam Barbeque', 4, 8000.00, 20),
('Cheetos', 4, 7000.00, 25),
('Taro Original', 4, 6000.00, 30),
('Pringles Original', 4, 15000.00, 10),
('Kacang Garuda', 4, 5000.00, 40),

-- Makanan Berat (category_id: 5)
('Nasi Goreng Spesial', 5, 15000.00, 0),
('Nasi Goreng Ayam', 5, 12000.00, 0),
('Mie Goreng Spesial', 5, 12000.00, 0),
('Nasi Gudeg', 5, 10000.00, 0),
('Ayam Penyet', 5, 18000.00, 0),

-- Rokok (category_id: 6)
('Gudang Garam Surya Pro', 6, 22000.00, 10),
('Marlboro Merah', 6, 25000.00, 8),
('LA Bold', 6, 18000.00, 12),
('Sampoerna Mild', 6, 20000.00, 10),

-- Es Krim (category_id: 7)
('Es Krim Walls Cornetto', 7, 8000.00, 15),
('Es Krim Aice Mochi', 7, 3000.00, 25),
('Es Krim Paddle Pop', 7, 4000.00, 20),

-- Kopi & Teh (category_id: 8)
('Good Day Cappuccino', 8, 2000.00, 50),
('Nescafe Classic', 8, 2500.00, 40),
('Teh Celup Sariwangi', 8, 1500.00, 60),
('Kopi Kapal Api', 8, 2000.00, 45)
ON CONFLICT DO NOTHING;

-- Insert default admin user (password: admin123)
-- Password hash for 'admin123' using bcrypt
INSERT INTO users (username, password_hash, full_name, role) VALUES
('admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Administrator', 'admin'),
('kasir1', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Kasir 1', 'cashier'),
('manager', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Manager', 'manager')
ON CONFLICT (username) DO NOTHING;

-- Insert application settings
INSERT INTO app_settings (setting_key, setting_value, description) VALUES
('cafe_name', 'Warnet & Cafe ABC', 'Nama cafe/warnet'),
('cafe_address', 'Jl. Raya No. 123, Kota ABC', 'Alamat cafe'),
('cafe_phone', '021-12345678', 'Nomor telepon cafe'),
('logo_url', '', 'URL logo cafe'),
('tax_rate', '0.10', 'Persentase pajak (10%)'),
('service_charge', '0.05', 'Biaya layanan (5%)'),
('currency', 'IDR', 'Mata uang'),
('currency_symbol', 'Rp', 'Simbol mata uang'),
('timezone', 'Asia/Jakarta', 'Timezone aplikasi'),
('working_hours_start', '08:00', 'Jam buka'),
('working_hours_end', '23:00', 'Jam tutup'),
('max_tv_sessions', '50', 'Maksimal TV sessions bersamaan'),
('session_warning_minutes', '5', 'Warning sebelum session habis (menit)'),
('auto_power_off', 'true', 'Otomatis matikan TV saat session habis'),
('receipt_footer', 'Terima kasih atas kunjungan Anda!', 'Footer struk'),
('wifi_name', 'Warnet_ABC', 'Nama WiFi'),
('wifi_password', 'password123', 'Password WiFi')
ON CONFLICT (setting_key) DO NOTHING;

-- Insert sample TV devices
INSERT INTO tv_devices (device_name, device_id, location) VALUES
('TV Gaming 01', 'TV001', 'Lantai 1 - Area Gaming'),
('TV Gaming 02', 'TV002', 'Lantai 1 - Area Gaming'),
('TV Gaming 03', 'TV003', 'Lantai 1 - Area Gaming'),
('TV Gaming 04', 'TV004', 'Lantai 1 - Area Gaming'),
('TV Gaming 05', 'TV005', 'Lantai 1 - Area Gaming'),
('TV VIP 01', 'TV006', 'Lantai 2 - Area VIP'),
('TV VIP 02', 'TV007', 'Lantai 2 - Area VIP'),
('TV Streaming 01', 'TV008', 'Lantai 1 - Area Streaming'),
('TV Streaming 02', 'TV009', 'Lantai 1 - Area Streaming'),
('TV Streaming 03', 'TV010', 'Lantai 1 - Area Streaming')
ON CONFLICT (device_id) DO NOTHING;