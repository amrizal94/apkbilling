const express = require('express');
const router = express.Router();
const db = require('../config/database');
const auth = require('../middleware/auth');

// Dashboard summary
router.get('/dashboard', auth, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        // TV Sessions summary
        const [tvStats] = await db.execute(`
            SELECT 
                COUNT(*) as total_sessions,
                COUNT(CASE WHEN status = 'active' THEN 1 END) as active_sessions,
                SUM(amount_paid) as total_revenue
            FROM tv_sessions 
            WHERE DATE(created_at) = $1
        `, [today]);
        
        // POS Orders summary
        const [posStats] = await db.execute(`
            SELECT 
                COUNT(*) as total_orders,
                COUNT(CASE WHEN status IN ('pending', 'preparing') THEN 1 END) as pending_orders,
                SUM(total_amount) as total_revenue
            FROM orders 
            WHERE DATE(created_at) = $1
        `, [today]);
        
        // TV Devices status
        const [deviceStats] = await db.execute(`
            SELECT 
                COUNT(*) as total_devices,
                COUNT(CASE WHEN status = 'online' THEN 1 END) as online_devices,
                COUNT(CASE WHEN status = 'offline' THEN 1 END) as offline_devices
            FROM tv_devices
        `);
        
        // Low stock products
        const lowStockThreshold = parseInt(process.env.LOW_STOCK_THRESHOLD) || 10;
        const [lowStockProducts] = await db.execute(`
            SELECT product_name, stock_quantity 
            FROM products 
            WHERE stock_quantity <= $1 AND is_available = TRUE
            ORDER BY stock_quantity ASC
            LIMIT 10
        `, [lowStockThreshold]);
        
        res.json({
            success: true,
            data: {
                tv_billing: {
                    total_sessions: parseInt(tvStats[0].total_sessions) || 0,
                    active_sessions: parseInt(tvStats[0].active_sessions) || 0,
                    revenue: parseFloat(tvStats[0].total_revenue) || 0
                },
                pos_system: {
                    total_orders: parseInt(posStats[0].total_orders) || 0,
                    pending_orders: parseInt(posStats[0].pending_orders) || 0,
                    revenue: parseFloat(posStats[0].total_revenue) || 0
                },
                devices: {
                    total: parseInt(deviceStats[0].total_devices) || 0,
                    online: parseInt(deviceStats[0].online_devices) || 0,
                    offline: parseInt(deviceStats[0].offline_devices) || 0
                },
                alerts: {
                    low_stock_products: lowStockProducts
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

// TV Billing report
router.get('/tv-billing', auth, async (req, res) => {
    try {
        const { start_date, end_date, device_id } = req.query;
        
        let query = `
            SELECT 
                tv.id,
                tv.customer_name,
                tv.start_time,
                tv.end_time,
                tv.duration_minutes,
                tv.amount_paid,
                tv.status,
                d.device_name,
                bp.package_name
            FROM tv_sessions tv
            JOIN tv_devices d ON tv.device_id = d.id
            LEFT JOIN billing_packages bp ON tv.package_id = bp.id
            WHERE 1=1
        `;
        const params = [];
        
        if (start_date) {
            query += ' AND DATE(tv.start_time) >= $' + (params.length + 1);
            params.push(start_date);
        }
        
        if (end_date) {
            query += ' AND DATE(tv.start_time) <= $' + (params.length + 1);
            params.push(end_date);
        }
        
        if (device_id) {
            query += ' AND tv.device_id = $' + (params.length + 1);
            params.push(device_id);
        }
        
        query += ' ORDER BY tv.start_time DESC';
        
        const [sessions] = await db.execute(query, params);
        
        // Summary statistics
        const totalRevenue = sessions.reduce((sum, session) => sum + parseFloat(session.amount_paid || 0), 0);
        const totalSessions = sessions.length;
        const activeSessions = sessions.filter(s => s.status === 'active').length;
        
        res.json({
            success: true,
            data: {
                sessions,
                summary: {
                    total_sessions: totalSessions,
                    active_sessions: activeSessions,
                    total_revenue: totalRevenue,
                    average_session_value: totalSessions > 0 ? totalRevenue / totalSessions : 0
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

// POS Sales report
router.get('/pos-sales', auth, async (req, res) => {
    try {
        const { start_date, end_date, category_id } = req.query;
        
        let query = `
            SELECT 
                o.id,
                o.order_number,
                o.customer_name,
                o.table_number,
                o.total_amount,
                o.status,
                o.order_type,
                o.created_at,
                COUNT(oi.id) as item_count,
                STRING_AGG(p.product_name || ' x' || oi.quantity, ', ') as items_detail
            FROM orders o
            LEFT JOIN order_items oi ON o.id = oi.order_id
            LEFT JOIN products p ON oi.product_id = p.id
            WHERE 1=1
        `;
        const params = [];
        
        if (start_date) {
            query += ' AND DATE(o.created_at) >= $' + (params.length + 1);
            params.push(start_date);
        }
        
        if (end_date) {
            query += ' AND DATE(o.created_at) <= $' + (params.length + 1);
            params.push(end_date);
        }
        
        if (category_id) {
            query += ' AND p.category_id = $' + (params.length + 1);
            params.push(category_id);
        }
        
        query += `
            GROUP BY o.id, o.order_number, o.customer_name, o.table_number, 
                     o.total_amount, o.status, o.order_type, o.created_at
            ORDER BY o.created_at DESC
        `;
        
        const [orders] = await db.execute(query, params);
        
        // Summary statistics
        const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.total_amount || 0), 0);
        const totalOrders = orders.length;
        const completedOrders = orders.filter(o => o.status === 'completed').length;
        
        res.json({
            success: true,
            data: {
                orders,
                summary: {
                    total_orders: totalOrders,
                    completed_orders: completedOrders,
                    total_revenue: totalRevenue,
                    average_order_value: totalOrders > 0 ? totalRevenue / totalOrders : 0
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

// Product performance report
router.get('/product-performance', auth, async (req, res) => {
    try {
        const { start_date, end_date, limit = 20 } = req.query;
        
        let query = `
            SELECT 
                p.id,
                p.product_name,
                pc.category_name,
                p.price,
                p.stock_quantity,
                COALESCE(SUM(oi.quantity), 0) as total_sold,
                COALESCE(SUM(oi.total_price), 0) as total_revenue,
                COUNT(DISTINCT oi.order_id) as order_count
            FROM products p
            LEFT JOIN product_categories pc ON p.category_id = pc.id
            LEFT JOIN order_items oi ON p.id = oi.product_id
            LEFT JOIN orders o ON oi.order_id = o.id
        `;
        const params = [];
        
        if (start_date || end_date) {
            query += ' WHERE ';
            if (start_date) {
                query += 'DATE(o.created_at) >= $' + (params.length + 1);
                params.push(start_date);
                if (end_date) query += ' AND ';
            }
            if (end_date) {
                query += 'DATE(o.created_at) <= $' + (params.length + 1);
                params.push(end_date);
            }
        }
        
        query += `
            GROUP BY p.id, p.product_name, pc.category_name, p.price, p.stock_quantity
            ORDER BY total_sold DESC, total_revenue DESC
            LIMIT $${params.length + 1}
        `;
        params.push(parseInt(limit));
        
        const [products] = await db.execute(query, params);
        
        res.json({
            success: true,
            data: products
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Financial summary
router.get('/financial-summary', auth, async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        
        // Get all transactions
        let query = `
            SELECT 
                transaction_type,
                SUM(amount) as total_amount,
                COUNT(*) as transaction_count,
                payment_method
            FROM transactions
            WHERE 1=1
        `;
        const params = [];
        
        if (start_date) {
            query += ' AND DATE(transaction_date) >= $' + (params.length + 1);
            params.push(start_date);
        }
        
        if (end_date) {
            query += ' AND DATE(transaction_date) <= $' + (params.length + 1);
            params.push(end_date);
        }
        
        query += ' GROUP BY transaction_type, payment_method ORDER BY transaction_type, payment_method';
        
        const [transactions] = await db.execute(query, params);
        
        // Calculate totals
        const tvBillingRevenue = transactions
            .filter(t => t.transaction_type === 'tv_billing')
            .reduce((sum, t) => sum + parseFloat(t.total_amount), 0);
            
        const posRevenue = transactions
            .filter(t => t.transaction_type === 'cafe_order')
            .reduce((sum, t) => sum + parseFloat(t.total_amount), 0);
        
        const totalRevenue = tvBillingRevenue + posRevenue;
        const totalTransactions = transactions.reduce((sum, t) => sum + parseInt(t.transaction_count), 0);
        
        res.json({
            success: true,
            data: {
                summary: {
                    total_revenue: totalRevenue,
                    tv_billing_revenue: tvBillingRevenue,
                    pos_revenue: posRevenue,
                    total_transactions: totalTransactions
                },
                breakdown: transactions
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;