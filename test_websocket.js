const io = require('socket.io-client');
const { Client } = require('pg');

// Database connection - use same config as backend
const db = new Client({
    host: 'localhost',
    port: 5432,
    database: 'apkbilling_dev',
    user: 'postgresql',  
    password: 'local'
});

async function testWebSocketSession() {
    try {
        // Connect to database
        await db.connect();
        console.log('🔗 Connected to database');

        // Insert test session (device_id should be the integer ID, not the device_id string)
        const sessionResult = await db.query(`
            INSERT INTO tv_sessions (device_id, customer_name, package_id, duration_minutes, start_time, status) 
            VALUES ($1, $2, $3, $4, NOW(), $5) 
            RETURNING id, device_id, customer_name, duration_minutes
        `, [1065, 'WebSocket Test Customer', 1, 30, 'active']);

        const session = sessionResult.rows[0];
        console.log('✅ Session created:', session);

        // Connect to WebSocket as admin to broadcast session_started event
        const socket = io('http://localhost:3000');
        
        socket.on('connect', () => {
            console.log('🔌 Connected to WebSocket server');
            
            // Authenticate as admin
            socket.emit('authenticate', {
                user: { 
                    id: 'admin', 
                    username: 'admin', 
                    role: 'admin' 
                }
            });
            
            // Wait a bit then emit session_started event
            setTimeout(() => {
                const eventData = {
                    sessionId: session.id,
                    deviceId: session.device_id,
                    deviceName: 'PS 3',
                    customerName: session.customer_name,
                    durationMinutes: session.duration_minutes,
                    timestamp: new Date().toISOString()
                };
                
                console.log('📡 Broadcasting session_started event:', eventData);
                
                // Broadcast to device
                socket.emit('session_started', eventData);
                
                // Also broadcast to specific device rooms (note: socket.to() for client-side, server handles actual broadcasting)
                console.log('📡 Session event would be broadcasted to device rooms by server');
                
                setTimeout(() => {
                    console.log('🏁 Test complete - disconnecting');
                    socket.disconnect();
                    db.end();
                }, 2000);
                
            }, 1000);
        });
        
        socket.on('authenticated', () => {
            console.log('🔐 Authenticated with WebSocket server');
        });
        
        socket.on('connect_error', (error) => {
            console.error('❌ WebSocket connection error:', error);
        });

    } catch (error) {
        console.error('❌ Error:', error);
        db.end();
    }
}

testWebSocketSession();