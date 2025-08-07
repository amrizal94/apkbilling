const { Pool } = require('pg');
require('dotenv').config();

async function checkAdminUser() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  });

  try {
    console.log('Checking for admin users...');
    
    // Check for admin users
    const adminUsers = await pool.query(`
      SELECT u.id, u.username, u.full_name, u.role, u.is_active, u.role_id,
             r.role_name, r.permissions
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.username LIKE '%admin%' OR u.role = 'admin' OR r.role_name = 'super_admin'
      ORDER BY u.id;
    `);

    console.log(`\nFound ${adminUsers.rows.length} admin-like users:`);
    adminUsers.rows.forEach(user => {
      console.log(`  ID: ${user.id}, Username: ${user.username}, Role: ${user.role || 'N/A'}, RoleID: ${user.role_id}, RoleName: ${user.role_name || 'N/A'}, Active: ${user.is_active}`);
    });

    // Count total users
    const totalUsers = await pool.query('SELECT COUNT(*) as count FROM users');
    console.log(`\nTotal users in database: ${totalUsers.rows[0].count}`);

    // List all roles
    const roles = await pool.query('SELECT id, role_name, role_description FROM roles ORDER BY id');
    console.log(`\nAvailable roles (${roles.rows.length}):`);
    roles.rows.forEach(role => {
      console.log(`  ID: ${role.id}, Name: ${role.role_name}, Description: ${role.role_description}`);
    });

  } catch (error) {
    console.error('Database query error:', error.message);
  } finally {
    await pool.end();
  }
}

checkAdminUser();