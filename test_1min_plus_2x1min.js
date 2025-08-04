const { Client } = require('pg');

// Database connection
const db = new Client({
    host: 'localhost',
    port: 5432,
    database: 'apkbilling_dev',
    user: 'postgresql',  
    password: 'local'
});

async function test1MinPlus2x1Min() {
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

        // Create a new 1-minute test session
        const sessionResult = await db.query(`
            INSERT INTO tv_sessions (device_id, customer_name, package_id, duration_minutes, start_time, status) 
            VALUES ($1, $2, $3, $4, NOW(), $5) 
            RETURNING id, device_id, customer_name, duration_minutes
        `, [1065, '1Min+2x1Min Test', 1, 1, 'active']);

        const session = sessionResult.rows[0];
        console.log('✅ Created 1-minute session:', session);
        
        console.log('📱 Test scenario:');
        console.log('   1️⃣ Start with 1 minute session');
        console.log('   2️⃣ Wait for Android to detect and start session');
        console.log('   3️⃣ Add 1 minute (total: 2 minutes)');
        console.log('   4️⃣ Add 1 minute again (total: 3 minutes)');
        console.log('   5️⃣ Watch for "masuk keluar APK" behavior');
        console.log('');
        console.log('🔍 Monitor Android logs for:');
        console.log('   - Session start/stop cycles');
        console.log('   - Timer updates from server');
        console.log('   - WebSocket events');

        // Wait a bit for session to be detected
        setTimeout(async () => {
            console.log('');
            console.log('⏰ Adding first +1 minute...');
            
            await db.query(`
                UPDATE tv_sessions 
                SET duration_minutes = duration_minutes + 1
                WHERE id = $1 AND status = 'active'
            `, [session.id]);
            
            console.log('✅ Added 1 minute (should be 2 minutes total)');
            
            // Add second minute after another delay
            setTimeout(async () => {
                console.log('');
                console.log('⏰ Adding second +1 minute...');
                
                await db.query(`
                    UPDATE tv_sessions 
                    SET duration_minutes = duration_minutes + 1
                    WHERE id = $1 AND status = 'active'
                `, [session.id]);
                
                console.log('✅ Added another 1 minute (should be 3 minutes total)');
                console.log('');
                console.log('🎯 Total session time should now be 3 minutes');
                console.log('📊 Monitor if Android app cycles in/out or stays stable');
                
                db.end();
            }, 15000); // Add second minute after 15 seconds
            
        }, 10000); // Add first minute after 10 seconds

    } catch (error) {
        console.error('❌ Error:', error);
        db.end();
    }
}

test1MinPlus2x1Min();