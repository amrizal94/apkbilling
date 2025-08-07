const express = require('express');
const router = express.Router();
const db = require('../config/database');
const auth = require('../middleware/auth');

// Debug middleware for all POS routes
router.use((req, res, next) => {
    console.log(`🔍 POS Route accessed: ${req.method} ${req.path}`);
    next();
});

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
        
        // Calculate total amount and validate stock
        let totalAmount = 0;
        for (const item of items) {
            const [products] = await db.execute(
                'SELECT price, stock_quantity, is_available, product_name FROM products WHERE id = $1',
                [item.product_id]
            );
            
            if (products.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: `Product with ID ${item.product_id} not found`
                });
            }

            const product = products[0];
            
            // Check if product is available
            if (!product.is_available) {
                return res.status(400).json({
                    success: false,
                    message: `${product.product_name} is not available`
                });
            }
            
            // Check stock availability
            if (product.stock_quantity < item.quantity) {
                return res.status(400).json({
                    success: false,
                    message: `Insufficient stock for ${product.product_name}. Available: ${product.stock_quantity}, Requested: ${item.quantity}`
                });
            }
            
            totalAmount += product.price * item.quantity;
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
            
            // Update stock with additional validation
            const [updateResult] = await db.execute(`
                UPDATE products 
                SET stock_quantity = stock_quantity - $1 
                WHERE id = $2 AND stock_quantity >= $1 AND is_available = true
            `, [item.quantity, item.product_id]);
            
            // Check if stock update was successful
            if (updateResult.affectedRows === 0) {
                // Rollback the transaction
                throw new Error(`Failed to update stock for product ID ${item.product_id}. Stock may have changed during order processing.`);
            }
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
    const client = await db.getClient();
    
    try {
        await client.query('BEGIN');
        
        const { orderId } = req.params;
        const { status } = req.body;
        
        const validStatuses = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status'
            });
        }
        
        // Get order details before updating
        const orderResult = await client.query(
            'SELECT * FROM orders WHERE id = $1',
            [orderId]
        );
        
        if (orderResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }
        
        const order = orderResult.rows[0];
        
        // Update order status
        await client.query(
            'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
            [status, orderId]
        );
        
        // If order is being completed, update stock and record movements
        if (status === 'completed' && order.status !== 'completed') {
            // Get order items
            const itemsResult = await client.query(`
                SELECT oi.*, p.stock_quantity, p.product_name, p.id as product_id
                FROM order_items oi
                LEFT JOIN products p ON oi.product_id = p.id
                WHERE oi.order_id = $1
            `, [orderId]);
            
            const lowStockThreshold = parseInt(process.env.LOW_STOCK_THRESHOLD) || 15;
            const lowStockAlerts = [];
            
            // Update stock for each item and record movements
            for (const item of itemsResult.rows) {
                const currentStock = item.stock_quantity || 0;
                const newStock = Math.max(0, currentStock - item.quantity);
                
                // Update product stock
                await client.query(
                    'UPDATE products SET stock_quantity = $1, updated_at = NOW() WHERE id = $2',
                    [newStock, item.product_id]
                );
                
                // Record stock movement
                await client.query(`
                    INSERT INTO stock_movements (
                        product_id, movement_type, quantity_change, stock_before, stock_after,
                        reference_type, reference_id, created_by
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `, [
                    item.product_id, 'sale', -item.quantity, currentStock, newStock,
                    'order', orderId, req.user.id
                ]);
                
                // Check if product is now low stock
                if (newStock <= lowStockThreshold && currentStock > lowStockThreshold) {
                    // Get additional product details for alert
                    const productResult = await client.query(`
                        SELECT p.*, pc.category_name 
                        FROM products p
                        LEFT JOIN product_categories pc ON p.category_id = pc.id
                        WHERE p.id = $1
                    `, [item.product_id]);
                    
                    if (productResult.rows.length > 0) {
                        const product = productResult.rows[0];
                        lowStockAlerts.push({
                            id: product.id,
                            product_name: product.product_name,
                            stock_quantity: newStock,
                            price: product.price,
                            category_name: product.category_name || 'Unknown'
                        });
                    }
                }
            }
            
            // After updating stocks, check ALL low stock products and emit alerts
            const io = req.app.get('io');
            if (io) {
                // Get all products that are now low stock
                const allLowStockResult = await client.query(`
                    SELECT p.*, pc.category_name 
                    FROM products p
                    LEFT JOIN product_categories pc ON p.category_id = pc.id
                    WHERE p.stock_quantity <= $1 AND p.is_available = TRUE
                    ORDER BY p.stock_quantity ASC
                `, [lowStockThreshold]);
                
                if (allLowStockResult.rows.length > 0) {
                    console.log(`📦 Found ${allLowStockResult.rows.length} low stock products after order completion`);
                    allLowStockResult.rows.forEach(product => {
                        const alert = {
                            id: product.id,
                            product_name: product.product_name,
                            stock_quantity: product.stock_quantity,
                            price: product.price,
                            category_name: product.category_name || 'Unknown'
                        };
                        console.log(`📦 Low stock alert: ${alert.product_name} (${alert.stock_quantity} left)`);
                        io.emit('low_stock_alert', alert);
                    });
                }
            }
        }
        
        await client.query('COMMIT');
        
        res.json({
            success: true,
            message: 'Order status updated successfully',
            order_number: order.order_number
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating order status:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    } finally {
        client.release();
    }
});

// Get low stock products - MOVED TO TOP FOR TESTING
router.get('/products/low-stock', auth, (req, res) => {
    console.log('🔍 LOW STOCK ENDPOINT HIT!');
    res.status(200).json({
        success: true,
        message: 'Low stock endpoint working',
        threshold: 15,
        debug: true,
        timestamp: new Date().toISOString()
    });
});

// Test endpoint
router.get('/products/test', auth, (req, res) => {
    console.log('🔍 TEST ENDPOINT HIT!');
    res.json({ success: true, message: 'Test endpoint works!' });
});

module.exports = router;