const { Client } = require('pg');

// Database connection
const db = new Client({
    host: 'localhost',
    port: 5432,
    database: 'apkbilling_dev',
    user: 'postgresql',  
    password: 'local'
});

async function checkSession() {
    try {
        await db.connect();
        
        // Check direct session data
        const result = await db.query(`
            SELECT id, device_id, customer_name, duration_minutes, 
                   EXTRACT(EPOCH FROM (NOW() - start_time))/60 as elapsed_minutes,
                   status, start_time
            FROM tv_sessions 
            WHERE device_id = 1065 AND status = 'active'
            ORDER BY start_time DESC
        `);
        
        console.log('📊 Direct database session data:');
        result.rows.forEach(session => {
            const remaining = session.duration_minutes - Math.floor(session.elapsed_minutes);
            console.log(`   Session ID: ${session.id}`);
            console.log(`   Customer: ${session.customer_name}`);
            console.log(`   Duration: ${session.duration_minutes} minutes`);
            console.log(`   Elapsed: ${Math.floor(session.elapsed_minutes)} minutes`);
            console.log(`   Remaining: ${remaining} minutes`);
            console.log(`   Status: ${session.status}`);
            console.log(`   Start: ${session.start_time}`);
            console.log('');
        });
        
        db.end();
        
    } catch (error) {
        console.error('❌ Error:', error);
        db.end();
    }
}

checkSession();