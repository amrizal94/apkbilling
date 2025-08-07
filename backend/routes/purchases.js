const express = require('express');
const router = express.Router();
const db = require('../config/database');
const auth = require('../middleware/auth');
const { rbac } = require('../middleware/rbac');

// Socket.io instance
let io = null;

// Function to set socket.io instance
router.setSocketIO = (socketInstance) => {
    io = socketInstance;
};

// Apply authentication middleware to all purchase routes
router.use(auth);

// Generate purchase order number
const generatePONumber = () => {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const time = now.getTime().toString().slice(-6);
    return `PO${year}${month}${day}${time}`;
};

// Get all purchase orders (Manager and above)
router.get('/orders', rbac('purchase_orders', 'view_only'), async (req, res) => {
    try {
        const { status, supplier_id, start_date, end_date, limit = 50 } = req.query;
        
        let query = `
            SELECT po.*, s.supplier_name,
                   u1.full_name as created_by_name,
                   u2.full_name as received_by_name,
                   COUNT(poi.id) as item_count
            FROM purchase_orders po
            LEFT JOIN suppliers s ON po.supplier_id = s.id
            LEFT JOIN users u1 ON po.created_by = u1.id
            LEFT JOIN users u2 ON po.received_by = u2.id
            LEFT JOIN purchase_order_items poi ON po.id = poi.purchase_order_id
            WHERE 1=1
        `;
        
        const params = [];
        let paramCount = 0;
        
        if (status) {
            paramCount++;
            query += ` AND po.status = $${paramCount}`;
            params.push(status);
        }
        
        if (supplier_id) {
            paramCount++;
            query += ` AND po.supplier_id = $${paramCount}`;
            params.push(supplier_id);
        }
        
        if (start_date) {
            paramCount++;
            query += ` AND po.purchase_date >= $${paramCount}`;
            params.push(start_date);
        }
        
        if (end_date) {
            paramCount++;
            query += ` AND po.purchase_date <= $${paramCount}`;
            params.push(end_date);
        }
        
        query += `
            GROUP BY po.id, s.supplier_name, u1.full_name, u2.full_name
            ORDER BY po.created_at DESC
        `;
        
        if (limit) {
            paramCount++;
            query += ` LIMIT $${paramCount}`;
            params.push(parseInt(limit));
        }
        
        const result = await db.query(query, params);
        
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching purchase orders:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch purchase orders'
        });
    }
});

// Get purchase order by ID with items
router.get('/orders/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get purchase order details
        const poResult = await db.query(`
            SELECT po.*, s.supplier_name, s.contact_person, s.phone,
                   u1.full_name as created_by_name,
                   u2.full_name as received_by_name
            FROM purchase_orders po
            LEFT JOIN suppliers s ON po.supplier_id = s.id
            LEFT JOIN users u1 ON po.created_by = u1.id
            LEFT JOIN users u2 ON po.received_by = u2.id
            WHERE po.id = $1
        `, [id]);
        
        if (poResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Purchase order not found'
            });
        }
        
        // Get purchase order items
        const itemsResult = await db.query(`
            SELECT poi.*, p.product_name, pc.category_name
            FROM purchase_order_items poi
            LEFT JOIN products p ON poi.product_id = p.id
            LEFT JOIN product_categories pc ON p.category_id = pc.id
            WHERE poi.purchase_order_id = $1
            ORDER BY p.product_name
        `, [id]);
        
        const purchaseOrder = {
            ...poResult.rows[0],
            items: itemsResult.rows
        };
        
        res.json({
            success: true,
            data: purchaseOrder
        });
    } catch (error) {
        console.error('Error fetching purchase order:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch purchase order'
        });
    }
});

// Create new purchase order (Manager and Super Admin only)
router.post('/orders', rbac('purchase_orders'), async (req, res) => {
    const client = await db.getClient();
    
    try {
        await client.query('BEGIN');
        
        const {
            supplier_id,
            purchase_date,
            items,
            notes
        } = req.body;
        
        if (!supplier_id || !purchase_date || !items || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Supplier, purchase date, and items are required'
            });
        }
        
        // Generate PO number
        const purchase_order_number = generatePONumber();
        
        // Calculate total amount
        const total_amount = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
        
        // Insert purchase order
        const poResult = await client.query(`
            INSERT INTO purchase_orders (
                purchase_order_number, supplier_id, purchase_date, 
                total_amount, notes, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
        `, [purchase_order_number, supplier_id, purchase_date, total_amount, notes, req.user.id]);
        
        const purchaseOrderId = poResult.rows[0].id;
        
        // Insert purchase order items
        for (const item of items) {
            const total_price = item.quantity * item.unit_price;
            await client.query(`
                INSERT INTO purchase_order_items (
                    purchase_order_id, product_id, quantity, unit_price, total_price
                ) VALUES ($1, $2, $3, $4, $5)
            `, [purchaseOrderId, item.product_id, item.quantity, item.unit_price, total_price]);
        }
        
        await client.query('COMMIT');
        
        // Emit socket event for new purchase order
        if (io) {
            const newPOData = {
                id: purchaseOrderId,
                purchase_order_number: purchase_order_number,
                supplier_id: supplier_id,
                total_amount: total_amount,
                status: 'pending',
                created_at: new Date().toISOString(),
                item_count: items.length
            };
            io.emit('new_purchase_order', newPOData);
            console.log('🆕 Emitted new purchase order event:', newPOData);
        }
        
        res.status(201).json({
            success: true,
            message: 'Purchase order created successfully',
            data: {
                id: purchaseOrderId,
                purchase_order_number: purchase_order_number,
                total_amount: total_amount
            }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating purchase order:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create purchase order'
        });
    } finally {
        client.release();
    }
});

