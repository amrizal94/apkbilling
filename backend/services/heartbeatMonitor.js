// Heartbeat Monitor Service
// Checks for offline devices and auto-pauses sessions

const db = require('../config/database');

class HeartbeatMonitor {
    constructor(io = null) {
        this.checkInterval = 60000; // Check every 1 minute
        this.intervalId = null;
        this.io = io; // WebSocket instance for notifications
        this.timezone = process.env.TIMEZONE || 'Asia/Jakarta';
    }

    start() {
        console.log('🔄 Starting heartbeat monitor...');
        console.log('🌍 Using timezone:', this.timezone);
        console.log('🕐 Current server time:', new Date().toLocaleString('id-ID', { timeZone: this.timezone }));
        
        this.intervalId = setInterval(async () => {
            try {
                await this.checkOfflineDevices();
            } catch (error) {
                console.error('❌ Heartbeat monitor error:', error);
            }
        }, this.checkInterval);
        
        console.log('✅ Heartbeat monitor started, checking every', this.checkInterval / 1000, 'seconds');
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('⏹️ Heartbeat monitor stopped');
        }
    }

    async checkOfflineDevices() {
        try {
            // 1. Find devices with active sessions that are offline (pause sessions)
            const [offlineDevicesWithSessions] = await db.execute(`
                SELECT d.id, d.device_name, d.device_id, s.id as session_id, s.customer_name
                FROM tv_devices d
                JOIN tv_sessions s ON d.id = s.device_id
                WHERE s.status = 'active' 
                AND s.paused_at IS NULL
                AND (d.last_heartbeat IS NULL OR d.last_heartbeat < CURRENT_TIMESTAMP - INTERVAL '2 minutes')
            `);
            
            let pausedSessions = 0;
            
            for (const device of offlineDevicesWithSessions) {
                // Pause the session
                await db.execute(`
                    UPDATE tv_sessions 
                    SET paused_at = CURRENT_TIMESTAMP
                    WHERE id = $1 AND status = 'active'
                `, [device.session_id]);
                
                // Update device status
                await db.execute(`
                    UPDATE tv_devices 
                    SET status = 'offline'
                    WHERE id = $1
                `, [device.id]);
                
                console.log(`⚠️ Session paused for offline device: ${device.device_name} (${device.customer_name})`);
                pausedSessions++;
                
                // Emit WebSocket notification
                if (this.io) {
                    this.io.emit('session_paused', {
                        device_id: device.device_id,
                        device_name: device.device_name,
                        customer_name: device.customer_name,
                        reason: 'Device offline - possible power failure',
                        timestamp: new Date().toISOString()
                    });
                }
            }
            
            // 2. Find ALL devices that are offline (no heartbeat) and update their status
            const [allOfflineDevices] = await db.execute(`
                SELECT id, device_name, device_id, status, last_heartbeat,
                       EXTRACT(EPOCH FROM (NOW() - last_heartbeat))/60 as minutes_since_heartbeat
                FROM tv_devices 
                WHERE (last_heartbeat IS NULL OR last_heartbeat < NOW() - INTERVAL '2 minutes')
                AND status != 'offline'
            `);
            
            let statusUpdated = 0;
            
            if (allOfflineDevices.length > 0) {
                console.log(`🔍 Found ${allOfflineDevices.length} offline devices to update:`);
                allOfflineDevices.forEach(device => {
                    const minutesAgo = device.minutes_since_heartbeat ? Math.round(device.minutes_since_heartbeat) : 'never';
                    console.log(`  - ${device.device_name} (${device.device_id}): last heartbeat ${minutesAgo} minutes ago`);
                });
            }
            
            for (const device of allOfflineDevices) {
                await db.execute(`
                    UPDATE tv_devices 
                    SET status = 'offline'
                    WHERE id = $1
                `, [device.id]);
                
                console.log(`📶 Device status updated to offline: ${device.device_name} (${device.device_id})`);
                statusUpdated++;
                
                // Emit WebSocket notification for status change
                if (this.io) {
                    this.io.emit('device_status_changed', {
                        device_id: device.device_id,
                        device_name: device.device_name,
                        old_status: device.status,
                        new_status: 'offline',
                        reason: 'No heartbeat received',
                        timestamp: new Date().toISOString()
                    });
                }
            }
            
            if (pausedSessions > 0) {
                console.log(`🔄 Auto-paused ${pausedSessions} sessions due to offline devices`);
            }
            if (statusUpdated > 0) {
                console.log(`📱 Updated ${statusUpdated} device(s) status to offline`);
            }
            
        } catch (error) {
            console.error('❌ Failed to check offline devices:', error.message);
        }
    }
}

module.exports = HeartbeatMonitor;