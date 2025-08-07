const { Client } = require('pg');

// Database connection
const db = new Client({
    host: 'localhost',
    port: 5432,
    database: 'apkbilling_dev',
    user: 'postgresql',  
    password: 'local'
});

async function testFBOrdering() {
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

        // Create a test session for F&B ordering
        const sessionResult = await db.query(`
            INSERT INTO tv_sessions (device_id, customer_name, package_id, duration_minutes, amount_paid, payment_type, start_time, status) 
            VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7) 
            RETURNING id, device_id, customer_name, duration_minutes, amount_paid
        `, [1065, 'F&B Test Customer', 1, 60, 5000.00, 'pay_later', 'active']);

        const session = sessionResult.rows[0];
        console.log('✅ Created test session for F&B ordering:', session);
        
        console.log('');
        console.log('🍽️ Test F&B Ordering System:');
        console.log('   1️⃣ Session created with pay_later option');
        console.log('   2️⃣ Go to admin panel TV Management');
        console.log('   3️⃣ Find PS 3 card with active session');
        console.log('   4️⃣ Click restaurant icon (🍽️) to order food');
        console.log('   5️⃣ Select products and place order');
        console.log('   6️⃣ Card should show consolidated bill (Session + F&B)');
        console.log('   7️⃣ When session expires, payment dialog shows total amount');
        console.log('');
        console.log('💡 Features to Test:');
        console.log('   🍕 Order multiple items from different categories');
        console.log('   📊 Check consolidated billing (TV + F&B)');
        console.log('   💰 Payment confirmation with breakdown');
        console.log('   📱 Real-time updates in UI');
        console.log('   📋 Stock management (quantities decrease)');
        console.log('');
        console.log('🎯 Expected Flow:');
        console.log('   • Customer plays games (TV billing running)');
        console.log('   • Operator takes F&B orders via TV card');
        console.log('   • Bill shows: Session Rp 5,000 + F&B orders');
        console.log('   • At payment time: Single consolidated bill');
        console.log('   • Customer pays everything at once');

        db.end();

    } catch (error) {
        console.error('❌ Error:', error);
        db.end();
    }
}

testFBOrdering();