// Receive purchase order (update stock)
router.patch('/orders/:id/receive', async (req, res) => {
    const client = await db.getClient();
    
    try {
        await client.query('BEGIN');
        
        const { id } = req.params;
        const { received_items } = req.body; // Array of {product_id, received_quantity}
        
        // Check if PO exists and is pending
        const poResult = await client.query(
            'SELECT * FROM purchase_orders WHERE id = $1 AND status = $2',
            [id, 'pending']
        );
        
        if (poResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Purchase order not found or already received'
            });
        }
        
        // Get PO items
        const itemsResult = await client.query(`
            SELECT poi.*, p.stock_quantity 
            FROM purchase_order_items poi
            LEFT JOIN products p ON poi.product_id = p.id
            WHERE poi.purchase_order_id = $1
        `, [id]);
        
        // Update stock for each item
        for (const item of itemsResult.rows) {
            const receivedItem = received_items.find(ri => ri.product_id === item.product_id);
            const receivedQty = receivedItem ? receivedItem.received_quantity : item.quantity;
            
            if (receivedQty > 0) {
                // Update product stock
                const currentStock = item.stock_quantity || 0;
                const newStock = currentStock + receivedQty;
                
                await client.query(
                    'UPDATE products SET stock_quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                    [newStock, item.product_id]
                );
                
                // Record stock movement
                await client.query(`
                    INSERT INTO stock_movements (
                        product_id, movement_type, quantity_change, stock_before, stock_after,
                        reference_type, reference_id, created_by
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `, [
                    item.product_id, 'purchase', receivedQty, currentStock, newStock,
                    'purchase_order', id, req.user.id
                ]);
            }
        }
        
        // Update purchase order status
        await client.query(`
            UPDATE purchase_orders SET 
                status = 'received', 
                received_by = $1, 
                received_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
        `, [req.user.id, id]);
        
        await client.query('COMMIT');
        
        // Get PO details for socket event
        const poDetails = poResult.rows[0];
        
        // Emit socket event for purchase order received
        if (io) {
            io.emit('purchase_order_received', {
                order_id: parseInt(id),
                po_number: poDetails.purchase_order_number
            });
            console.log('📦 Emitted purchase order received event:', { order_id: id, po_number: poDetails.purchase_order_number });
        }
        
        res.json({
            success: true,
            message: 'Purchase order received and stock updated successfully'
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error receiving purchase order:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to receive purchase order'
        });
    } finally {
        client.release();
    }
});

// Cancel purchase order
router.patch('/orders/:id/cancel', async (req, res) => {
    try {
        const { id } = req.params;
        const { cancel_reason } = req.body;
        
        const result = await db.query(`
            UPDATE purchase_orders SET 
                status = 'cancelled',
                notes = COALESCE(notes || '. ', '') || 'Cancelled: ' || $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2 AND status = 'pending'
            RETURNING *
        `, [cancel_reason || 'No reason provided', id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Purchase order not found or cannot be cancelled'
            });
        }
        
        const cancelledPO = result.rows[0];
        
        // Emit socket event for purchase order cancelled
        if (io) {
            io.emit('purchase_order_cancelled', {
                order_id: parseInt(id),
                po_number: cancelledPO.purchase_order_number
            });
            console.log('❌ Emitted purchase order cancelled event:', { order_id: id, po_number: cancelledPO.purchase_order_number });
        }
        
        res.json({
            success: true,
            message: 'Purchase order cancelled successfully'
        });
    } catch (error) {
        console.error('Error cancelling purchase order:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cancel purchase order'
        });
    }
});

// Get stock movements
router.get('/stock-movements', async (req, res) => {
    try {
        const { product_id, movement_type, start_date, end_date, limit = 100 } = req.query;
        
        let query = `
            SELECT sm.*, p.product_name, u.full_name as created_by_name
            FROM stock_movements sm
            LEFT JOIN products p ON sm.product_id = p.id
            LEFT JOIN users u ON sm.created_by = u.id
            WHERE 1=1
        `;
        
        const params = [];
        let paramCount = 0;
        
        if (product_id) {
            paramCount++;
            query += ` AND sm.product_id = $${paramCount}`;
            params.push(product_id);
        }
        
        if (movement_type) {
            paramCount++;
            query += ` AND sm.movement_type = $${paramCount}`;
            params.push(movement_type);
        }
        
        if (start_date) {
            paramCount++;
            query += ` AND sm.created_at >= $${paramCount}`;
            params.push(start_date);
        }
        
        if (end_date) {
            paramCount++;
            query += ` AND sm.created_at <= $${paramCount}`;
            params.push(end_date);
        }
        
        query += ' ORDER BY sm.created_at DESC';
        
        if (limit) {
            paramCount++;
            query += ` LIMIT $${paramCount}`;
            params.push(parseInt(limit));
        }
        
        const result = await db.query(query, params);
        
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching stock movements:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch stock movements'
        });
    }
});

module.exports = router;