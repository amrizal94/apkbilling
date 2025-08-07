require('dotenv').config();
const { Pool } = require('pg');

async function addSampleData() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'apkbilling_dev',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password'
  });

  try {
    console.log('Adding sample data for TV Management testing...\n');

    // Add sample TV devices
    const devices = [
      { device_id: 'TV-001', device_name: 'TV Gaming 1', device_location: 'Main Hall', ip_address: '192.168.1.101' },
      { device_id: 'TV-002', device_name: 'TV Gaming 2', device_location: 'VIP Room', ip_address: '192.168.1.102' },
      { device_id: 'TV-003', device_name: 'TV Gaming 3', device_location: 'Corner Area', ip_address: '192.168.1.103' },
      { device_id: 'TV-004', device_name: 'TV Gaming 4', device_location: 'Private Room A', ip_address: '192.168.1.104' },
      { device_id: 'TV-005', device_name: 'TV Gaming 5', device_location: 'Private Room B', ip_address: '192.168.1.105' }
    ];

    for (const device of devices) {
      await pool.query(`
        INSERT INTO tv_devices (device_id, device_name, device_location, ip_address, status, last_heartbeat, created_at) 
        VALUES ($1, $2, $3, $4, 'online', NOW(), NOW())
        ON CONFLICT (device_id) DO UPDATE SET
          device_name = EXCLUDED.device_name,
          device_location = EXCLUDED.device_location,
          ip_address = EXCLUDED.ip_address,
          last_heartbeat = NOW()
      `, [device.device_id, device.device_name, device.device_location, device.ip_address]);

      console.log(`✅ Device added: ${device.device_name}`);
    }

    // Add sample products
    const products = [
      { product_name: 'Nasi Goreng Special', category_id: 1, price: 18000, stock_quantity: 25 },
      { product_name: 'Mie Ayam Bakso', category_id: 1, price: 15000, stock_quantity: 30 },
      { product_name: 'Ayam Penyet', category_id: 1, price: 20000, stock_quantity: 20 },
      { product_name: 'Sate Ayam', category_id: 1, price: 25000, stock_quantity: 15 },
      { product_name: 'Es Teh Manis', category_id: 2, price: 5000, stock_quantity: 100 },
      { product_name: 'Kopi Hitam', category_id: 2, price: 8000, stock_quantity: 80 },
      { product_name: 'Es Jeruk', category_id: 2, price: 7000, stock_quantity: 60 },
      { product_name: 'Teh Panas', category_id: 2, price: 4000, stock_quantity: 90 },
      { product_name: 'Kerupuk', category_id: 3, price: 3000, stock_quantity: 200 },
      { product_name: 'Pisang Goreng', category_id: 3, price: 8000, stock_quantity: 40 },
      { product_name: 'Gorengan Mix', category_id: 3, price: 10000, stock_quantity: 35 }
    ];

    for (const product of products) {
      await pool.query(`
        INSERT INTO products (product_name, category_id, price, stock_quantity, is_available, created_at) 
        VALUES ($1, $2, $3, $4, true, NOW())
        ON CONFLICT DO NOTHING
      `, [product.product_name, product.category_id, product.price, product.stock_quantity]);

      console.log(`✅ Product added: ${product.product_name}`);
    }

    // Add a sample TV session (active)
    await pool.query(`
      INSERT INTO tv_sessions (device_id, customer_name, package_id, start_time, duration_minutes, amount_paid, status, created_at)
      SELECT 1, 'Test Customer', 1, NOW() - INTERVAL '30 minutes', 120, 15000, 'active', NOW()
      WHERE NOT EXISTS (SELECT 1 FROM tv_sessions WHERE status = 'active' LIMIT 1)
    `);

    console.log('✅ Sample TV session added');

    console.log('\n🎉 All sample data added successfully!');
    console.log('\n📊 Summary:');
    
    const deviceCount = await pool.query('SELECT COUNT(*) FROM tv_devices');
    const productCount = await pool.query('SELECT COUNT(*) FROM products');
    const sessionCount = await pool.query('SELECT COUNT(*) FROM tv_sessions');
    
    console.log(`- TV Devices: ${deviceCount.rows[0].count}`);
    console.log(`- Products: ${productCount.rows[0].count}`);
    console.log(`- TV Sessions: ${sessionCount.rows[0].count}`);

  } catch (error) {
    console.error('❌ Error adding sample data:', error.message);
  } finally {
    await pool.end();
  }
}

addSampleData();