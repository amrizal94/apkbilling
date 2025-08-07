require('dotenv').config();
const { Pool } = require('pg');

async function fixPackages() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'apkbilling_dev',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password'
  });

  try {
    console.log('Checking packages table...');

    // Check if packages table exists
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'packages'
      )
    `);

    if (!tableExists.rows[0].exists) {
      console.log('Creating packages table...');
      await pool.query(`
        CREATE TABLE packages (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          duration_minutes INTEGER NOT NULL,
          price DECIMAL(10,2) NOT NULL,
          description TEXT,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      console.log('✅ Packages table created');
    } else {
      console.log('✅ Packages table exists');
    }

    // Add sample packages
    const packages = [
      { name: '1 Hour Gaming', duration_minutes: 60, price: 10000, description: 'Gaming 1 jam' },
      { name: '2 Hours Gaming', duration_minutes: 120, price: 18000, description: 'Gaming 2 jam' },
      { name: '3 Hours Gaming', duration_minutes: 180, price: 25000, description: 'Gaming 3 jam' },
      { name: '4 Hours Gaming', duration_minutes: 240, price: 32000, description: 'Gaming 4 jam' },
      { name: 'All Day Gaming', duration_minutes: 480, price: 50000, description: 'Gaming seharian' }
    ];

    for (const pkg of packages) {
      await pool.query(`
        INSERT INTO packages (name, duration_minutes, price, description, is_active)
        VALUES ($1, $2, $3, $4, true)
        ON CONFLICT DO NOTHING
      `, [pkg.name, pkg.duration_minutes, pkg.price, pkg.description]);
    }

    console.log('✅ Sample packages added');

    // Check packages
    const result = await pool.query('SELECT * FROM packages ORDER BY duration_minutes');
    console.log('\n📦 Available packages:');
    result.rows.forEach(pkg => {
      console.log(`- ${pkg.name}: ${pkg.duration_minutes} min - Rp ${pkg.price}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

fixPackages();