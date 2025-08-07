require('dotenv').config();
const { Pool } = require('pg');

async function addPermissions() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'apkbilling_dev',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password'
  });

  try {
    console.log('Adding missing permissions to super_admin role...');

    // Add missing permissions
    const missingPermissions = [
      'order_management',
      'device_management', 
      'session_management',
      'product_management'
    ];

    for (const permission of missingPermissions) {
      await pool.query(`
        UPDATE roles 
        SET permissions = jsonb_set(permissions, '{${permission}}', 'true') 
        WHERE role_name = 'super_admin'
      `);
      console.log(`✅ Added ${permission} permission`);
    }

    // Verify permissions
    const result = await pool.query('SELECT permissions FROM roles WHERE role_name = $1', ['super_admin']);
    console.log('\n📋 Super Admin permissions:', JSON.stringify(result.rows[0]?.permissions, null, 2));

    console.log('\n✅ All permissions added successfully!');
  } catch (error) {
    console.error('❌ Error adding permissions:', error.message);
  } finally {
    await pool.end();
  }
}

addPermissions();