require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'apkbilling_dev',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password'
});

async function testPackagesQuery() {
  try {
    console.log('Testing packages query...');
    
    // First check tv_sessions table structure
    console.log('Checking tv_sessions table structure...');
    const columnsQuery = 'SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position';
    const columns = await pool.query(columnsQuery, ['tv_sessions']);
    console.log('tv_sessions columns:');
    columns.rows.forEach(r => console.log(`- ${r.column_name} (${r.data_type})`));
    
    // Test basic packages query
    const packagesQuery = 'SELECT * FROM packages WHERE is_active = true ORDER BY name LIMIT 50 OFFSET 0';
    const packages = await pool.query(packagesQuery);
    console.log(`\nFound ${packages.rows.length} packages`);
    
    if (packages.rows.length > 0) {
      const firstPackage = packages.rows[0];
      console.log('Testing stats query for first package:', firstPackage.name);
      
      // Test simple stats query first
      const simpleStatsQuery = `SELECT COUNT(*) as total_sessions FROM tv_sessions WHERE package_id = $1`;
      const simpleStats = await pool.query(simpleStatsQuery, [firstPackage.id]);
      console.log('Simple stats result:', simpleStats.rows[0]);
    }
    
    await pool.end();
    console.log('Test completed successfully');
  } catch (error) {
    console.error('Error during test:', error);
    await pool.end();
    process.exit(1);
  }
}

testPackagesQuery();