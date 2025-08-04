const { Client } = require('pg');

// Database connection
const db = new Client({
    host: 'localhost',
    port: 5432,
    database: 'apkbilling_dev',
    user: 'postgresql',  
    password: 'local'
});

async function testUnifiedTiming() {
    try {
        // Connect to database
        await db.connect();
        console.log('🔗 Connected to database');

        // Clear any existing sessions for our test device
        await db.query(`
            UPDATE tv_sessions 
            SET status = 'completed', end_time = NOW() 
            WHERE device_id = 1065 AND status = 'active'
        `);
        console.log('🧹 Cleared existing sessions');

        // Create a new 5-minute test session (easier to test timing)
        const sessionResult = await db.query(`
            INSERT INTO tv_sessions (device_id, customer_name, package_id, duration_minutes, start_time, status) 
            VALUES ($1, $2, $3, $4, NOW(), $5) 
            RETURNING id, device_id, customer_name, duration_minutes
        `, [1065, 'Unified Timing Test', 1, 5, 'active']);

        const session = sessionResult.rows[0];
        console.log('✅ Created 5-minute test session:', session);
        console.log('🕐 Session will be managed by server timer (30-second broadcasts)');
        console.log('⏰ Android should receive timer updates every 30 seconds');
        console.log('🔔 Monitor Android logs for "timer_update" and "session_warning" events');

        db.end();

    } catch (error) {
        console.error('❌ Error:', error);
        db.end();
    }
}

testUnifiedTiming();