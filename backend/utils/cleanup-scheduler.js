const cron = require('node-cron');
const axios = require('axios');

// Cleanup scheduler untuk auto-cleanup device discoveries
class CleanupScheduler {
    constructor(serverUrl = 'http://localhost:3000') {
        this.serverUrl = serverUrl;
        this.isRunning = false;
    }

    start() {
        if (this.isRunning) {
            console.log('⚠️  Cleanup scheduler already running');
            return;
        }

        console.log('🧹 Starting device discovery cleanup scheduler...');
        
        // Run cleanup every day at 2 AM
        this.dailyCleanup = cron.schedule('0 2 * * *', async () => {
            await this.runScheduledCleanup();
        }, {
            scheduled: false,
            timezone: "Asia/Jakarta"
        });

        // Run cleanup every 6 hours during business hours (6 AM, 12 PM, 6 PM)
        this.businessHoursCleanup = cron.schedule('0 6,12,18 * * *', async () => {
            await this.runLightCleanup();
        }, {
            scheduled: false,
            timezone: "Asia/Jakarta"
        });

        this.dailyCleanup.start();
        this.businessHoursCleanup.start();
        this.isRunning = true;

        console.log('✅ Cleanup scheduler started');
        console.log('📅 Daily full cleanup: Every day at 2:00 AM');
        console.log('🕘 Light cleanup: Every 6 hours at 6 AM, 12 PM, 6 PM');
    }

    stop() {
        if (!this.isRunning) {
            console.log('⚠️  Cleanup scheduler not running');
            return;
        }

        if (this.dailyCleanup) {
            this.dailyCleanup.stop();
        }
        if (this.businessHoursCleanup) {
            this.businessHoursCleanup.stop();
        }
        
        this.isRunning = false;
        console.log('🛑 Cleanup scheduler stopped');
    }

    async runScheduledCleanup() {
        try {
            console.log('🧹 Running scheduled full cleanup...');
            
            const response = await axios.post(`${this.serverUrl}/api/tv/schedule-cleanup`);
            
            if (response.data.success) {
                const { total_removed, stale_pending_removed, old_rejected_removed, old_approved_removed } = response.data;
                console.log(`✅ Full cleanup completed:`);
                console.log(`   • Stale pending: ${stale_pending_removed} removed`);
                console.log(`   • Old rejected: ${old_rejected_removed} removed`);
                console.log(`   • Old approved: ${old_approved_removed} removed`);
                console.log(`   • Total: ${total_removed} records removed`);
                
                // Log to file or monitoring system if needed
                this.logCleanupResult('full', response.data);
            }
        } catch (error) {
            console.error('❌ Scheduled cleanup failed:', error.message);
            // Could send alert to monitoring system here
        }
    }

    async runLightCleanup() {
        try {
            console.log('🧹 Running light cleanup (stale pending only)...');
            
            const response = await axios.post(`${this.serverUrl}/api/tv/cleanup-discoveries`, {
                cleanup_type: 'auto',
                hours_threshold: 12 // More aggressive during business hours
            });
            
            if (response.data.success && response.data.records_removed > 0) {
                console.log(`✅ Light cleanup completed: ${response.data.records_removed} stale records removed`);
                this.logCleanupResult('light', response.data);
            }
        } catch (error) {
            console.error('❌ Light cleanup failed:', error.message);
        }
    }

    logCleanupResult(type, data) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            type,
            records_removed: data.records_removed || data.total_removed,
            details: data
        };
        
        // Log to console (could be extended to log to file/database)
        console.log(`📊 Cleanup log: ${JSON.stringify(logEntry)}`);
    }

    // Manual cleanup methods for specific scenarios
    async cleanupStaleDevices(hoursThreshold = 24) {
        try {
            const response = await axios.post(`${this.serverUrl}/api/tv/cleanup-discoveries`, {
                cleanup_type: 'auto',
                hours_threshold: hoursThreshold
            });
            
            return response.data;
        } catch (error) {
            throw new Error(`Cleanup failed: ${error.message}`);
        }
    }

    async cleanupRejectedDevices() {
        try {
            const response = await axios.post(`${this.serverUrl}/api/tv/cleanup-discoveries`, {
                cleanup_type: 'rejected'
            });
            
            return response.data;
        } catch (error) {
            throw new Error(`Cleanup failed: ${error.message}`);
        }
    }

    async getCleanupStats() {
        try {
            const response = await axios.get(`${this.serverUrl}/api/tv/cleanup-stats`);
            return response.data;
        } catch (error) {
            throw new Error(`Failed to get stats: ${error.message}`);
        }
    }

    getStatus() {
        return {
            isRunning: this.isRunning,
            nextRuns: this.isRunning ? {
                dailyCleanup: this.dailyCleanup ? 'Scheduled for 2:00 AM daily' : 'Not scheduled',
                businessHoursCleanup: this.businessHoursCleanup ? 'Scheduled for 6 AM, 12 PM, 6 PM daily' : 'Not scheduled'
            } : null
        };
    }
}

module.exports = CleanupScheduler;