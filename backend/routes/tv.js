const express = require('express');
const router = express.Router();
const db = require('../config/database');
const auth = require('../middleware/auth');

// Get all TV devices
router.get('/devices', auth, async (req, res) => {
    try {
        const [devices] = await db.execute(`
            SELECT d.*, 
                   s.id as session_id,
                   s.customer_name,
                   s.start_time,
                   s.duration_minutes,
                   CASE 
                       WHEN s.status = 'active' THEN 
                           GREATEST(0, s.duration_minutes - TIMESTAMPDIFF(MINUTE, s.start_time, NOW()))
                       ELSE 0 
                   END as remaining_minutes
            FROM tv_devices d
            LEFT JOIN tv_sessions s ON d.id = s.device_id AND s.status = 'active'
            ORDER BY d.device_name
        `);
        
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
            'INSERT INTO tv_devices (device_name, device_id, ip_address, location) VALUES (?, ?, ?, ?)',
            [device_name, device_id, ip_address, location]
        );
        
        res.json({
            success: true,
            message: 'TV device added successfully',
            data: { id: result.insertId }
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
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

// Start billing session
router.post('/start-session', auth, async (req, res) => {
    try {
        const { device_id, customer_name, package_id } = req.body;
        
        // Check if device has active session
        const [existingSessions] = await db.execute(
            'SELECT id FROM tv_sessions WHERE device_id = ? AND status = "active"',
            [device_id]
        );
        
        if (existingSessions.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Device already has active session'
            });
        }
        
        // Get package details
        const [packages] = await db.execute(
            'SELECT duration_minutes, price FROM billing_packages WHERE id = ?',
            [package_id]
        );
        
        if (packages.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Package not found'
            });
        }
        
        const package_info = packages[0];
        
        // Start session
        const [result] = await db.execute(`
            INSERT INTO tv_sessions (device_id, customer_name, package_id, duration_minutes, amount_paid, status) 
            VALUES (?, ?, ?, ?, ?, 'active')
        `, [device_id, customer_name, package_id, package_info.duration_minutes, package_info.price]);
        
        // Add transaction record
        await db.execute(`
            INSERT INTO transactions (transaction_type, reference_id, amount, payment_method, cashier_name) 
            VALUES ('tv_billing', ?, ?, 'cash', ?)
        `, [result.insertId, package_info.price, req.user.full_name]);
        
        // Update device status
        await db.execute('UPDATE tv_devices SET status = "online" WHERE id = ?', [device_id]);
        
        res.json({
            success: true,
            message: 'Session started successfully',
            data: { session_id: result.insertId }
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
        
        await db.execute(`
            UPDATE tv_sessions 
            SET status = 'completed', end_time = NOW() 
            WHERE id = ? AND status = 'active'
        `, [sessionId]);
        
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
        const { additional_minutes, amount_paid } = req.body;
        
        await db.execute(`
            UPDATE tv_sessions 
            SET duration_minutes = duration_minutes + ?, 
                amount_paid = amount_paid + ? 
            WHERE id = ? AND status = 'active'
        `, [additional_minutes, amount_paid, sessionId]);
        
        // Add transaction record
        await db.execute(`
            INSERT INTO transactions (transaction_type, reference_id, amount, payment_method, cashier_name) 
            VALUES ('tv_billing', ?, ?, 'cash', ?)
        `, [sessionId, amount_paid, req.user.full_name]);
        
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

// Get billing packages
router.get('/packages', async (req, res) => {
    try {
        const [packages] = await db.execute(
            'SELECT * FROM billing_packages WHERE is_active = TRUE ORDER BY duration_minutes'
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

module.exports = router;