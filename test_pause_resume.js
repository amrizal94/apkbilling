const { Client } = require('pg');

// Database connection
const db = new Client({
    host: 'localhost',
    port: 5432,
    database: 'apkbilling_dev',
    user: 'postgresql',  
    password: 'local'
});

async function testPauseResume() {
    try {
        // Connect to database
        await db.connect();
        console.log('🔗 Connected to database');

        // Clear any existing sessions for our test device
        await db.query(`
            UPDATE tv_sessions 
            SET status = 'completed', end_time = NOW() 
            WHERE device_id = 1065 AND status IN ('active', 'pending_payment')
        `);
        console.log('🧹 Cleared existing sessions for PS 3');

        // Create a test session for pause/resume testing
        const sessionResult = await db.query(`
            INSERT INTO tv_sessions (device_id, customer_name, package_id, duration_minutes, amount_paid, payment_type, start_time, status) 
            VALUES ($1, $2, $3, $4, $5, $6, NOW() - INTERVAL '10 minutes', $7) 
            RETURNING id, device_id, customer_name, duration_minutes, amount_paid, start_time
        `, [1065, 'Pause Test Customer', 1, 60, 5000.00, 'pay_later', 'active']);

        const session = sessionResult.rows[0];
        console.log('✅ Created test session for pause/resume testing:', {
            id: session.id,
            device_id: session.device_id,
            customer_name: session.customer_name,
            duration_minutes: session.duration_minutes,
            started_ago: '10 minutes ago'
        });
        
        console.log('');
        console.log('⏸️ Test Pause/Resume System:');
        console.log('   1️⃣ Session created and running for 10 minutes');
        console.log('   2️⃣ Go to admin panel TV Management');
        console.log('   3️⃣ Find PS 3 card with active session');
        console.log('   4️⃣ Click pause button (⏸️) on the session');
        console.log('   5️⃣ Select pause reason (prayer_time, power_outage, etc.)');
        console.log('   6️⃣ Add optional pause notes');
        console.log('   7️⃣ Click "Pause Session" button');
        console.log('   8️⃣ Card should show "PAUSED" status with pause reason');
        console.log('   9️⃣ Click resume button (▶️) to resume session');
        console.log('   🔟 Verify timing calculations exclude paused duration');
        console.log('');
        console.log('💡 Features to Test:');
        console.log('   ⏰ Pause reasons: Prayer time, Power outage, Customer request');
        console.log('   📝 Optional pause notes for documentation');
        console.log('   🧮 Time calculation: Active time vs Paused time');
        console.log('   📱 Real-time UI updates (pause/resume notifications)');
        console.log('   👤 Operator tracking (who paused/resumed)');
        console.log('   🔄 WebSocket events to Android TV app');
        console.log('');
        console.log('🎯 Expected Flow:');
        console.log('   • Customer playing for 10 minutes (50 minutes remaining)');
        console.log('   • Operator pauses for "prayer_time" (5 minute pause)');
        console.log('   • Session shows PAUSED status with reason');
        console.log('   • After resume: Still 50 minutes remaining (pause time excluded)');
        console.log('   • Android TV receives pause/resume WebSocket events');
        console.log('');
        console.log('⏱️ Time Calculation Test:');
        console.log('   Initial: 60 min session, 10 min elapsed = 50 min remaining');
        console.log('   After 5 min pause: Should still be 50 min remaining');
        console.log('   Formula: remaining = duration - (now - start_time - total_paused_time)');
        console.log('');
        console.log('🧪 Database Queries to Verify:');
        console.log('   1. Check pause fields are populated correctly');
        console.log('   2. Verify paused_by references correct user');
        console.log('   3. Confirm is_manually_paused flag is set');
        console.log('   4. Test resumed_by field after resume');
        console.log('   5. Validate pause_reason constraint');

        // Show current session timing
        const timingResult = await db.query(`
            SELECT 
                customer_name,
                duration_minutes,
                EXTRACT(EPOCH FROM (NOW() - start_time))/60 as minutes_elapsed,
                duration_minutes - EXTRACT(EPOCH FROM (NOW() - start_time))/60 as remaining_minutes,
                paused_at,
                is_manually_paused,
                pause_reason
            FROM tv_sessions 
            WHERE id = $1
        `, [session.id]);

        const timing = timingResult.rows[0];
        console.log('');
        console.log('📊 Current Session Timing:');
        console.log(`   Customer: ${timing.customer_name}`);
        console.log(`   Duration: ${timing.duration_minutes} minutes`);
        console.log(`   Elapsed: ${Math.round(timing.minutes_elapsed)} minutes`);
        console.log(`   Remaining: ${Math.round(timing.remaining_minutes)} minutes`);
        console.log(`   Status: ${timing.is_manually_paused ? 'PAUSED' : 'ACTIVE'}`);
        if (timing.pause_reason) {
            console.log(`   Pause Reason: ${timing.pause_reason}`);
        }

        db.end();

    } catch (error) {
        console.error('❌ Error:', error);
        db.end();
    }
}

testPauseResume();