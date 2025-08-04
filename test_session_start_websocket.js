const { Client } = require('pg');

// Database connection
const db = new Client({
    host: 'localhost',
    port: 5432,
    database: 'apkbilling_dev',
    user: 'postgresql',  
    password: 'local'
});

async function testSessionStartWebSocket() {
    try {
        // Connect to database
        await db.connect();
        console.log('🔗 Connected to database');

        // Clear any existing sessions for our test device (PS 3)
        await db.query(`
            UPDATE tv_sessions 
            SET status = 'completed', end_time = NOW() 
            WHERE device_id = 1065 AND status = 'active'
        `);
        console.log('🧹 Cleared existing sessions for PS 3');

        // Get device info to verify we have the correct device_id string
        const deviceResult = await db.query(`
            SELECT id, device_id, device_name FROM tv_devices WHERE id = 1065
        `);
        
        if (deviceResult.rows.length === 0) {
            console.log('❌ Device ID 1065 not found');
            db.end();
            return;
        }
        
        const device = deviceResult.rows[0];
        console.log('📱 Device info:', device);

        // Create a new test session that will trigger session_started WebSocket event
        const sessionResult = await db.query(`
            INSERT INTO tv_sessions (device_id, customer_name, package_id, duration_minutes, start_time, status) 
            VALUES ($1, $2, $3, $4, NOW(), $5) 
            RETURNING id, device_id, customer_name, duration_minutes
        `, [1065, 'WebSocket Test Session', 1, 3, 'active']);

        const session = sessionResult.rows[0];
        console.log('✅ Created test session:', session);
        console.log('');
        
        console.log('🎯 Test Session Start WebSocket:');
        console.log('   📡 Backend should emit session_started event with:');
        console.log(`      - device_id: "${device.device_id}" (string)`);
        console.log(`      - db_device_id: ${device.id} (database ID)`);
        console.log(`      - customer_name: "WebSocket Test Session"`);
        console.log('');
        console.log('   🔍 Check logs for:');
        console.log(`      - Admin panel: "🎯 Session started:" message`);
        console.log(`      - Android app: "✅ Session started for our device:" message`);
        console.log('      - Android app should show session detection');
        console.log('');
        console.log('   ⚠️  If Android doesn\'t respond:');
        console.log('      - Check if Android device_id matches backend device_id');
        console.log(`      - Android should have device_id: "${device.device_id}" or "ATV_${device.device_id}"`);
        console.log('      - Check WebSocket connection and authentication');

        db.end();

    } catch (error) {
        console.error('❌ Error:', error);
        db.end();
    }
}

testSessionStartWebSocket();