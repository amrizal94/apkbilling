const { Pool } = require('pg');
require('dotenv').config();

// Connection for database creation (connects to postgres database)
const setupConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgresql',
    password: process.env.DB_PASSWORD || 'local',
    database: 'postgres', // Connect to default postgres database
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
};

const setupPool = new Pool(setupConfig);

// Enhanced query method
setupPool.execute = async (text, params) => {
    const client = await setupPool.connect();
    try {
        const result = await client.query(text, params);
        return [result.rows, result];
    } finally {
        client.release();
    }
};

module.exports = setupPool;