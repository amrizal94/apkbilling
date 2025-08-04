const db = require('../config/database');

class SessionExpiredService {
    constructor(io) {
        this.io = io;
        this.intervalId = null;
        this.isRunning = false;
    }

    start(intervalMinutes = 1) {
        if (this.isRunning) {
            console.log('⚠️  Session expired service already running');
            return;
        }

        console.log(`🕐 Starting session expired service (every ${intervalMinutes} minute(s))`);
        this.isRunning = true;
        
        // Run immediately
        this.checkExpiredSessions();
        
        // Then run on interval
        this.intervalId = setInterval(() => {
            this.checkExpiredSessions();
        }, intervalMinutes * 60 * 1000);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        console.log('🛑 Session expired service stopped');
    }

    async checkExpiredSessions() {
        try {
            console.log('🔍 Checking for expired sessions...');
            
            // Find expired sessions
            const [expiredSessions] = await db.execute(`
                SELECT 
                    s.id,
                    s.device_id,
                    s.customer_name,
                    s.duration_minutes,
                    s.start_time,
                    td.device_name,
                    td.device_location,
                    EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - s.start_time)) / 60 as elapsed_minutes
                FROM tv_sessions s
                LEFT JOIN tv_devices td ON s.device_id = td.id
                WHERE s.status = 'active'
                AND EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - s.start_time)) / 60 > s.duration_minutes
            `);

            if (expiredSessions.length === 0) {
                console.log('✅ No expired sessions found');
                return;
            }

            console.log(`⏰ Found ${expiredSessions.length} expired session(s)`);

            // Auto-stop expired sessions
            for (const session of expiredSessions) {
                await this.stopExpiredSession(session);
            }

        } catch (error) {
            console.error('❌ Error checking expired sessions:', error);
        }
    }

    async stopExpiredSession(session) {
        try {
            const overdueMinutes = Math.round(session.elapsed_minutes - session.duration_minutes);
            
            console.log(`⏰ Auto-stopping expired session:`, {
                id: session.id,
                device: session.device_name,
                customer: session.customer_name,
                overdue: `${overdueMinutes} minutes`
            });

            // Stop the expired session by marking it as completed
            const [, result] = await db.execute(`
                UPDATE tv_sessions 
                SET status = 'completed', 
                    end_time = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [session.id]);

            if (result.rowCount > 0) {
                // Emit real-time notification to admin panel AND devices
                const eventData = {
                    sessionId: session.id,
                    deviceId: session.device_id,
                    deviceName: session.device_name,
                    deviceLocation: session.device_location,
                    customerName: session.customer_name,
                    overdueMinutes: overdueMinutes,
                    timestamp: new Date().toISOString()
                };
                
                // Broadcast to all admin users
                this.io.to('role_admin').emit('sessionExpired', eventData);
                this.io.to('role_manager').emit('sessionExpired', eventData);
                
                // Also broadcast to the specific device
                this.io.to(`user_ATV_${session.device_id}`).emit('sessionExpired', eventData);
                this.io.to(`user_${session.device_id}`).emit('sessionExpired', eventData);
                
                // Global broadcast for any connected Android TV devices
                this.io.to('role_device').emit('sessionExpired', eventData);
                
                console.log(`✅ Session ${session.id} auto-stopped (${overdueMinutes}min overdue) - broadcasted to devices`);
            }

        } catch (error) {
            console.error(`❌ Error stopping session ${session.id}:`, error);
        }
    }

    // Method to get current expired sessions for initial load
    async getExpiredSessions() {
        try {
            const [expiredSessions] = await db.execute(`
                SELECT 
                    s.id as session_id,
                    s.device_id,
                    s.customer_name,
                    s.duration_minutes,
                    s.start_time,
                    s.end_time,
                    td.device_name,
                    td.device_location,
                    EXTRACT(EPOCH FROM (COALESCE(s.end_time, CURRENT_TIMESTAMP) - s.start_time)) / 60 as elapsed_minutes
                FROM tv_sessions s
                LEFT JOIN tv_devices td ON s.device_id = td.id
                WHERE s.status = 'completed'
                AND EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 60 > s.duration_minutes
                AND s.end_time >= CURRENT_TIMESTAMP - INTERVAL '1 hour'
                ORDER BY s.end_time DESC
            `);

            return expiredSessions.map(session => ({
                sessionId: session.session_id,
                deviceId: session.device_id,
                deviceName: session.device_name,
                deviceLocation: session.device_location,
                customerName: session.customer_name,
                overdueMinutes: Math.round(session.elapsed_minutes - session.duration_minutes),
                timestamp: session.end_time
            }));

        } catch (error) {
            console.error('❌ Error getting expired sessions:', error);
            return [];
        }
    }
}

module.exports = SessionExpiredService;