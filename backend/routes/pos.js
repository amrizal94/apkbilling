const express = require('express');
const router = express.Router();
const db = require('../config/database');
const auth = require('../middleware/auth');

// Get all product categories
router.get('/categories', auth, async (req, res) => {
    try {
        const [categories] = await db.execute(`
            SELECT * FROM product_categories 
            WHERE is_active = TRUE 
            ORDER BY category_name
        `);
        
        res.json({
            success: true,
            data: categories
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get all products
router.get('/products', auth, async (req, res) => {
    try {
        const { category_id, available_only } = req.query;
        
        let query = `
            SELECT p.*, pc.category_name 
            FROM products p
            LEFT JOIN product_categories pc ON p.category_id = pc.id
            WHERE 1=1
        `;
        const params = [];
        
        if (category_id) {
            query += ' AND p.category_id = $' + (params.length + 1);
            params.push(category_id);
        }
        
        if (available_only === 'true') {
            query += ' AND p.is_available = TRUE AND p.stock_quantity > 0';
        }
        
        query += ' ORDER BY pc.category_name, p.product_name';
        
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

// Create new order
router.post('/orders', auth, async (req, res) => {
    try {
        const { customer_name, table_number, order_type, items } = req.body;
        
        if (!items || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Order must contain at least one item'
            });
        }
        
        // Generate order number
        const orderPrefix = process.env.ORDER_PREFIX || 'ORD';
        const orderLength = parseInt(process.env.ORDER_NUMBER_LENGTH) || 8;
        const timestamp = Date.now().toString().slice(-6);
        const orderNumber = `${orderPrefix}${timestamp.padStart(orderLength - orderPrefix.length, '0')}`;
        
        // Calculate total amount
        let totalAmount = 0;
        for (const item of items) {
            const [products] = await db.execute(
                'SELECT price FROM products WHERE id = $1',
                [item.product_id]
            );
            
            if (products.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: `Product with ID ${item.product_id} not found`
                });
            }
            
            totalAmount += products[0].price * item.quantity;
        }
        
        // Create order
        const [orderResult] = await db.execute(`
            INSERT INTO orders (order_number, customer_name, table_number, total_amount, order_type, status) 
            VALUES ($1, $2, $3, $4, $5, 'pending')
            RETURNING id
        `, [orderNumber, customer_name, table_number, totalAmount, order_type || 'dine_in']);
        
        const orderId = orderResult[0].id;
        
        // Add order items
        for (const item of items) {
            const [products] = await db.execute(
                'SELECT price FROM products WHERE id = $1',
                [item.product_id]
            );
            
            const unitPrice = products[0].price;
            const totalPrice = unitPrice * item.quantity;
            
            await db.execute(`
                INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price, notes)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [orderId, item.product_id, item.quantity, unitPrice, totalPrice, item.notes || null]);
            
            // Update stock
            await db.execute(`
                UPDATE products 
                SET stock_quantity = stock_quantity - $1 
                WHERE id = $2
            `, [item.quantity, item.product_id]);
        }
        
        // Add transaction record
        await db.execute(`
            INSERT INTO transactions (transaction_type, reference_id, amount, payment_method, cashier_name)
            VALUES ('cafe_order', $1, $2, 'cash', $3)
        `, [orderId, totalAmount, req.user.full_name]);
        
        res.json({
            success: true,
            message: 'Order created successfully',
            data: {
                order_id: orderId,
                order_number: orderNumber,
                total_amount: totalAmount
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get orders
router.get('/orders', auth, async (req, res) => {
    try {
        const { status, date, limit = 50 } = req.query;
        
        let query = `
            SELECT o.*, 
                   COUNT(oi.id) as item_count,
                   STRING_AGG(p.product_name, ', ') as items_summary
            FROM orders o
            LEFT JOIN order_items oi ON o.id = oi.order_id
            LEFT JOIN products p ON oi.product_id = p.id
            WHERE 1=1
        `;
        const params = [];
        
        if (status) {
            query += ' AND o.status = $' + (params.length + 1);
            params.push(status);
        }
        
        if (date) {
            query += ' AND DATE(o.created_at) = $' + (params.length + 1);
            params.push(date);
        }
        
        query += `
            GROUP BY o.id
            ORDER BY o.created_at DESC
            LIMIT $${params.length + 1}
        `;
        params.push(parseInt(limit));
        
        const [orders] = await db.execute(query, params);
        
        res.json({
            success: true,
            data: orders
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Update order status
router.patch('/orders/:orderId/status', auth, async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;
        
        const validStatuses = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status'
            });
        }
        
        await db.execute(
            'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
            [status, orderId]
        );
        
        res.json({
            success: true,
            message: 'Order status updated successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;