require('dotenv').config();
const { Pool } = require('pg');

async function createMissingTables() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'apkbilling_dev',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password'
  });

  try {
    console.log('Creating missing tables for TV Management...');

    // Check if tables exist and create if not
    const tables = [
      {
        name: 'orders',
        sql: `
          CREATE TABLE IF NOT EXISTS orders (
            id SERIAL PRIMARY KEY,
            order_number VARCHAR(50) UNIQUE NOT NULL,
            customer_name VARCHAR(100) NOT NULL,
            order_type VARCHAR(20) DEFAULT 'pos',
            session_id INTEGER,
            total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
            payment_method VARCHAR(20) DEFAULT 'cash',
            status VARCHAR(20) DEFAULT 'pending',
            notes TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `
      },
      {
        name: 'order_items',
        sql: `
          CREATE TABLE IF NOT EXISTS order_items (
            id SERIAL PRIMARY KEY,
            order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
            product_id INTEGER,
            product_name VARCHAR(100) NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 1,
            unit_price DECIMAL(10,2) NOT NULL,
            total_price DECIMAL(10,2) NOT NULL,
            notes TEXT
          )
        `
      },
      {
        name: 'products',
        sql: `
          CREATE TABLE IF NOT EXISTS products (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            category VARCHAR(50) DEFAULT 'food',
            price DECIMAL(10,2) NOT NULL,
            description TEXT,
            stock_quantity INTEGER DEFAULT 0,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `
      }
    ];

    for (const table of tables) {
      await pool.query(table.sql);
      console.log(`✅ Table '${table.name}' created/verified`);
    }

    // Insert sample data
    console.log('\nInserting sample data...');

    // Sample products
    await pool.query(`
      INSERT INTO products (name, category, price, description, stock_quantity) 
      VALUES 
        ('Nasi Goreng', 'food', 15000, 'Nasi goreng spesial', 50),
        ('Mie Ayam', 'food', 12000, 'Mie ayam dengan bakso', 30),
        ('Es Teh Manis', 'drink', 5000, 'Es teh manis segar', 100),
        ('Kopi Hitam', 'drink', 8000, 'Kopi hitam panas', 80),
        ('Kerupuk', 'snack', 3000, 'Kerupuk renyah', 200)
      ON CONFLICT DO NOTHING
    `);

    console.log('✅ Sample products inserted');

    console.log('\n🎉 All tables created successfully!');
  } catch (error) {
    console.error('❌ Error creating tables:', error.message);
  } finally {
    await pool.end();
  }
}

createMissingTables();