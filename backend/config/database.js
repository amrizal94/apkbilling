const { Pool } = require('pg');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgresql',
    password: process.env.DB_PASSWORD || 'local',
    database: process.env.DB_NAME || 'apkbilling_dev',
    max: parseInt(process.env.DB_MAX_CONNECTIONS) || 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 2000,
};

const pool = new Pool(dbConfig);

// Test database connection
async function testConnection() {
    try {
        const client = await pool.connect();
        console.log('✓ PostgreSQL database connected successfully');
        
        // Test query
        const result = await client.query('SELECT NOW()');
        console.log('✓ Database connection test successful');
        
        client.release();
    } catch (error) {
        console.error('✗ Database connection failed:', error.message);
        
        // If database doesn't exist, try to create it
        if (error.code === '3D000') {
            console.log('🔧 Database does not exist, will be created during migration...');
        } else {
            process.exit(1);
        }
    }
}

// Enhanced query method with proper error handling
pool.execute = async (text, params) => {
    const client = await pool.connect();
    try {
        const result = await client.query(text, params);
        return [result.rows, result];
    } finally {
        client.release();
    }
};

// Initialize connection test
testConnection();

// Handle pool errors
pool.on('error', (err) => {
    console.error('Database pool error:', err);
});

module.exports = pool;