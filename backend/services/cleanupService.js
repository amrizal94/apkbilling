const db = require('../config/database');

class CleanupService {
    constructor(io = null) {
        this.io = io;
        this.cleanupInterval = null;
        this.isRunning = false;
    }

    // Set socket.io instance for real-time notifications
    setSocketIO(io) {
        this.io = io;
    }

    // Start periodic cleanup service
    start(intervalMinutes = 5) {
        if (this.isRunning) {
            console.log('⚠️ Cleanup service is already running');
            return;
        }

        console.log(`🚀 Starting device discovery cleanup service (every ${intervalMinutes} minutes)`);
        this.isRunning = true;

        // Initial cleanup
        this.performCleanup();

        // Schedule periodic cleanup
        this.cleanupInterval = setInterval(() => {
            this.performCleanup();
        }, intervalMinutes * 60 * 1000);
    }

    // Stop cleanup service
    stop() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.isRunning = false;
        console.log('🛑 Device discovery cleanup service stopped');
    }

    // Perform automatic cleanup
    async performCleanup() {
        try {
            console.log('🧹 Running automatic device discovery cleanup...');
            
            // 1. Remove stale pending discoveries (not seen for 10+ minutes)
            const [staleCleanup] = await db.execute(`
                DELETE FROM device_discoveries 
                WHERE last_seen < CURRENT_TIMESTAMP - INTERVAL '10 minutes'
                AND approved_at IS NULL 
                AND rejected_at IS NULL
                AND NOT EXISTS (
                    SELECT 1 FROM tv_devices td WHERE td.device_id = device_discoveries.device_id
                )
            `);

            const staleRemoved = staleCleanup.rowCount || 0;

            // 2. Remove duplicate pending discoveries (keep only the latest)
            const [duplicateCleanup] = await db.execute(`
                DELETE FROM device_discoveries d1
                WHERE d1.approved_at IS NULL 
                AND d1.rejected_at IS NULL
                AND EXISTS (
                    SELECT 1 FROM device_discoveries d2 
                    WHERE d2.device_id = d1.device_id 
                    AND d2.id > d1.id
                    AND d2.approved_at IS NULL 
                    AND d2.rejected_at IS NULL
                )
            `);

            const duplicatesRemoved = duplicateCleanup.rowCount || 0;
            const totalCleaned = staleRemoved + duplicatesRemoved;

            if (totalCleaned > 0) {
                console.log(`✅ Cleanup completed: ${totalCleaned} records removed (${staleRemoved} stale, ${duplicatesRemoved} duplicates)`);
                
                // Emit real-time notification
                if (this.io) {
                    this.io.emit('auto_cleanup_completed', {
                        total_cleaned: totalCleaned,
                        stale_removed: staleRemoved,
                        duplicates_removed: duplicatesRemoved,
                        timestamp: new Date().toISOString()
                    });
                }
            }

            return {
                success: true,
                total_cleaned: totalCleaned,
                stale_removed: staleRemoved,
                duplicates_removed: duplicatesRemoved
            };

        } catch (error) {
            console.error('❌ Auto cleanup error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Cleanup disconnected devices immediately (aggressive)
    async cleanupDisconnected(timeoutMinutes = 5) {
        try {
            console.log(`🔥 Running aggressive cleanup for devices not seen for ${timeoutMinutes}+ minutes...`);

            const [result] = await db.execute(`
                DELETE FROM device_discoveries 
                WHERE last_seen < CURRENT_TIMESTAMP - INTERVAL '${timeoutMinutes} minutes'
                AND approved_at IS NULL 
                AND rejected_at IS NULL
                AND NOT EXISTS (
                    SELECT 1 FROM tv_devices td WHERE td.device_id = device_discoveries.device_id
                )
            `);

            const cleanedCount = result.rowCount || 0;
            
            if (cleanedCount > 0) {
                console.log(`✅ Aggressive cleanup: ${cleanedCount} disconnected devices removed`);
                
                // Emit real-time notification
                if (this.io) {
                    this.io.emit('aggressive_cleanup_completed', {
                        cleaned_count: cleanedCount,
                        timeout_minutes: timeoutMinutes,
                        timestamp: new Date().toISOString()
                    });
                }
            }

            return {
                success: true,
                cleaned_count: cleanedCount,
                timeout_minutes: timeoutMinutes
            };

        } catch (error) {
            console.error('❌ Aggressive cleanup error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get cleanup statistics
    async getStats() {
        try {
            const [stats] = await db.execute(`
                SELECT 
                    COUNT(*) as total_discoveries,
                    COUNT(CASE WHEN approved_at IS NULL AND rejected_at IS NULL THEN 1 END) as pending,
                    COUNT(CASE WHEN last_seen < CURRENT_TIMESTAMP - INTERVAL '5 minutes' 
                               AND approved_at IS NULL AND rejected_at IS NULL THEN 1 END) as stale_5min,
                    COUNT(CASE WHEN last_seen < CURRENT_TIMESTAMP - INTERVAL '10 minutes' 
                               AND approved_at IS NULL AND rejected_at IS NULL THEN 1 END) as stale_10min,
                    COUNT(CASE WHEN approved_at IS NULL AND rejected_at IS NULL THEN 1 END) as duplicates_potential
                FROM device_discoveries
            `);

            return {
                success: true,
                data: stats[0]
            };

        } catch (error) {
            console.error('❌ Get cleanup stats error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Status of cleanup service
    getStatus() {
        return {
            is_running: this.isRunning,
            has_socket: !!this.io,
            interval_active: !!this.cleanupInterval
        };
    }
}

module.exports = CleanupService;