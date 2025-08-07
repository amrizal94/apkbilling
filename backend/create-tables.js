const db = require('./config/database');

async function createTables() {
  try {
    // Create suppliers table
    await db.query(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id SERIAL PRIMARY KEY,
        supplier_name VARCHAR(255) NOT NULL,
        contact_person VARCHAR(255),
        phone VARCHAR(50),
        email VARCHAR(255),
        address TEXT,
        notes TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created suppliers table');

    // Create purchase_orders table
    await db.query(`
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id SERIAL PRIMARY KEY,
        purchase_order_number VARCHAR(100) UNIQUE NOT NULL,
        supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
        purchase_date DATE NOT NULL,
        total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        status VARCHAR(20) CHECK (status IN ('pending', 'received', 'cancelled')) DEFAULT 'pending',
        notes TEXT,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        received_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        received_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created purchase_orders table');

    // Create purchase_order_items table
    await db.query(`
      CREATE TABLE IF NOT EXISTS purchase_order_items (
        id SERIAL PRIMARY KEY,
        purchase_order_id INTEGER REFERENCES purchase_orders(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        total_price DECIMAL(12,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created purchase_order_items table');

    // Create stock_movements table
    await db.query(`
      CREATE TABLE IF NOT EXISTS stock_movements (
        id SERIAL PRIMARY KEY,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        movement_type VARCHAR(20) CHECK (movement_type IN ('purchase', 'sale', 'adjustment', 'waste')) NOT NULL,
        quantity_change INTEGER NOT NULL,
        stock_before INTEGER NOT NULL,
        stock_after INTEGER NOT NULL,
        reference_type VARCHAR(20) CHECK (reference_type IN ('purchase_order', 'order', 'manual_adjustment')) NOT NULL,
        reference_id INTEGER,
        notes TEXT,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created stock_movements table');

    // Insert sample suppliers
    try {
      await db.query(`
        INSERT INTO suppliers (supplier_name, contact_person, phone, address) VALUES 
        ('Toko Grosir Sejahtera', 'Budi Santoso', '081234567890', 'Jl. Pasar Induk No. 15, Jakarta'),
        ('CV Fresh Mart', 'Siti Aminah', '087654321098', 'Jl. Raya Bogor Km 25, Depok'),
        ('UD Sumber Rejeki', 'Ahmad Yani', '085123456789', 'Jl. Veteran No. 45, Bekasi')
      `);
      console.log('✅ Inserted sample suppliers');
    } catch (error) {
      if (error.message.includes('duplicate key')) {
        console.log('⚠️ Sample suppliers already exist');
      } else {
        throw error;
      }
    }

    console.log('🎉 All tables created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createTables();