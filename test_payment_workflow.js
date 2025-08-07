const { Client } = require('pg');

// Database connection
const db = new Client({
    host: 'localhost',
    port: 5432,
    database: 'apkbilling_dev',
    user: 'postgresql',  
    password: 'local'
});

async function testPaymentWorkflow() {
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

        // Create a session that will expire in 5 seconds (for quick testing)
        const sessionResult = await db.query(`
            INSERT INTO tv_sessions (device_id, customer_name, package_id, duration_minutes, amount_paid, start_time, status) 
            VALUES ($1, $2, $3, $4, $5, NOW() - INTERVAL '4 seconds', $6) 
            RETURNING id, device_id, customer_name, duration_minutes, amount_paid
        `, [1065, 'Payment Test Customer', 1, 1, 1000.00, 'active']);

        const session = sessionResult.rows[0];
        console.log('✅ Created test session (expires in ~1 minute):', session);
        console.log('');
        
        console.log('🎯 Test Payment Workflow:');
        console.log('   1️⃣ Session created and will expire soon');
        console.log('   2️⃣ SessionExpiredService will change status to "pending_payment"');
        console.log('   3️⃣ Admin panel should show "Pending Payment" status');
        console.log('   4️⃣ Device card should show payment details and "Confirm Payment" button');
        console.log('   5️⃣ Click "Confirm Payment" to complete the workflow');
        console.log('');
        console.log('📋 Expected Flow:');
        console.log('   • Session expires → status becomes "pending_payment"');
        console.log('   • Device shows: "Awaiting Payment: Rp 1,000"');
        console.log('   • Operator clicks "Confirm Payment"');
        console.log('   • Dialog shows payment details');
        console.log('   • After confirmation → status becomes "completed"');
        console.log('   • Device becomes "Available" again');
        console.log('');
        console.log('💡 Wait about 1 minute for session to expire and check admin panel!');

        db.end();

    } catch (error) {
        console.error('❌ Error:', error);
        db.end();
    }
}

testPaymentWorkflow();