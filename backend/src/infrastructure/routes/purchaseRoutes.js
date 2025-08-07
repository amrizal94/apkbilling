const express = require('express');

/**
 * Purchase Management Routes
 * Defines all purchase order and stock management API endpoints
 */
function createPurchaseRoutes(container) {
  const router = express.Router();
  
  // Get dependencies from container
  const authMiddleware = container.resolve('authMiddleware');
  const rbacMiddleware = container.resolve('rbacMiddleware');
  const responseHandler = container.resolve('responseHandler');
  const database = container.resolve('database');
  const logger = container.resolve('logger');

  // All purchase routes require authentication
  router.use(authMiddleware.authenticate());

  // Generate purchase order number
  const generatePONumber = () => {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const time = now.getTime().toString().slice(-6);
    return `PO${year}${month}${day}${time}`;
  };

  // GET /api/purchases/orders - Get all purchase orders
  router.get('/orders', 
    rbacMiddleware.requirePermission('purchase_orders'),
    async (req, res) => {
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
        `;
        
        const conditions = [];
        const params = [];
        
        if (status) {
          conditions.push(`po.status = $${params.length + 1}`);
          params.push(status);
        }
        
        if (supplier_id) {
          conditions.push(`po.supplier_id = $${params.length + 1}`);
          params.push(supplier_id);
        }
        
        if (start_date) {
          conditions.push(`po.purchase_date >= $${params.length + 1}`);
          params.push(start_date);
        }
        
        if (end_date) {
          conditions.push(`po.purchase_date <= $${params.length + 1}`);
          params.push(end_date);
        }
        
        if (conditions.length > 0) {
          query += ' WHERE ' + conditions.join(' AND ');
        }
        
        query += `
          GROUP BY po.id, s.supplier_name, u1.full_name, u2.full_name
          ORDER BY po.created_at DESC
          LIMIT $${params.length + 1}
        `;
        params.push(parseInt(limit));
        
        const result = await database.query(query, params);
        
        return responseHandler.success(res, result.rows, 'Purchase orders retrieved successfully');
      } catch (error) {
        logger.error('Error fetching purchase orders', { error: error.message });
        return responseHandler.error(res, 'Failed to fetch purchase orders', 500);
      }
    }
  );

  // GET /api/purchases/orders/:id - Get purchase order by ID with items
  router.get('/orders/:id', 
    rbacMiddleware.requirePermission('purchase_orders'),
    async (req, res) => {
      try {
        const { id } = req.params;
        
        // Get purchase order details
        const poResult = await database.query(`
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
          return responseHandler.error(res, 'Purchase order not found', 404);
        }
        
        // Get purchase order items
        const itemsResult = await database.query(`
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
        
        return responseHandler.success(res, purchaseOrder, 'Purchase order retrieved successfully');
      } catch (error) {
        logger.error('Error fetching purchase order', { error: error.message });
        return responseHandler.error(res, 'Failed to fetch purchase order', 500);
      }
    }
  );

  // POST /api/purchases/orders - Create new purchase order
  router.post('/orders', 
    rbacMiddleware.requirePermission('purchase_orders'),
    async (req, res) => {
      const client = await database.getClient();
      
      try {
        await client.query('BEGIN');
        
        const {
          supplier_id,
          purchase_date,
          items,
          notes
        } = req.body;
        
        if (!supplier_id || !purchase_date || !items || items.length === 0) {
          return responseHandler.error(res, 'Supplier, purchase date, and items are required', 400);
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
        
        logger.info('Purchase order created', { 
          purchaseOrderId: purchaseOrderId,
          purchaseOrderNumber: purchase_order_number,
          userId: req.user?.id 
        });
        
        return responseHandler.success(res, {
          id: purchaseOrderId,
          purchase_order_number: purchase_order_number
        }, 'Purchase order created successfully', 201);
        
      } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Error creating purchase order', { error: error.message });
        return responseHandler.error(res, 'Failed to create purchase order', 500);
      } finally {
        client.release();
      }
    }
  );

  // PATCH /api/purchases/orders/:id/receive - Receive purchase order (update stock)
  router.patch('/orders/:id/receive', 
    rbacMiddleware.requirePermission('purchase_orders'),
    async (req, res) => {
      const client = await database.getClient();
      
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
          return responseHandler.error(res, 'Purchase order not found or already received', 404);
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
        
        logger.info('Purchase order received', { 
          purchaseOrderId: id,
          userId: req.user?.id 
        });
        
        return responseHandler.success(res, null, 'Purchase order received and stock updated successfully');
        
      } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Error receiving purchase order', { error: error.message });
        return responseHandler.error(res, 'Failed to receive purchase order', 500);
      } finally {
        client.release();
      }
    }
  );

  // PATCH /api/purchases/orders/:id/cancel - Cancel purchase order
  router.patch('/orders/:id/cancel', 
    rbacMiddleware.requirePermission('purchase_orders'),
    async (req, res) => {
      try {
        const { id } = req.params;
        const { cancel_reason } = req.body;
        
        const result = await database.query(`
          UPDATE purchase_orders SET 
            status = 'cancelled',
            notes = COALESCE(notes || '. ', '') || 'Cancelled: ' || $1,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $2 AND status = 'pending'
          RETURNING *
        `, [cancel_reason || 'No reason provided', id]);
        
        if (result.rows.length === 0) {
          return responseHandler.error(res, 'Purchase order not found or cannot be cancelled', 404);
        }
        
        logger.info('Purchase order cancelled', { 
          purchaseOrderId: id,
          userId: req.user?.id 
        });
        
        return responseHandler.success(res, null, 'Purchase order cancelled successfully');
      } catch (error) {
        logger.error('Error cancelling purchase order', { error: error.message });
        return responseHandler.error(res, 'Failed to cancel purchase order', 500);
      }
    }
  );

  // GET /api/purchases/stock-movements - Get stock movements
  router.get('/stock-movements', 
    rbacMiddleware.requirePermission('stock_movements'),
    async (req, res) => {
      try {
        const { product_id, movement_type, start_date, end_date, limit = 100 } = req.query;
        
        let query = `
          SELECT sm.*, p.product_name, u.full_name as created_by_name
          FROM stock_movements sm
          LEFT JOIN products p ON sm.product_id = p.id
          LEFT JOIN users u ON sm.created_by = u.id
        `;
        
        const conditions = [];
        const params = [];
        
        if (product_id) {
          conditions.push(`sm.product_id = $${params.length + 1}`);
          params.push(product_id);
        }
        
        if (movement_type) {
          conditions.push(`sm.movement_type = $${params.length + 1}`);
          params.push(movement_type);
        }
        
        if (start_date) {
          conditions.push(`sm.created_at >= $${params.length + 1}`);
          params.push(start_date);
        }
        
        if (end_date) {
          conditions.push(`sm.created_at <= $${params.length + 1}`);
          params.push(end_date);
        }
        
        if (conditions.length > 0) {
          query += ' WHERE ' + conditions.join(' AND ');
        }
        
        query += ` ORDER BY sm.created_at DESC LIMIT $${params.length + 1}`;
        params.push(parseInt(limit));
        
        const result = await database.query(query, params);
        
        return responseHandler.success(res, result.rows, 'Stock movements retrieved successfully');
      } catch (error) {
        logger.error('Error fetching stock movements', { error: error.message });
        return responseHandler.error(res, 'Failed to fetch stock movements', 500);
      }
    }
  );

  return router;
}

module.exports = createPurchaseRoutes;