const { Pool } = require('pg');
require('dotenv').config();

async function checkSchema() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  });

  try {
    console.log('Checking users table schema...');
    
    // Check if users table exists and its columns
    const usersSchema = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position;
    `);

    console.log('\nUsers table columns:');
    if (usersSchema.rows.length === 0) {
      console.log('❌ Users table does not exist');
    } else {
      usersSchema.rows.forEach(col => {
        console.log(`  ${col.column_name}: ${col.data_type}${col.is_nullable === 'NO' ? ' NOT NULL' : ''}`);
      });
    }

    // Check roles table
    const rolesSchema = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'roles' 
      ORDER BY ordinal_position;
    `);

    console.log('\nRoles table columns:');
    if (rolesSchema.rows.length === 0) {
      console.log('❌ Roles table does not exist');
    } else {
      rolesSchema.rows.forEach(col => {
        console.log(`  ${col.column_name}: ${col.data_type}${col.is_nullable === 'NO' ? ' NOT NULL' : ''}`);
      });
    }

    // List all tables
    const allTables = await pool.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
    `);

    console.log('\nAll tables in database:');
    allTables.rows.forEach(table => {
      console.log(`  - ${table.tablename}`);
    });

  } catch (error) {
    console.error('Database query error:', error.message);
  } finally {
    await pool.end();
  }
}

checkSchema();