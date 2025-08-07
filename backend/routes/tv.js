const express = require('express');
const router = express.Router();
const db = require('../config/database');
const auth = require('../middleware/auth');

// WebSocket instance will be injected
let io = null;

// Function to set io instance
router.setSocketIO = (socketIO) => {
    io = socketIO;
};

// Get device discoveries
router.get('/discoveries', auth, async (req, res) => {
    try {
        const [discoveries] = await db.execute(`
            SELECT 
                dd.*,
                CASE 
                    WHEN td.id IS NOT NULL THEN 'approved'
                    ELSE dd.status
                END as actual_status
            FROM device_discoveries dd
            LEFT JOIN tv_devices td ON dd.device_id = td.device_id
            ORDER BY dd.discovered_at DESC
        `);
        
        res.json({
            success: true,
            data: discoveries
        });
    } catch (error) {
        console.error('Failed to fetch device discoveries:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch device discoveries'
        });
    }
});

// Device discovery - Android TV announces itself (no auto-register)
router.post('/discover', async (req, res) => {
    try {
        const { device_id, device_name, device_type, screen_resolution, os_version, app_version, location } = req.body;
        
        if (!device_id || !device_name) {
            return res.status(400).json({
                success: false,
                message: 'Device ID and name are required'
            });
        }
        
        const ip_address = req.ip || req.connection.remoteAddress || 'unknown';
        console.log(`Device discovery: ${device_name} (${device_id}) from ${ip_address}`);
        
        // Check if device is already registered in tv_devices first
        const [registered] = await db.execute(
            'SELECT id, device_name, device_location FROM tv_devices WHERE device_id = $1',
            [device_id]
        );
        
        if (registered.length > 0) {
            // Device is already registered - update info directly
            await db.execute(`
                UPDATE tv_devices 
                SET device_name = $1, device_location = $2, ip_address = $3, last_heartbeat = CURRENT_TIMESTAMP, status = 'online'
                WHERE device_id = $4
            `, [device_name, location, ip_address, device_id]);
            
            console.log(`📱 Discovery: Updated registered device ${device_name} (${device_id})`);
            
            // Emit WebSocket event for device configuration update - optimized payload
            if (io) {
                const payload = {
                    device_id: device_id,
                    device_name: device_name,
                    device_location: location,
                    ip_address: ip_address,
                    timestamp: new Date().toISOString()
                };
                
                io.emit('device_updated', payload);
                console.log(`📡 Emitted device_updated event for ${device_name} (optimized)`);
            }
            
            // Return registered device info
            const responseData = {
                success: true,
                message: 'Device info updated successfully.',
                data: {
                    id: registered[0].id,
                    device_id: device_id,
                    device_name: device_name,
                    status: 'registered',
                    created_at: new Date().toISOString()
                }
            };
            
            console.log(`📱 Discovery response for ${device_id}:`, JSON.stringify(responseData, null, 2));
            res.json(responseData);
            return;
        }
        
        // Device not registered yet - AUTO-REGISTER directly (no approval needed)
        console.log(`📱 Auto-registering new device: ${device_name} (${device_id})`);
        
        // Insert directly into tv_devices for immediate availability
        const [result] = await db.execute(`
            INSERT INTO tv_devices (device_id, device_name, device_location, ip_address, status, last_heartbeat)
            VALUES ($1, $2, $3, $4, 'online', CURRENT_TIMESTAMP) RETURNING id, created_at
        `, [device_id, device_name, location || null, ip_address]);
        
        console.log(`✅ Auto-registered device: ${device_name} with ID ${result[0].id}`);
        
        // Also add to discovery log for audit trail (marked as auto-approved)
        try {
            await db.execute(`
                INSERT INTO device_discoveries 
                (device_id, device_name, device_type, screen_resolution, os_version, app_version, ip_address, location, approved_at, approved_by)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, 1)
            `, [device_id, device_name, device_type, screen_resolution, os_version, app_version, ip_address, location]);
        } catch (auditError) {
            console.log('Audit trail creation failed (non-critical):', auditError.message);
        }
        
        // Emit real-time notification to admin panel
        if (io) {
            io.emit('device_auto_registered', {
                device_id: device_id,
                device_name: device_name,
                device_location: location,
                ip_address: ip_address,
                timestamp: new Date().toISOString()
            });
        }
        
        res.json({
            success: true,
            message: 'Device registered automatically and ready to use!',
            data: {
                id: result[0].id,
                device_id: device_id,
                device_name: device_name,
                status: 'registered',
                created_at: result[0].created_at
            }
        });
        
    } catch (error) {
        console.error('Device discovery error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Register TV device (auth required - operator approval)
router.post('/register', auth, async (req, res) => {
    try {
        const { device_id, device_name, device_type, screen_resolution, os_version, app_version } = req.body;
        
        if (!device_id || !device_name) {
            return res.status(400).json({
                success: false,
                message: 'Device ID and name are required'
            });
        }
        
        // Get client IP
        const ip_address = req.ip || req.connection.remoteAddress || 'unknown';
        
        console.log(`Registering device: ${device_name} (${device_id}) from ${ip_address}`);
        
        // Check if device already exists
        const [existing] = await db.execute(
            'SELECT id, device_name, created_at FROM tv_devices WHERE device_id = $1',
            [device_id]
        );
        
        // Also check for devices with the same base ID (without ATV_ prefix)
        // This prevents duplicates when switching between prefixed and non-prefixed IDs
        const baseDeviceId = device_id.startsWith('ATV_') ? device_id.substring(4) : device_id;
        const altDeviceId = device_id.startsWith('ATV_') ? baseDeviceId : 'ATV_' + device_id;
        
        // Delete any existing device with the alternative ID to prevent duplicates
        if (altDeviceId !== device_id) {
            console.log(`Removing duplicate device with ID: ${altDeviceId}`);
            await db.execute('DELETE FROM tv_devices WHERE device_id = $1', [altDeviceId]);
        }
        
        if (existing.length > 0) {
            // Update existing device
            await db.execute(`
                UPDATE tv_devices 
                SET device_name = $1, status = 'online', ip_address = $2, updated_at = CURRENT_TIMESTAMP
                WHERE device_id = $3
            `, [device_name, ip_address, device_id]);
            
            res.json({
                success: true,
                message: 'Device updated successfully',
                data: {
                    id: existing[0].id,
                    device_id: device_id,
                    device_name: device_name,
                    status: 'online',
                    created_at: existing[0].created_at
                }
            });
        } else {
            // Insert new device using correct schema
            const [result] = await db.execute(`
                INSERT INTO tv_devices (device_id, device_name, ip_address, status)
                VALUES ($1, $2, $3, 'online') RETURNING id, created_at
            `, [device_id, device_name, ip_address]);
            
            res.json({
                success: true,
                message: 'Device registered successfully',
                data: {
                    id: result[0].id,
                    device_id: device_id,
                    device_name: device_name,
                    status: 'online',
                    created_at: result[0].created_at
                }
            });
        }
        
    } catch (error) {
        console.error('Device registration error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Debug endpoint without auth
router.get('/test', async (req, res) => {
    try {
        console.log('Testing database connection...');
        const [result] = await db.execute('SELECT 1 as test');
        console.log('Database test result:', result);
        res.json({ success: true, message: 'Database connection OK', data: result });
    } catch (error) {
        console.error('Database test error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Temporary migration endpoint
router.post('/migrate-heartbeat', async (req, res) => {
    try {
        console.log('Running heartbeat system migration...');
        
        // Add columns to tv_devices
        await db.execute(`
            ALTER TABLE tv_devices ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        `);
        
        // Add columns to tv_sessions
        await db.execute(`
            ALTER TABLE tv_sessions ADD COLUMN IF NOT EXISTS paused_at TIMESTAMP DEFAULT NULL
        `);
        
        await db.execute(`
            ALTER TABLE tv_sessions ADD COLUMN IF NOT EXISTS paused_duration_minutes INTEGER DEFAULT 0
        `);
        
        // Create heartbeat table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS device_heartbeats (
                id SERIAL PRIMARY KEY,
                device_id INTEGER REFERENCES tv_devices(id) ON DELETE CASCADE,
                heartbeat_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ip_address INET,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Create device discoveries table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS device_discoveries (
                id SERIAL PRIMARY KEY,
                device_id VARCHAR(255) UNIQUE NOT NULL,
                device_name VARCHAR(255) NOT NULL,
                device_type VARCHAR(100),
                screen_resolution VARCHAR(50),
                os_version VARCHAR(50),
                app_version VARCHAR(50),
                ip_address INET,
                location VARCHAR(255),
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                approved_at TIMESTAMP DEFAULT NULL,
                approved_by INTEGER REFERENCES users(id),
                rejected_at TIMESTAMP DEFAULT NULL,
                rejected_by INTEGER REFERENCES users(id),
                rejection_reason TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Add location column if it doesn't exist
        await db.execute(`
            ALTER TABLE device_discoveries ADD COLUMN IF NOT EXISTS location VARCHAR(255)
        `);
        
        // Add device_location column to tv_devices if it doesn't exist
        await db.execute(`
            ALTER TABLE tv_devices ADD COLUMN IF NOT EXISTS device_location VARCHAR(255) DEFAULT NULL
        `);
        
        // Create indexes
        await db.execute(`
            CREATE INDEX IF NOT EXISTS idx_device_heartbeats_device_time ON device_heartbeats(device_id, heartbeat_time DESC)
        `);
        
        await db.execute(`
            CREATE INDEX IF NOT EXISTS idx_tv_devices_heartbeat ON tv_devices(last_heartbeat)
        `);
        
        await db.execute(`
            CREATE INDEX IF NOT EXISTS idx_tv_sessions_paused ON tv_sessions(paused_at)
        `);
        
        console.log('✅ Heartbeat system migration completed');
        res.json({ success: true, message: 'Heartbeat system migration completed successfully' });
    } catch (error) {
        console.error('❌ Migration error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Debug table schema
router.get('/schema', async (req, res) => {
    try {
        const [columns] = await db.execute(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'tv_devices'
            ORDER BY ordinal_position
        `);
        res.json({ success: true, data: columns });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Debug sessions query
router.get('/test-sessions/:deviceId', async (req, res) => {
    try {
        const deviceId = req.params.deviceId;
        console.log('Testing sessions query for device:', deviceId);
        
        const [sessions] = await db.execute(
            'SELECT id FROM tv_sessions WHERE device_id = $1 AND status = $2',
            [deviceId, 'active']
        );
        
        res.json({ success: true, data: sessions, device_id: deviceId });
    } catch (error) {
        console.error('Sessions query error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Test minimal start session
router.post('/test-start', auth, async (req, res) => {
    try {
        const { device_id, customer_name, package_id } = req.body;
        console.log('Test start with:', { device_id, customer_name, package_id });
        
        // Only do the first query
        const [existingSessions] = await db.execute(
            'SELECT id FROM tv_sessions WHERE device_id = $1',
            [device_id]
        );
        
        res.json({
            success: true,
            message: 'Test successful',
            existing_sessions: existingSessions.length
        });
    } catch (error) {
        console.error('Test start error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get all TV devices
router.get('/devices', async (req, res) => {
    try {
        console.log('Fetching TV devices...');
        
        // Query with active session information including pending payments and F&B orders
        const [devices] = await db.execute(`
            SELECT 
                d.*,
                s.id as session_id,
                s.customer_name,
                s.package_id,
                s.duration_minutes,
                s.amount_paid,
                s.payment_type,
                s.start_time,
                s.end_time,
                s.status as session_status,
                s.payment_confirmed_at,
                s.payment_notes,
                s.paused_at,
                s.pause_reason,
                s.pause_notes,
                s.paused_duration_minutes,
                s.is_manually_paused,
                u.full_name as payment_confirmed_by_name,
                pu.full_name as paused_by_name,
                ru.full_name as resumed_by_name,
                p.name as package_name,
                p.price as package_price,
                COALESCE(SUM(so.total_amount), 0) as fb_total_amount,
                COUNT(so.id) as fb_order_count,
                EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - s.start_time))/60 as total_elapsed_minutes,
                CASE 
                    WHEN s.paused_at IS NOT NULL THEN 
                        EXTRACT(EPOCH FROM (s.paused_at - s.start_time))/60 
                    ELSE 
                        EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - s.start_time))/60 
                END as billable_elapsed_minutes,
                CASE 
                    WHEN s.paused_at IS NOT NULL THEN 
                        GREATEST(0, s.duration_minutes - EXTRACT(EPOCH FROM (s.paused_at - s.start_time))/60 + COALESCE(s.paused_duration_minutes, 0))
                    ELSE 
                        GREATEST(0, s.duration_minutes - EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - s.start_time))/60 + COALESCE(s.paused_duration_minutes, 0))
                END as remaining_minutes
            FROM tv_devices d
            LEFT JOIN tv_sessions s ON d.id = s.device_id AND s.status IN ('active', 'pending_payment')
            LEFT JOIN packages p ON s.package_id = p.id
            LEFT JOIN users u ON s.payment_confirmed_by = u.id
            LEFT JOIN users pu ON s.paused_by = pu.id
            LEFT JOIN users ru ON s.resumed_by = ru.id
            LEFT JOIN session_orders so ON s.id = so.session_id
            GROUP BY d.id, s.id, p.id, u.id, pu.id, ru.id
            ORDER BY d.device_name
        `);
        
        console.log(`Found ${devices.length} devices`);
        
        res.json({
            success: true,
            data: devices
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Add new TV device
router.post('/devices', auth, async (req, res) => {
    try {
        const { device_name, device_id, ip_address, location } = req.body;
        
        const [result] = await db.execute(
            'INSERT INTO tv_devices (device_name, device_id, ip_address, location) VALUES ($1, $2, $3, $4) RETURNING id',
            [device_name, device_id, ip_address, location]
        );
        
        res.json({
            success: true,
            message: 'TV device added successfully',
            data: { id: result[0].id }
        });
    } catch (error) {
        if (error.code === '23505') { // PostgreSQL unique constraint violation
            return res.status(400).json({
                success: false,
                message: 'Device ID already exists'
            });
        }
        
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Delete TV device
router.delete('/devices/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if device has active sessions
        const [activeSessions] = await db.execute(
            'SELECT COUNT(*) as count FROM tv_sessions WHERE device_id = $1 AND status = $2',
            [id, 'active']
        );
        
        if (activeSessions[0].count > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete device with active sessions. Please stop all sessions first.'
            });
        }
        
        // Get device info before deletion for logging
        const [deviceInfo] = await db.execute(
            'SELECT device_name, device_id FROM tv_devices WHERE id = $1',
            [id]
        );
        
        if (deviceInfo.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Device not found'
            });
        }
        
        // Delete the device (CASCADE will handle related records)
        const [, result] = await db.execute(
            'DELETE FROM tv_devices WHERE id = $1',
            [id]
        );
        
        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Device not found'
            });
        }
        
        console.log(`🗑️ Device deleted: ${deviceInfo[0].device_name} (${deviceInfo[0].device_id}) by ${req.user.username}`);
        
        // Emit real-time notification
        if (io) {
            io.emit('device_deleted', {
                device_id: deviceInfo[0].device_id,
                device_name: deviceInfo[0].device_name,
                deleted_by: req.user.full_name,
                timestamp: new Date().toISOString()
            });
        }
        
        res.json({
            success: true,
            message: `Device '${deviceInfo[0].device_name}' deleted successfully`
        });
    } catch (error) {
        console.error('Delete device error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Start billing session
router.post('/start-session', auth, async (req, res) => {
    try {
        const { device_id, customer_name, package_id, payment_type = 'pay_later' } = req.body;
        
        // Get device info for fallback customer name and device_id
        const [devices] = await db.execute(
            'SELECT device_name, device_id FROM tv_devices WHERE id = $1',
            [device_id]
        );
        
        if (devices.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Device not found'
            });
        }
        
        // Use device name as customer name if not provided or empty
        const finalCustomerName = customer_name && customer_name.trim() !== '' 
            ? customer_name 
            : devices[0].device_name;
        
        console.log('Using customer name:', finalCustomerName, '(original:', customer_name, ')');
        
        // Stop any existing active sessions for this device first
        console.log('Stopping any existing active sessions for device_id:', device_id);
        await db.execute(`
            UPDATE tv_sessions 
            SET status = $1, end_time = CURRENT_TIMESTAMP 
            WHERE device_id = $2 AND status = $3
        `, ['completed', device_id, 'active']);
        console.log('Existing active sessions stopped');
        
        // Get package details
        console.log('Getting package details for package_id:', package_id);
        const [packages] = await db.execute(
            'SELECT name, duration_minutes, price FROM packages WHERE id = $1',
            [package_id]
        );
        console.log('Package found:', packages.length > 0 ? packages[0] : 'none');
        
        if (packages.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Package not found'
            });
        }
        
        const package_info = packages[0];
        
        // Start session
        console.log('Starting session with data:', { device_id, customer_name: finalCustomerName, package_id, payment_type, duration: package_info.duration_minutes, price: package_info.price });
        const [result] = await db.execute(`
            INSERT INTO tv_sessions (device_id, customer_name, package_id, duration_minutes, amount_paid, payment_type, status) 
            VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
        `, [device_id, finalCustomerName, package_id, package_info.duration_minutes, package_info.price, payment_type, 'active']);
        console.log('Session created with ID:', result.length > 0 ? result[0].id : 'none');
        
        // Add transaction record
        await db.execute(`
            INSERT INTO transactions (transaction_type, reference_id, amount, payment_method, cashier_name) 
            VALUES ($1, $2, $3, $4, $5)
        `, ['tv_billing', result[0].id, package_info.price, 'cash', req.user.full_name]);
        
        // Record initial package in session_packages table
        await db.execute(`
            INSERT INTO session_packages (session_id, package_id, package_name, duration_minutes, price, package_type, added_by)
            VALUES ($1, $2, $3, $4, $5, 'initial', $6)
        `, [result[0].id, package_id, package_info.name, package_info.duration_minutes, package_info.price, req.user.id]);
        
        // Update device status
        await db.execute('UPDATE tv_devices SET status = $1 WHERE id = $2', ['online', device_id]);
        
        // Emit real-time update
        if (io) {
            io.emit('session_started', {
                device_id: devices[0].device_id, // Use string device_id, not database ID
                db_device_id: device_id, // Keep database ID for admin panel
                session_id: result[0].id,
                customer_name: finalCustomerName,
                package: package_info,
                timestamp: new Date().toISOString()
            });
            
            io.emit('tv_status_changed', {
                device_id: device_id,
                status: 'active',
                session_active: true
            });
        }
        
        res.json({
            success: true,
            message: 'Session started successfully',
            data: { session_id: result[0].id }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Stop billing session
router.post('/stop-session/:sessionId', auth, async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        // Get session info before stopping
        const [sessionInfo] = await db.execute(`
            SELECT s.*, d.device_name, d.device_id 
            FROM tv_sessions s
            JOIN tv_devices d ON s.device_id = d.id 
            WHERE s.id = $1 AND s.status = $2
        `, [sessionId, 'active']);
        
        await db.execute(`
            UPDATE tv_sessions 
            SET status = $1, end_time = CURRENT_TIMESTAMP 
            WHERE id = $2 AND status = $3
        `, ['completed', sessionId, 'active']);
        
        // Emit real-time update for session stopped
        if (io && sessionInfo.length > 0) {
            const session = sessionInfo[0];
            io.emit('session_ended', {
                device_id: session.device_id,
                session_id: sessionId,
                customer_name: session.customer_name,
                device_name: session.device_name,
                timestamp: new Date().toISOString()
            });
            
            io.emit('tv_status_changed', {
                device_id: session.device_id,
                status: 'available',
                session_active: false
            });
        }
        
        res.json({
            success: true,
            message: 'Session stopped successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Add time to session
router.post('/add-time/:sessionId', auth, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { additional_minutes, amount_paid, package_id } = req.body;
        
        // Get package info if package_id provided
        let packageInfo = null;
        if (package_id) {
            const [packageResult] = await db.execute(
                'SELECT name, duration_minutes, price FROM packages WHERE id = $1',
                [package_id]
            );
            packageInfo = packageResult[0];
        }
        
        await db.execute(`
            UPDATE tv_sessions 
            SET duration_minutes = duration_minutes + $1, 
                amount_paid = amount_paid + $2 
            WHERE id = $3 AND status = $4
        `, [additional_minutes, amount_paid, sessionId, 'active']);
        
        // Record the additional package in session_packages
        if (packageInfo) {
            await db.execute(`
                INSERT INTO session_packages (session_id, package_id, package_name, duration_minutes, price, package_type, added_by)
                VALUES ($1, $2, $3, $4, $5, 'additional', $6)
            `, [sessionId, package_id, packageInfo.name, packageInfo.duration_minutes, packageInfo.price, req.user.id]);
        } else {
            // If no package_id, find the package that matches the duration and price
            console.log('Looking for package: duration =', additional_minutes, 'minutes, price = Rp', amount_paid);
            const [matchingPackage] = await db.execute(`
                SELECT name FROM packages 
                WHERE duration_minutes = $1 AND price = $2 AND is_active = true
                LIMIT 1
            `, [additional_minutes, amount_paid]);
            
            let packageName;
            if (matchingPackage.length > 0) {
                // Use the package that matches duration and price
                packageName = matchingPackage[0].name;
                console.log('✅ Found exact match:', packageName);
            } else {
                // Fallback: try to find by duration only
                const [durationPackage] = await db.execute(`
                    SELECT name FROM packages 
                    WHERE duration_minutes = $1 AND is_active = true
                    ORDER BY price ASC
                    LIMIT 1
                `, [additional_minutes]);
                
                if (durationPackage.length > 0) {
                    packageName = durationPackage[0].name;
                    console.log('⚠️ Using duration-only match:', packageName);
                } else {
                    // Final fallback: use initial package name
                    const [sessionPackages] = await db.execute(`
                        SELECT package_name FROM session_packages 
                        WHERE session_id = $1 AND package_type = 'initial' 
                        LIMIT 1
                    `, [sessionId]);
                    packageName = sessionPackages.length > 0 ? sessionPackages[0].package_name : 'Test';
                }
            }
            
            await db.execute(`
                INSERT INTO session_packages (session_id, package_name, duration_minutes, price, package_type, added_by)
                VALUES ($1, $2, $3, $4, 'additional', $5)
            `, [sessionId, packageName, additional_minutes, amount_paid, req.user.id]);
        }
        
        // Add transaction record
        await db.execute(`
            INSERT INTO transactions (transaction_type, reference_id, amount, payment_method, cashier_name) 
            VALUES ($1, $2, $3, $4, $5)
        `, ['tv_billing', sessionId, amount_paid, 'cash', req.user.full_name]);
        
        // Get session and device info for WebSocket notification
        const [sessionInfo] = await db.execute(`
            SELECT s.*, d.device_name, d.device_id 
            FROM tv_sessions s
            JOIN tv_devices d ON s.device_id = d.id 
            WHERE s.id = $1
        `, [sessionId]);
        
        // Emit real-time notification
        if (io && sessionInfo.length > 0) {
            const session = sessionInfo[0];
            io.emit('time_added', {
                session_id: sessionId,
                device_id: session.device_id,
                device_name: session.device_name,
                customer_name: session.customer_name,
                additional_minutes: additional_minutes,
                amount_paid: amount_paid,
                new_duration: session.duration_minutes,
                timestamp: new Date().toISOString()
            });
        }
        
        res.json({
            success: true,
            message: 'Time added successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Stop active session for device
router.post('/stop-active-session/:deviceId', async (req, res) => {
    try {
        const { deviceId } = req.params;
        console.log('Stopping active session for device:', deviceId);
        
        const [result] = await db.execute(`
            UPDATE tv_sessions 
            SET status = $1, end_time = CURRENT_TIMESTAMP 
            WHERE device_id = (SELECT id FROM tv_devices WHERE device_id = $2) AND status = $3
        `, ['completed', deviceId, 'active']);
        
        res.json({
            success: true,
            message: 'Active session stopped successfully',
            rows_affected: result.rowCount || 0
        });
        
    } catch (error) {
        console.error('Stop active session error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get active session for device
router.get('/active-session/:deviceId', async (req, res) => {
    try {
        const { deviceId } = req.params;
        console.log('Getting active session for device:', deviceId);
        
        const [sessions] = await db.execute(`
            SELECT s.*, p.name, p.price,
                   s.duration_minutes as session_duration_minutes,
                   p.duration_minutes as package_duration_minutes,
                   EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - s.start_time))/60 as elapsed_minutes
            FROM tv_sessions s
            LEFT JOIN packages p ON s.package_id = p.id
            INNER JOIN tv_devices d ON s.device_id = d.id
            WHERE d.device_id = $1 AND s.status = $2
            AND EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - s.start_time))/60 < s.duration_minutes
            ORDER BY s.start_time DESC
            LIMIT 1
        `, [deviceId, 'active']);
        
        if (sessions.length > 0) {
            const session = sessions[0];
            // Use session's actual duration (which can be modified by time additions)
            const actualDuration = session.session_duration_minutes || session.duration_minutes;
            const remainingMinutes = Math.max(0, actualDuration - Math.floor(session.elapsed_minutes));
            
            res.json({
                success: true,
                data: {
                    session_id: session.id,
                    device_id: session.device_id,
                    customer_name: session.customer_name,
                    name: session.name,
                    duration_minutes: actualDuration, // Use actual session duration
                    remaining_minutes: remainingMinutes,
                    elapsed_minutes: Math.floor(session.elapsed_minutes),
                    amount: session.amount_paid,
                    status: session.status,
                    start_time: session.start_time
                }
            });
        } else {
            res.json({
                success: false,
                message: 'No active session found'
            });
        }
    } catch (error) {
        console.error('Get active session error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Device heartbeat endpoint
router.post('/heartbeat/:deviceId', async (req, res) => {
    try {
        const { deviceId } = req.params;
        
        // Debug: Log raw request body for JSON parse issues
        console.log(`💓 Heartbeat from ${deviceId}:`, {
            body: req.body,
            contentType: req.headers['content-type'],
            bodyKeys: Object.keys(req.body || {})
        });
        
        // Safely extract device info with defaults
        const device_name = req.body?.device_name || null;
        const device_location = req.body?.device_location || null;
        const ip_address = req.ip || req.connection.remoteAddress || 'unknown';
        
        // Check if device exists, if not auto-register it
        const [existingDevice] = await db.execute(`
            SELECT id, device_name, status FROM tv_devices WHERE device_id = $1
        `, [deviceId]);
        
        if (existingDevice.length === 0) {
            // Auto-register device with basic info
            const defaultName = device_name || `AndroidTV-${deviceId}`;
            const defaultLocation = device_location || null;
            
            await db.execute(`
                INSERT INTO tv_devices (device_id, device_name, device_location, ip_address, status, last_heartbeat)
                VALUES ($1, $2, $3, $4, 'online', CURRENT_TIMESTAMP)
            `, [deviceId, defaultName, defaultLocation, ip_address]);
            
            console.log(`🆕 Auto-registered device from heartbeat: ${defaultName} (${deviceId})`);
            
            // Emit WebSocket event for new device registration
            if (io) {
                io.emit('device_auto_registered', {
                    device_id: deviceId,
                    device_name: defaultName,
                    device_location: defaultLocation,
                    timestamp: new Date().toISOString()
                });
            }
        }
        
        // Update device last heartbeat and device info if provided
        if ((device_name && device_name.trim() !== '') || (device_location && device_location.trim() !== '')) {
            const updates = ['last_heartbeat = CURRENT_TIMESTAMP', 'status = \'online\''];
            const params = [deviceId];
            let paramIndex = 2;
            
            if (device_name && device_name.trim() !== '') {
                updates.push(`device_name = $${paramIndex}`);
                params.push(device_name.trim());
                paramIndex++;
            }
            
            if (device_location && device_location.trim() !== '') {
                updates.push(`device_location = $${paramIndex}`);
                params.push(device_location.trim());
                paramIndex++;
            }
            
            await db.execute(`
                UPDATE tv_devices 
                SET ${updates.join(', ')}
                WHERE device_id = $1
            `, params);
            
            console.log(`📱 Heartbeat: Device ${deviceId} updated - Name: ${device_name || 'unchanged'}, Location: ${device_location || 'unchanged'}`);
            
            // Notify admin panel of device update
            if (io) {
                io.emit('device_updated', {
                    device_id: deviceId,
                    device_name: device_name,
                    device_location: device_location,
                    timestamp: new Date().toISOString()
                });
            }
        } else {
            // Update heartbeat only (device info unchanged)
            await db.execute(`
                UPDATE tv_devices 
                SET last_heartbeat = CURRENT_TIMESTAMP, status = 'online'
                WHERE device_id = $1
            `, [deviceId]);
            
            // Emit status change event if device was offline
            if (existingDevice.length > 0 && existingDevice[0].status === 'offline' && io) {
                console.log(`📡 Emitting device_status_changed: ${existingDevice[0].device_name} → online`);
                io.emit('device_status_changed', {
                    device_id: deviceId,
                    device_name: existingDevice[0].device_name,
                    old_status: 'offline',
                    new_status: 'online',
                    reason: 'Heartbeat received',
                    timestamp: new Date().toISOString()
                });
            }
        }
        
        // Log heartbeat - get current device ID after updates
        const [currentDevice] = await db.execute(`
            SELECT id FROM tv_devices WHERE device_id = $1
        `, [deviceId]);
        
        if (currentDevice.length > 0) {
            await db.execute(`
                INSERT INTO device_heartbeats (device_id, ip_address) 
                VALUES ($1, $2)
            `, [currentDevice[0].id, ip_address]);
        }
        
        res.json({
            success: true,
            message: 'Heartbeat recorded',
            data: {
                success: true,
                message: 'Heartbeat recorded',
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Heartbeat error:', error);
        res.status(500).json({
            success: false,
            message: error.message,
            data: null
        });
    }
});

// Auto-pause sessions for devices without heartbeat
router.post('/check-offline-devices', async (req, res) => {
    try {
        // Find devices offline for more than 2 minutes
        const [offlineDevices] = await db.execute(`
            SELECT d.id, d.device_name, d.device_id, s.id as session_id, s.customer_name
            FROM tv_devices d
            JOIN tv_sessions s ON d.id = s.device_id
            WHERE s.status = 'active' 
            AND s.paused_at IS NULL
            AND (d.last_heartbeat IS NULL OR d.last_heartbeat < CURRENT_TIMESTAMP - INTERVAL '2 minutes')
        `);
        
        let pausedSessions = 0;
        
        for (const device of offlineDevices) {
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
            
            console.log(`Session paused for offline device: ${device.device_name} (${device.customer_name})`);
            pausedSessions++;
            
            // Emit WebSocket notification
            if (io) {
                io.emit('session_paused', {
                    device_id: device.device_id,
                    device_name: device.device_name,
                    customer_name: device.customer_name,
                    reason: 'Device offline - possible power failure',
                    timestamp: new Date().toISOString()
                });
            }
        }
        
        res.json({
            success: true,
            message: `Checked offline devices, paused ${pausedSessions} sessions`,
            paused_sessions: pausedSessions
        });
    } catch (error) {
        console.error('Check offline devices error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Resume paused session when device comes back online
router.post('/resume-session/:deviceId', async (req, res) => {
    try {
        const { deviceId } = req.params;
        
        // Find paused session for this device
        const [pausedSessions] = await db.execute(`
            SELECT s.*, d.device_name
            FROM tv_sessions s
            JOIN tv_devices d ON s.device_id = d.id
            WHERE d.device_id = $1 AND s.status = 'active' AND s.paused_at IS NOT NULL
        `, [deviceId]);
        
        if (pausedSessions.length > 0) {
            const session = pausedSessions[0];
            const pausedDuration = Math.floor((new Date() - new Date(session.paused_at)) / 60000); // minutes
            
            // Resume session and add paused time to total paused duration
            await db.execute(`
                UPDATE tv_sessions 
                SET paused_at = NULL, 
                    paused_duration_minutes = paused_duration_minutes + $1
                WHERE id = $2
            `, [pausedDuration, session.id]);
            
            console.log(`Session resumed for ${session.device_name}, paused for ${pausedDuration} minutes`);
            
            // Emit WebSocket notification
            if (io) {
                io.emit('session_resumed', {
                    device_id: deviceId,
                    device_name: session.device_name,
                    customer_name: session.customer_name,
                    paused_duration: pausedDuration,
                    timestamp: new Date().toISOString()
                });
            }
            
            res.json({
                success: true,
                message: `Session resumed, was paused for ${pausedDuration} minutes`,
                paused_duration: pausedDuration
            });
        } else {
            res.json({
                success: false,
                message: 'No paused session found for this device'
            });
        }
    } catch (error) {
        console.error('Resume session error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get discovered devices (pending approval)
router.get('/discoveries', auth, async (req, res) => {
    try {
        const [discoveries] = await db.execute(`
            SELECT d.*, 
                   CASE WHEN tv.id IS NOT NULL THEN true ELSE false END as is_registered
            FROM device_discoveries d
            LEFT JOIN tv_devices tv ON d.device_id = tv.device_id
            ORDER BY d.created_at DESC
        `);
        
        res.json({
            success: true,
            data: discoveries
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Approve device from discovery
router.post('/approve-device/:discoveryId', auth, async (req, res) => {
    try {
        const { discoveryId } = req.params;
        const { custom_name, location } = req.body;
        
        // Get discovery info
        const [discovery] = await db.execute(
            'SELECT * FROM device_discoveries WHERE id = $1',
            [discoveryId]
        );
        
        if (discovery.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Discovery not found'
            });
        }
        
        const device = discovery[0];
        const finalName = custom_name || device.device_name;
        
        // Check if already registered
        const [existing] = await db.execute(
            'SELECT id FROM tv_devices WHERE device_id = $1',
            [device.device_id]
        );
        
        if (existing.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Device already registered'
            });
        }
        
        // Register the device
        const [result] = await db.execute(`
            INSERT INTO tv_devices (device_id, device_name, ip_address, location, status)
            VALUES ($1, $2, $3, $4, 'offline') RETURNING id, created_at
        `, [device.device_id, finalName, device.ip_address, location || 'Not specified']);
        
        // Mark discovery as processed
        await db.execute(
            'UPDATE device_discoveries SET approved_at = CURRENT_TIMESTAMP, approved_by = $1 WHERE id = $2',
            [req.user.id, discoveryId]
        );
        
        // Send real-time notification
        if (io) {
            io.emit('device_approved', {
                device_id: device.device_id,
                device_name: finalName,
                approved_by: req.user.full_name,
                timestamp: new Date().toISOString()
            });
        }
        
        res.json({
            success: true,
            message: 'Device approved and registered successfully',
            data: {
                id: result[0].id,
                device_id: device.device_id,
                device_name: finalName,
                status: 'offline',
                created_at: result[0].created_at
            }
        });
        
    } catch (error) {
        console.error('Device approval error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Reject device discovery
router.post('/reject-device/:discoveryId', auth, async (req, res) => {
    try {
        const { discoveryId } = req.params;
        const { reason } = req.body;
        
        await db.execute(
            'UPDATE device_discoveries SET rejected_at = CURRENT_TIMESTAMP, rejected_by = $1, rejection_reason = $2 WHERE id = $3',
            [req.user.id, reason || 'No reason provided', discoveryId]
        );
        
        res.json({
            success: true,
            message: 'Device discovery rejected'
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Auto-cleanup old discoveries (devices not seen for specified time)
router.post('/cleanup-discoveries', auth, async (req, res) => {
    try {
        const { cleanup_type = 'auto', hours_threshold = 24 } = req.body;
        
        let whereClause = '';
        let cleanupCount = 0;
        
        if (cleanup_type === 'auto') {
            // Remove discoveries not seen for X hours and not approved/rejected
            whereClause = `
                WHERE last_seen < CURRENT_TIMESTAMP - INTERVAL '${hours_threshold} hours'
                AND approved_at IS NULL 
                AND rejected_at IS NULL
                AND NOT EXISTS (
                    SELECT 1 FROM tv_devices td WHERE td.device_id = device_discoveries.device_id
                )
            `;
        } else if (cleanup_type === 'rejected') {
            // Remove rejected discoveries older than 7 days
            whereClause = `
                WHERE rejected_at IS NOT NULL 
                AND rejected_at < CURRENT_TIMESTAMP - INTERVAL '7 days'
            `;
        } else if (cleanup_type === 'approved') {
            // Remove approved discoveries that are already registered (older than 1 day)
            whereClause = `
                WHERE approved_at IS NOT NULL 
                AND approved_at < CURRENT_TIMESTAMP - INTERVAL '1 day'
                AND EXISTS (
                    SELECT 1 FROM tv_devices td WHERE td.device_id = device_discoveries.device_id
                )
            `;
        }
        
        // Count what will be deleted
        const [countResult] = await db.execute(`
            SELECT COUNT(*) as count FROM device_discoveries ${whereClause}
        `);
        cleanupCount = countResult[0].count;
        
        // Delete the records
        const [result] = await db.execute(`
            DELETE FROM device_discoveries ${whereClause}
        `);
        
        console.log(`Cleaned up ${cleanupCount} device discoveries (${cleanup_type})`);
        
        res.json({
            success: true,
            message: `Cleaned up ${cleanupCount} device discoveries`,
            cleanup_type: cleanup_type,
            records_removed: cleanupCount
        });
        
    } catch (error) {
        console.error('Cleanup discoveries error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get cleanup statistics
router.get('/cleanup-stats', auth, async (req, res) => {
    try {
        const [stats] = await db.execute(`
            SELECT 
                COUNT(*) as total_discoveries,
                COUNT(CASE WHEN approved_at IS NULL AND rejected_at IS NULL THEN 1 END) as pending,
                COUNT(CASE WHEN approved_at IS NOT NULL THEN 1 END) as approved,
                COUNT(CASE WHEN rejected_at IS NOT NULL THEN 1 END) as rejected,
                COUNT(CASE WHEN last_seen < CURRENT_TIMESTAMP - INTERVAL '24 hours' 
                           AND approved_at IS NULL AND rejected_at IS NULL THEN 1 END) as stale_pending,
                COUNT(CASE WHEN rejected_at IS NOT NULL 
                           AND rejected_at < CURRENT_TIMESTAMP - INTERVAL '7 days' THEN 1 END) as old_rejected,
                COUNT(CASE WHEN approved_at IS NOT NULL 
                           AND approved_at < CURRENT_TIMESTAMP - INTERVAL '1 day'
                           AND EXISTS (SELECT 1 FROM tv_devices td WHERE td.device_id = device_discoveries.device_id) 
                           THEN 1 END) as old_approved_registered
            FROM device_discoveries
        `);
        
        res.json({
            success: true,
            data: stats[0]
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Schedule automatic cleanup (can be called by cron job)
router.post('/schedule-cleanup', async (req, res) => {
    try {
        // Auto cleanup stale pending discoveries (24+ hours old)
        const [stalePending] = await db.execute(`
            DELETE FROM device_discoveries 
            WHERE last_seen < CURRENT_TIMESTAMP - INTERVAL '24 hours'
            AND approved_at IS NULL 
            AND rejected_at IS NULL
            AND NOT EXISTS (
                SELECT 1 FROM tv_devices td WHERE td.device_id = device_discoveries.device_id
            )
        `);
        
        // Auto cleanup old rejected discoveries (7+ days old)
        const [oldRejected] = await db.execute(`
            DELETE FROM device_discoveries 
            WHERE rejected_at IS NOT NULL 
            AND rejected_at < CURRENT_TIMESTAMP - INTERVAL '7 days'
        `);
        
        // Auto cleanup old approved discoveries that are registered (1+ day old)
        const [oldApproved] = await db.execute(`
            DELETE FROM device_discoveries 
            WHERE approved_at IS NOT NULL 
            AND approved_at < CURRENT_TIMESTAMP - INTERVAL '1 day'
            AND EXISTS (
                SELECT 1 FROM tv_devices td WHERE td.device_id = device_discoveries.device_id
            )
        `);
        
        const totalCleaned = (stalePending.rowCount || 0) + (oldRejected.rowCount || 0) + (oldApproved.rowCount || 0);
        
        console.log(`Scheduled cleanup completed: ${totalCleaned} records removed`);
        
        res.json({
            success: true,
            message: `Scheduled cleanup completed`,
            stale_pending_removed: stalePending.rowCount || 0,
            old_rejected_removed: oldRejected.rowCount || 0,
            old_approved_removed: oldApproved.rowCount || 0,
            total_removed: totalCleaned
        });
        
    } catch (error) {
        console.error('Scheduled cleanup error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Auto-cleanup disconnected devices after scan timeout
router.post('/cleanup-disconnected', async (req, res) => {
    try {
        const { timeout_minutes = 5 } = req.body;
        
        // Remove pending discoveries that haven't been seen recently and no heartbeat
        const [cleanupResult] = await db.execute(`
            DELETE FROM device_discoveries 
            WHERE last_seen < CURRENT_TIMESTAMP - INTERVAL '${timeout_minutes} minutes'
            AND approved_at IS NULL 
            AND rejected_at IS NULL
            AND NOT EXISTS (
                SELECT 1 FROM tv_devices td WHERE td.device_id = device_discoveries.device_id
            )
        `);
        
        const cleanedCount = cleanupResult.rowCount || 0;
        
        console.log(`Auto-cleanup: Removed ${cleanedCount} disconnected devices after ${timeout_minutes} minutes timeout`);
        
        // Emit real-time update to refresh UI
        if (io) {
            io.emit('discoveries_cleaned', {
                cleaned_count: cleanedCount,
                timeout_minutes: timeout_minutes,
                timestamp: new Date().toISOString()
            });
        }
        
        res.json({
            success: true,
            message: `Cleaned up ${cleanedCount} disconnected devices`,
            cleaned_count: cleanedCount,
            timeout_minutes: timeout_minutes
        });
        
    } catch (error) {
        console.error('Cleanup disconnected devices error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Auto-scan cleanup - removes stale discoveries and prevents duplicates
router.post('/scan-cleanup', async (req, res) => {
    try {
        const { aggressive = false } = req.body;
        let totalCleaned = 0;
        
        if (aggressive) {
            // Aggressive mode: Remove all pending discoveries older than 2 minutes
            const [aggressiveCleanup] = await db.execute(`
                DELETE FROM device_discoveries 
                WHERE last_seen < CURRENT_TIMESTAMP - INTERVAL '2 minutes'
                AND approved_at IS NULL 
                AND rejected_at IS NULL
                AND NOT EXISTS (
                    SELECT 1 FROM tv_devices td WHERE td.device_id = device_discoveries.device_id
                )
            `);
            totalCleaned = aggressiveCleanup.rowCount || 0;
            console.log(`Aggressive scan cleanup: ${totalCleaned} stale discoveries removed`);
        } else {
            // Standard mode: Remove discoveries older than 10 minutes
            const [standardCleanup] = await db.execute(`
                DELETE FROM device_discoveries 
                WHERE last_seen < CURRENT_TIMESTAMP - INTERVAL '10 minutes'
                AND approved_at IS NULL 
                AND rejected_at IS NULL
                AND NOT EXISTS (
                    SELECT 1 FROM tv_devices td WHERE td.device_id = device_discoveries.device_id
                )
            `);
            totalCleaned = standardCleanup.rowCount || 0;
            console.log(`Standard scan cleanup: ${totalCleaned} stale discoveries removed`);
        }
        
        // Also remove duplicate pending discoveries (keep only the latest)
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
        totalCleaned += duplicatesRemoved;
        
        console.log(`Duplicate cleanup: ${duplicatesRemoved} duplicate discoveries removed`);
        
        // Emit real-time update
        if (io) {
            io.emit('scan_cleanup_completed', {
                total_cleaned: totalCleaned,
                duplicates_removed: duplicatesRemoved,
                aggressive_mode: aggressive,
                timestamp: new Date().toISOString()
            });
        }
        
        res.json({
            success: true,
            message: `Scan cleanup completed: ${totalCleaned} records removed`,
            total_cleaned: totalCleaned,
            duplicates_removed: duplicatesRemoved,
            aggressive_mode: aggressive
        });
        
    } catch (error) {
        console.error('Scan cleanup error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// QR Code for device setup
router.get('/setup-qr/:deviceId', async (req, res) => {
    try {
        const { deviceId } = req.params;
        
        // Generate setup info
        const setupInfo = {
            device_id: deviceId,
            server_url: process.env.SERVER_URL || 'http://localhost:3000',
            setup_time: new Date().toISOString(),
            qr_type: 'tv_setup'
        };
        
        res.json({
            success: true,
            qr_data: JSON.stringify(setupInfo),
            setup_info: setupInfo
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get billing packages
router.get('/packages', async (req, res) => {
    try {
        const [packages] = await db.execute(
            'SELECT * FROM packages WHERE is_active = TRUE ORDER BY duration_minutes'
        );
        
        res.json({
            success: true,
            data: packages
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Cleanup service endpoints
const CleanupService = require('../services/cleanupService');
let cleanupServiceInstance = null;

// Initialize cleanup service with socket
router.initCleanupService = (io) => {
    if (!cleanupServiceInstance) {
        cleanupServiceInstance = new CleanupService(io);
    } else {
        cleanupServiceInstance.setSocketIO(io);
    }
    return cleanupServiceInstance;
};

// Get cleanup service status
router.get('/cleanup-service/status', (req, res) => {
    if (!cleanupServiceInstance) {
        return res.json({
            success: true,
            data: { is_running: false, message: 'Service not initialized' }
        });
    }
    
    res.json({
        success: true,
        data: cleanupServiceInstance.getStatus()
    });
});

// Manual trigger cleanup service
router.post('/cleanup-service/trigger', auth, async (req, res) => {
    try {
        if (!cleanupServiceInstance) {
            return res.status(400).json({
                success: false,
                message: 'Cleanup service not initialized'
            });
        }
        
        const result = await cleanupServiceInstance.performCleanup();
        
        res.json({
            success: result.success,
            message: result.success ? 
                `Manual cleanup completed: ${result.total_cleaned} records removed` : 
                'Cleanup failed',
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Aggressive cleanup for disconnected devices
router.post('/cleanup-service/aggressive', auth, async (req, res) => {
    try {
        const { timeout_minutes = 2 } = req.body;
        
        if (!cleanupServiceInstance) {
            return res.status(400).json({
                success: false,
                message: 'Cleanup service not initialized'
            });
        }
        
        const result = await cleanupServiceInstance.cleanupDisconnected(timeout_minutes);
        
        res.json({
            success: result.success,
            message: result.success ? 
                `Aggressive cleanup completed: ${result.cleaned_count} devices removed` : 
                'Cleanup failed',
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Test endpoint to manually trigger heartbeat monitor
router.post('/test-heartbeat-monitor', async (req, res) => {
    try {
        // Find ALL devices that are offline (no heartbeat) and update their status
        const [allOfflineDevices] = await db.execute(`
            SELECT id, device_name, device_id, status, last_heartbeat
            FROM tv_devices 
            WHERE (last_heartbeat IS NULL OR last_heartbeat < CURRENT_TIMESTAMP - INTERVAL '2 minutes')
            AND status != 'offline'
        `);
        
        let statusUpdated = 0;
        
        for (const device of allOfflineDevices) {
            await db.execute(`
                UPDATE tv_devices 
                SET status = 'offline'
                WHERE id = $1
            `, [device.id]);
            
            console.log(`📶 Device status updated to offline: ${device.device_name} (${device.device_id})`);
            statusUpdated++;
            
            // Emit WebSocket notification for status change
            if (io) {
                io.emit('device_status_changed', {
                    device_id: device.device_id,
                    device_name: device.device_name,
                    old_status: device.status,
                    new_status: 'offline',
                    reason: 'No heartbeat received',
                    timestamp: new Date().toISOString()
                });
            }
        }
        
        res.json({
            success: true,
            message: `Heartbeat monitor test completed: ${statusUpdated} devices updated to offline`,
            devices_updated: statusUpdated,
            offline_devices: allOfflineDevices
        });
        
    } catch (error) {
        console.error('❌ Test heartbeat monitor error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Confirm payment for session
router.post('/confirm-payment/:sessionId', auth, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { payment_notes } = req.body;
        
        // Get session info before confirming
        const [sessionInfo] = await db.execute(`
            SELECT s.*, d.device_name, d.device_id 
            FROM tv_sessions s
            JOIN tv_devices d ON s.device_id = d.id 
            WHERE s.id = $1 AND s.status = $2
        `, [sessionId, 'pending_payment']);
        
        if (sessionInfo.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Session not found or not pending payment'
            });
        }
        
        // Confirm payment
        const [, result] = await db.execute(`
            UPDATE tv_sessions 
            SET status = 'completed',
                payment_confirmed_at = CURRENT_TIMESTAMP,
                payment_confirmed_by = $1,
                payment_notes = $2
            WHERE id = $3 AND status = 'pending_payment'
        `, [req.user.id, payment_notes || null, sessionId]);
        
        if (result.rowCount > 0) {
            const session = sessionInfo[0];
            
            // Emit real-time notification
            if (io) {
                io.emit('payment_confirmed', {
                    session_id: sessionId,
                    device_id: session.device_id,
                    device_name: session.device_name,
                    customer_name: session.customer_name,
                    amount_paid: session.amount_paid,
                    confirmed_by: req.user.full_name,
                    payment_notes: payment_notes,
                    timestamp: new Date().toISOString()
                });
            }
            
            console.log(`💰 Payment confirmed for session ${sessionId} by ${req.user.full_name}`);
            
            res.json({
                success: true,
                message: 'Payment confirmed successfully'
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Failed to confirm payment'
            });
        }
    } catch (error) {
        console.error('Confirm payment error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Create F&B order for TV session
router.post('/session-order/:sessionId', auth, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { order_items, order_notes } = req.body;
        
        // Validate order items
        if (!order_items || !Array.isArray(order_items) || order_items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Order items are required'
            });
        }
        
        // Get session info
        const [sessionInfo] = await db.execute(`
            SELECT s.*, d.id as device_table_id, d.device_id, d.device_name 
            FROM tv_sessions s
            JOIN tv_devices d ON s.device_id = d.id 
            WHERE s.id = $1 AND s.status IN ('active', 'pending_payment')
        `, [sessionId]);
        
        if (sessionInfo.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Active session not found'
            });
        }
        
        const session = sessionInfo[0];
        
        // Calculate total amount
        let totalAmount = 0;
        const validatedItems = [];
        
        for (const item of order_items) {
            // Validate each item exists and has stock
            const [productInfo] = await db.execute(
                'SELECT id, product_name, price, stock_quantity FROM products WHERE id = $1 AND is_available = true',
                [item.product_id]
            );
            
            if (productInfo.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: `Product ${item.product_id} not found or unavailable`
                });
            }
            
            const product = productInfo[0];
            
            if (product.stock_quantity < item.quantity) {
                return res.status(400).json({
                    success: false,
                    message: `Insufficient stock for ${product.product_name}. Available: ${product.stock_quantity}`
                });
            }
            
            const subtotal = product.price * item.quantity;
            totalAmount += subtotal;
            
            validatedItems.push({
                product_id: product.id,
                product_name: product.product_name,
                price: product.price,
                quantity: item.quantity,
                subtotal: subtotal
            });
        }
        
        // Create session order
        const [orderResult] = await db.execute(`
            INSERT INTO session_orders (session_id, device_id, customer_name, order_items, total_amount, order_notes, ordered_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7) 
            RETURNING id, created_at
        `, [
            sessionId, 
            session.device_table_id, 
            session.customer_name, 
            JSON.stringify(validatedItems), 
            totalAmount, 
            order_notes || null, 
            req.user.id
        ]);
        
        // Update product stock
        for (const item of validatedItems) {
            await db.execute(
                'UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2',
                [item.quantity, item.product_id]
            );
        }
        
        const orderId = orderResult[0].id;
        
        // Emit real-time notification
        if (io) {
            io.emit('session_order_created', {
                order_id: orderId,
                session_id: sessionId,
                device_id: session.device_id,
                device_name: session.device_name,
                customer_name: session.customer_name,
                order_items: validatedItems,
                total_amount: totalAmount,
                ordered_by: req.user.full_name,
                timestamp: new Date().toISOString()
            });
        }
        
        console.log(`🍽️ F&B Order created for session ${sessionId} by ${req.user.full_name}: Rp${totalAmount.toLocaleString()}`);
        
        res.json({
            success: true,
            message: 'Order created successfully',
            data: {
                order_id: orderId,
                total_amount: totalAmount,
                items: validatedItems
            }
        });
        
    } catch (error) {
        console.error('Create session order error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get F&B orders for session
router.get('/session-orders/:sessionId', auth, async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        const [orders] = await db.execute(`
            SELECT so.*, u.full_name as ordered_by_name
            FROM session_orders so
            LEFT JOIN users u ON so.ordered_by = u.id
            WHERE so.session_id = $1
            ORDER BY so.created_at DESC
        `, [sessionId]);
        
        res.json({
            success: true,
            data: orders
        });
        
    } catch (error) {
        console.error('Get session orders error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get products for ordering
router.get('/products-for-order', auth, async (req, res) => {
    try {
        const [products] = await db.execute(`
            SELECT p.id, p.product_name, p.price, p.stock_quantity, p.image_url,
                   pc.category_name
            FROM products p
            LEFT JOIN product_categories pc ON p.category_id = pc.id
            WHERE p.is_available = true AND p.stock_quantity > 0
            ORDER BY pc.category_name, p.product_name
        `);
        
        res.json({
            success: true,
            data: products
        });
        
    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Pause session manually
router.post('/pause-session/:sessionId', auth, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { pause_reason = 'other', pause_notes } = req.body;
        
        // Get session info
        const [sessionInfo] = await db.execute(`
            SELECT s.*, d.device_name, d.device_id 
            FROM tv_sessions s
            JOIN tv_devices d ON s.device_id = d.id 
            WHERE s.id = $1 AND s.status = 'active' AND s.paused_at IS NULL
        `, [sessionId]);
        
        if (sessionInfo.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Active session not found or already paused'
            });
        }
        
        const session = sessionInfo[0];
        
        // Pause the session
        const [, result] = await db.execute(`
            UPDATE tv_sessions 
            SET paused_at = CURRENT_TIMESTAMP,
                pause_reason = $1,
                pause_notes = $2,
                paused_by = $3,
                is_manually_paused = true
            WHERE id = $4 AND status = 'active'
        `, [pause_reason, pause_notes || null, req.user.id, sessionId]);
        
        if (result.rowCount > 0) {
            // Emit real-time notification
            if (io) {
                io.emit('session_paused', {
                    session_id: sessionId,
                    device_id: session.device_id,
                    device_name: session.device_name,
                    customer_name: session.customer_name,
                    pause_reason: pause_reason,
                    pause_notes: pause_notes,
                    paused_by: req.user.full_name,
                    timestamp: new Date().toISOString()
                });
            }
            
            console.log(`⏸️ Session ${sessionId} paused by ${req.user.full_name} - Reason: ${pause_reason}`);
            
            res.json({
                success: true,
                message: 'Session paused successfully'
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Failed to pause session'
            });
        }
    } catch (error) {
        console.error('Pause session error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Resume session manually
router.post('/resume-session/:sessionId', auth, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { resume_notes } = req.body;
        
        // Get paused session info
        const [sessionInfo] = await db.execute(`
            SELECT s.*, d.device_name, d.device_id 
            FROM tv_sessions s
            JOIN tv_devices d ON s.device_id = d.id 
            WHERE s.id = $1 AND s.status = 'active' AND s.paused_at IS NOT NULL
        `, [sessionId]);
        
        if (sessionInfo.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Paused session not found'
            });
        }
        
        const session = sessionInfo[0];
        
        // Calculate pause duration
        const pausedDuration = Math.floor((new Date() - new Date(session.paused_at)) / 60000);
        
        // Resume the session
        const [, result] = await db.execute(`
            UPDATE tv_sessions 
            SET paused_at = NULL,
                paused_duration_minutes = paused_duration_minutes + $1,
                resumed_by = $2,
                is_manually_paused = false
            WHERE id = $3 AND status = 'active'
        `, [pausedDuration, req.user.id, sessionId]);
        
        if (result.rowCount > 0) {
            // Emit real-time notification
            if (io) {
                io.emit('session_resumed', {
                    session_id: sessionId,
                    device_id: session.device_id,
                    device_name: session.device_name,
                    customer_name: session.customer_name,
                    pause_duration: pausedDuration,
                    resumed_by: req.user.full_name,
                    resume_notes: resume_notes,
                    timestamp: new Date().toISOString()
                });
            }
            
            console.log(`▶️ Session ${sessionId} resumed by ${req.user.full_name} - Paused for ${pausedDuration} minutes`);
            
            res.json({
                success: true,
                message: `Session resumed successfully (was paused for ${pausedDuration} minutes)`,
                pause_duration: pausedDuration
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Failed to resume session'
            });
        }
    } catch (error) {
        console.error('Resume session error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get expired sessions for admin notifications
router.get('/expired-sessions', auth, async (req, res) => {
    try {
        const SessionExpiredService = require('../services/sessionExpiredService');
        const expiredService = new SessionExpiredService();
        
        const expiredSessions = await expiredService.getExpiredSessions();
        
        res.json({
            success: true,
            expired_sessions: expiredSessions
        });
    } catch (error) {
        console.error('Error fetching expired sessions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch expired sessions'
        });
    }
});

module.exports = router;
