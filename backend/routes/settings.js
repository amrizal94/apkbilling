const express = require('express');
const router = express.Router();
const db = require('../config/database');
const auth = require('../middleware/auth');

// Get all settings
router.get('/', auth, async (req, res) => {
    try {
        const [settings] = await db.execute(`
            SELECT setting_key, setting_value, description 
            FROM app_settings 
            ORDER BY setting_key
        `);
        
        // Convert to key-value object
        const settingsObject = {};
        settings.forEach(setting => {
            settingsObject[setting.setting_key] = setting.setting_value;
        });
        
        res.json({
            success: true,
            data: settingsObject
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get specific setting
router.get('/:key', auth, async (req, res) => {
    try {
        const { key } = req.params;
        
        const [settings] = await db.execute(
            'SELECT setting_value FROM app_settings WHERE setting_key = $1',
            [key]
        );
        
        if (settings.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Setting not found'
            });
        }
        
        res.json({
            success: true,
            data: {
                [key]: settings[0].setting_value
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Update setting
router.put('/:key', auth, async (req, res) => {
    try {
        const { key } = req.params;
        const { value } = req.body;
        
        if (value === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Setting value is required'
            });
        }
        
        // Check if setting exists
        const [existingSettings] = await db.execute(
            'SELECT id FROM app_settings WHERE setting_key = $1',
            [key]
        );
        
        if (existingSettings.length === 0) {
            // Create new setting
            await db.execute(
                'INSERT INTO app_settings (setting_key, setting_value) VALUES ($1, $2)',
                [key, value]
            );
        } else {
            // Update existing setting
            await db.execute(
                'UPDATE app_settings SET setting_value = $1, updated_at = NOW() WHERE setting_key = $2',
                [value, key]
            );
        }
        
        res.json({
            success: true,
            message: 'Setting updated successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Update multiple settings
router.put('/', auth, async (req, res) => {
    try {
        const settings = req.body;
        
        if (!settings || typeof settings !== 'object') {
            return res.status(400).json({
                success: false,
                message: 'Settings object is required'
            });
        }
        
        // Update each setting
        for (const [key, value] of Object.entries(settings)) {
            // Check if setting exists
            const [existingSettings] = await db.execute(
                'SELECT id FROM app_settings WHERE setting_key = $1',
                [key]
            );
            
            if (existingSettings.length === 0) {
                // Create new setting
                await db.execute(
                    'INSERT INTO app_settings (setting_key, setting_value) VALUES ($1, $2)',
                    [key, value]
                );
            } else {
                // Update existing setting
                await db.execute(
                    'UPDATE app_settings SET setting_value = $1, updated_at = NOW() WHERE setting_key = $2',
                    [value, key]
                );
            }
        }
        
        res.json({
            success: true,
            message: 'Settings updated successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get system info
router.get('/system/info', auth, async (req, res) => {
    try {
        // Database info
        const [dbInfo] = await db.execute('SELECT version() as version');
        
        // Application info
        const appInfo = {
            name: 'APK Billing System',
            version: '1.0.0',
            node_version: process.version,
            platform: process.platform,
            uptime: process.uptime(),
            memory_usage: process.memoryUsage(),
            environment: process.env.NODE_ENV || 'development'
        };
        
        // Database statistics
        const [stats] = await db.execute(`
            SELECT 
                (SELECT COUNT(*) FROM tv_devices) as total_devices,
                (SELECT COUNT(*) FROM tv_sessions WHERE status = 'active') as active_sessions,
                (SELECT COUNT(*) FROM orders WHERE status IN ('pending', 'preparing')) as pending_orders,
                (SELECT COUNT(*) FROM products WHERE stock_quantity <= ${parseInt(process.env.LOW_STOCK_THRESHOLD) || 10}) as low_stock_items
        `);
        
        res.json({
            success: true,
            data: {
                application: appInfo,
                database: {
                    version: dbInfo[0].version,
                    statistics: stats[0]
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Database backup endpoint
router.post('/backup', auth, async (req, res) => {
    try {
        const { tables } = req.body; // Optional: specific tables to backup
        
        // Get all tables if not specified
        let tablesToBackup = tables;
        if (!tablesToBackup || tablesToBackup.length === 0) {
            const [tablesResult] = await db.execute(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_type = 'BASE TABLE'
                ORDER BY table_name
            `);
            tablesToBackup = tablesResult.map(row => row.table_name);
        }
        
        let backupData = {
            timestamp: new Date().toISOString(),
            tables: {}
        };
        
        // Export each table
        for (const tableName of tablesToBackup) {
            try {
                const [rows] = await db.execute(`SELECT * FROM ${tableName}`);
                backupData.tables[tableName] = rows;
            } catch (error) {
                console.warn(`Failed to backup table ${tableName}:`, error.message);
            }
        }
        
        res.json({
            success: true,
            data: backupData,
            message: `Backup created successfully for ${Object.keys(backupData.tables).length} tables`
        });
        
    } catch (error) {
        console.error('Backup error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create backup'
        });
    }
});

// System health check
router.get('/health', async (req, res) => {
    try {
        // Test database connection
        await db.execute('SELECT 1');
        
        // Get basic system stats
        const [sessionCount] = await db.execute('SELECT COUNT(*) as count FROM tv_sessions WHERE status = \'active\'');
        const [orderCount] = await db.execute('SELECT COUNT(*) as count FROM orders WHERE status IN (\'pending\', \'preparing\')');
        const [deviceCount] = await db.execute('SELECT COUNT(*) as count FROM tv_devices WHERE status = \'online\'');
        
        res.json({
            success: true,
            data: {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                database: 'connected',
                active_sessions: sessionCount[0].count,
                pending_orders: orderCount[0].count,
                online_devices: deviceCount[0].count,
                uptime: process.uptime()
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            data: {
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                error: error.message
            }
        });
    }
});

module.exports = router;