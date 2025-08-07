require('dotenv').config();
const { Pool } = require('pg');

async function checkDevices() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'apkbilling_dev',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password'
  });

  try {
    const devices = await pool.query('SELECT * FROM tv_devices ORDER BY id LIMIT 5');
    console.log('Available TV devices:');
    devices.rows.forEach(d => console.log(`ID: ${d.id}, Device ID: ${d.device_id}, Name: ${d.device_name}`));
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkDevices();