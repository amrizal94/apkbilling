const { Client } = require('pg');

// Database connection
const db = new Client({
    host: 'localhost',
    port: 5432,
    database: 'apkbilling_dev',
    user: 'postgresql',  
    password: 'local'
});

async function testAddTime() {
    try {
        // Connect to database
        await db.connect();
        console.log('🔗 Connected to database');

        // Add 15 minutes to the current active session (ID 49)
        const addTimeResult = await db.query(`
            UPDATE tv_sessions 
            SET duration_minutes = duration_minutes + $1
            WHERE id = $2 AND status = 'active'
            RETURNING id, customer_name, duration_minutes
        `, [15, 49]);

        if (addTimeResult.rows.length > 0) {
            const session = addTimeResult.rows[0];
            console.log('✅ Time added successfully:', session);
            console.log('📡 In real system, WebSocket would broadcast time_added event to Android device');
        } else {
            console.log('❌ No active session found to add time to');
        }

        db.end();

    } catch (error) {
        console.error('❌ Error:', error);
        db.end();
    }
}

testAddTime();