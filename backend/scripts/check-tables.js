require('dotenv').config();
const { Pool } = require('pg');

async function checkTables() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'apkbilling_dev',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password'
  });

  try {
    console.log('Checking existing table structures...\n');

    // Check products table
    const productsResult = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'products' 
      ORDER BY ordinal_position
    `);

    console.log('📋 Products table structure:');
    productsResult.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });

    // Check orders table
    const ordersResult = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'orders' 
      ORDER BY ordinal_position
    `);

    console.log('\n📋 Orders table structure:');
    if (ordersResult.rows.length === 0) {
      console.log('  Table does not exist');
    } else {
      ordersResult.rows.forEach(row => {
        console.log(`  ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
      });
    }

    // Check tv_sessions table
    const sessionsResult = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'tv_sessions' 
      ORDER BY ordinal_position
    `);

    console.log('\n📋 TV Sessions table structure:');
    if (sessionsResult.rows.length === 0) {
      console.log('  Table does not exist');
    } else {
      sessionsResult.rows.forEach(row => {
        console.log(`  ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
      });
    }

    // Check tv_devices table
    const devicesResult = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'tv_devices' 
      ORDER BY ordinal_position
    `);

    console.log('\n📋 TV Devices table structure:');
    if (devicesResult.rows.length === 0) {
      console.log('  Table does not exist');
    } else {
      devicesResult.rows.forEach(row => {
        console.log(`  ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
      });
    }

  } catch (error) {
    console.error('❌ Error checking tables:', error.message);
  } finally {
    await pool.end();
  }
}

checkTables();