const { Client } = require('pg');

// Database connection
const db = new Client({
    host: 'localhost',
    port: 5432,
    database: 'apkbilling_dev',
    user: 'postgresql',  
    password: 'local'
});

async function testAdminPanelSync() {
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

        // Create a new 30-second test session for quick testing
        const sessionResult = await db.query(`
            INSERT INTO tv_sessions (device_id, customer_name, package_id, duration_minutes, start_time, status) 
            VALUES ($1, $2, $3, $4, NOW() - INTERVAL '29 seconds', $5) 
            RETURNING id, device_id, customer_name, duration_minutes
        `, [1065, 'Admin Panel Sync Test', 1, 1, 'active']);

        const session = sessionResult.rows[0];
        console.log('✅ Created 30-second test session (almost expired):', session);
        console.log('');
        console.log('🎯 Test Admin Panel Real-time Sync:');
        console.log('   1️⃣ Check admin panel - should show active session');
        console.log('   2️⃣ Wait ~30 seconds for session to expire');
        console.log('   3️⃣ Watch admin panel update automatically');
        console.log('   4️⃣ Should see "Session Expired" toast notification');
        console.log('   5️⃣ PS 3 card should change from active to inactive');
        console.log('');
        console.log('🔍 Monitor:');
        console.log('   - Admin panel WebSocket events');
        console.log('   - Toast notifications');
        console.log('   - Real-time UI updates');

        db.end();

    } catch (error) {
        console.error('❌ Error:', error);
        db.end();
    }
}

testAdminPanelSync();