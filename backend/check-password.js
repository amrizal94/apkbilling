const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function checkPassword() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  });

  try {
    console.log('Checking admin password...');
    
    // Get admin user password hash
    const adminUser = await pool.query(`
      SELECT username, password_hash, full_name, is_active
      FROM users 
      WHERE username = 'admin'
    `);

    if (adminUser.rows.length === 0) {
      console.log('❌ No admin user found');
      return;
    }

    const user = adminUser.rows[0];
    console.log('✅ Admin user found:');
    console.log(`  Username: ${user.username}`);
    console.log(`  Full Name: ${user.full_name}`);
    console.log(`  Active: ${user.is_active}`);
    console.log(`  Password Hash: ${user.password_hash.substring(0, 20)}...`);

    // Test common passwords
    const passwords = ['admin123', 'admin', 'password', 'admin12345', 'administrator'];
    
    console.log('\nTesting passwords...');
    for (const testPassword of passwords) {
      try {
        const isMatch = await bcrypt.compare(testPassword, user.password_hash);
        console.log(`  "${testPassword}": ${isMatch ? '✅ MATCH' : '❌ No match'}`);
      } catch (error) {
        console.log(`  "${testPassword}": ❌ Error - ${error.message}`);
      }
    }

    // If we find a match, test the login process
    const correctPassword = 'admin123'; // Assume this based on env var
    try {
      const isCorrect = await bcrypt.compare(correctPassword, user.password_hash);
      if (isCorrect) {
        console.log(`\n✅ Correct password for admin is: "${correctPassword}"`);
      } else {
        console.log(`\n❌ Password "${correctPassword}" does not match`);
      }
    } catch (error) {
      console.log(`\n❌ Error testing password: ${error.message}`);
    }

  } catch (error) {
    console.error('Database query error:', error.message);
  } finally {
    await pool.end();
  }
}

checkPassword();