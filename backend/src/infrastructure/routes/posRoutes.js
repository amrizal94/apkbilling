const express = require('express');

/**
 * POS System Routes
 * Defines all POS and F&B order management API endpoints
 */
function createPOSRoutes(container) {
  const router = express.Router();
  
  // Get dependencies from container
  const authMiddleware = container.resolve('authMiddleware');
  const rbacMiddleware = container.resolve('rbacMiddleware');
  const responseHandler = container.resolve('responseHandler');
  const database = container.resolve('database');
  const logger = container.resolve('logger');

  // All POS routes require authentication
  router.use(authMiddleware.authenticate());

  // GET /api/pos/orders - Get orders with filtering
  router.get('/orders', 
    rbacMiddleware.requirePermission('order_management'),
    async (req, res) => {
      try {
        const { 
          status = 'all', 
          limit = 50, 
          offset = 0, 
          date_from, 
          date_to,
          customer_name 
        } = req.query;
        
        let query = `
          SELECT 
            o.id, o.order_number, o.customer_name, o.status, o.order_type,
            o.total_amount, o.created_at, o.updated_at, o.table_number,
            COUNT(oi.id) as item_count
          FROM orders o
          LEFT JOIN order_items oi ON o.id = oi.order_id
        `;
        
        const conditions = [];
        const params = [];

        if (status !== 'all') {
          conditions.push(`o.status = $${params.length + 1}`);
          params.push(status);
        }

        if (date_from) {
          conditions.push(`DATE(o.created_at) >= $${params.length + 1}`);
          params.push(date_from);
        }

        if (date_to) {
          conditions.push(`DATE(o.created_at) <= $${params.length + 1}`);
          params.push(date_to);
        }

        if (customer_name) {
          conditions.push(`o.customer_name ILIKE $${params.length + 1}`);
          params.push(`%${customer_name}%`);
        }

        if (conditions.length > 0) {
          query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ` 
          GROUP BY o.id
          ORDER BY o.created_at DESC 
          LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `;
        params.push(parseInt(limit), parseInt(offset));

        const orders = await database.query(query, params);

        // Get detailed items for each order if status is 'pending'
        if (status === 'pending' && orders.rows.length > 0) {
          for (let order of orders.rows) {
            const itemsResult = await database.query(`
              SELECT 
                oi.product_name, oi.quantity, oi.unit_price, oi.total_price, oi.notes
              FROM order_items oi
              WHERE oi.order_id = $1
              ORDER BY oi.product_name
            `, [order.id]);
            
            order.items = itemsResult.rows;
          }
        }

        return responseHandler.success(res, orders.rows, 'Orders retrieved successfully');
      } catch (error) {
        logger.error('Error fetching orders', { error: error.message });
        return responseHandler.error(res, 'Failed to fetch orders', 500);
      }
    }
  );

  // GET /api/pos/orders/:orderId - Get order details
  router.get('/orders/:orderId', 
    rbacMiddleware.requirePermission('order_management'),
    async (req, res) => {
      try {
        const { orderId } = req.params;

        // Get order details
        const orderResult = await database.query(`
          SELECT o.*
          FROM orders o
          WHERE o.id = $1
        `, [orderId]);

        if (orderResult.rows.length === 0) {
          return responseHandler.error(res, 'Order not found', 404);
        }

        // Get order items
        const itemsResult = await database.query(`
          SELECT 
            oi.id, oi.product_id, oi.product_name, oi.quantity, 
            oi.unit_price, oi.total_price, oi.notes,
            p.category, p.description
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = $1
          ORDER BY oi.id
        `, [orderId]);

        const order = {
          ...orderResult.rows[0],
          items: itemsResult.rows
        };

        return responseHandler.success(res, order, 'Order details retrieved successfully');
      } catch (error) {
        logger.error('Error fetching order details', { error: error.message });
        return responseHandler.error(res, 'Failed to fetch order details', 500);
      }
    }
  );

  // POST /api/pos/orders - Create new order
  router.post('/orders', 
    rbacMiddleware.requirePermission('order_management'),
    async (req, res) => {
      try {
        const { 
          customer_name, 
          order_type = 'pos', 
          items, 
          payment_method = 'cash',
          notes 
        } = req.body;

        if (!items || items.length === 0) {
          return responseHandler.error(res, 'Order must have at least one item', 400);
        }

        // Calculate total
        let total_amount = 0;
        for (const item of items) {
          total_amount += item.quantity * item.unit_price;
        }

        // Generate order number (max 20 chars)
        const timestamp = Date.now().toString().slice(-8); // Last 8 digits of timestamp
        const randomStr = Math.random().toString(36).substr(2, 4).toUpperCase(); // 4 chars
        const orderNumber = `POS${timestamp}${randomStr}`; // POS + 8 + 4 = 15 chars max

        // Start transaction
        const client = await database.getClient();
        try {
          await client.query('BEGIN');

          // Create order
          const orderResult = await client.query(`
            INSERT INTO orders 
              (order_number, customer_name, order_type, table_number, total_amount, status, created_at)
            VALUES ($1, $2, $3, $4, $5, 'pending', NOW())
            RETURNING *
          `, [orderNumber, customer_name, order_type, '0', total_amount]);

          const orderId = orderResult.rows[0].id;

          // Create order items
          for (const item of items) {
            await client.query(`
              INSERT INTO order_items 
                (order_id, product_id, product_name, quantity, unit_price, total_price, notes)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
              orderId, 
              item.product_id, 
              item.product_name, 
              item.quantity, 
              item.unit_price, 
              item.quantity * item.unit_price,
              item.notes || null
            ]);

            // Update product stock if product exists
            if (item.product_id) {
              await client.query(`
                UPDATE products 
                SET stock_quantity = stock_quantity - $1 
                WHERE id = $2 AND stock_quantity >= $1
              `, [item.quantity, item.product_id]);
            }
          }


          await client.query('COMMIT');

          logger.info('Order created', { 
            orderId: orderId,
            orderNumber: orderNumber,
            totalAmount: total_amount,
            userId: req.user?.id 
          });

          return responseHandler.success(res, orderResult.rows[0], 'Order created successfully');

        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }

      } catch (error) {
        logger.error('Error creating order', { error: error.message });
        return responseHandler.error(res, 'Failed to create order', 500);
      }
    }
  );

  // PUT /api/pos/orders/:orderId/status - Update order status
  router.put('/orders/:orderId/status', 
    rbacMiddleware.requirePermission('order_management'),
    async (req, res) => {
      try {
        const { orderId } = req.params;
        const { status, notes } = req.body;

        const validStatuses = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
          return responseHandler.error(res, 'Invalid status', 400);
        }

        const result = await database.query(`
          UPDATE orders 
          SET status = $1, notes = COALESCE($2, notes), updated_at = NOW()
          WHERE id = $3 
          RETURNING *
        `, [status, notes, orderId]);

        if (result.rows.length === 0) {
          return responseHandler.error(res, 'Order not found', 404);
        }

        logger.info('Order status updated', { 
          orderId: orderId,
          newStatus: status,
          userId: req.user?.id 
        });

        return responseHandler.success(res, result.rows[0], 'Order status updated successfully');
      } catch (error) {
        logger.error('Error updating order status', { error: error.message });
        return responseHandler.error(res, 'Failed to update order status', 500);
      }
    }
  );

  // GET /api/pos/products - Get products for POS
  router.get('/products', 
    rbacMiddleware.requirePermission('product_management'),
    async (req, res) => {
      try {
        const { category = 'all', search = '', limit = 100 } = req.query;
        
        let query = `
          SELECT p.id, p.product_name as name, p.category_id, p.price, p.stock_quantity, 
                 p.is_available as is_active, pc.category_name
          FROM products p
          LEFT JOIN product_categories pc ON p.category_id = pc.id
          WHERE p.is_available = true OR p.is_available IS NULL
        `;
        
        const params = [];

        if (category !== 'all') {
          query += ` AND category_id = $${params.length + 1}`;
          params.push(category);
        }

        if (search) {
          query += ` AND product_name ILIKE $${params.length + 1}`;
          params.push(`%${search}%`);
        }

        query += ` ORDER BY category_id, product_name LIMIT $${params.length + 1}`;
        params.push(parseInt(limit));

        const products = await database.query(query, params);

        return responseHandler.success(res, products.rows, 'Products retrieved successfully');
      } catch (error) {
        logger.error('Error fetching products', { error: error.message });
        return responseHandler.error(res, 'Failed to fetch products', 500);
      }
    }
  );

  // GET /api/pos/categories - Get product categories
  router.get('/categories', 
    rbacMiddleware.requirePermission('product_management'),
    async (req, res) => {
      try {
        // Return simple categories for now
        const categories = [
          { category_id: 1, category: 'food', product_count: 0 },
          { category_id: 2, category: 'drink', product_count: 0 },
          { category_id: 3, category: 'snack', product_count: 0 }
        ];

        return responseHandler.success(res, categories, 'Categories retrieved successfully');
      } catch (error) {
        logger.error('Error fetching categories', { error: error.message });
        return responseHandler.error(res, 'Failed to fetch categories', 500);
      }
    }
  );

  // POST /api/pos/products - Add new product
  router.post('/products', 
    rbacMiddleware.requirePermission('product_management'),
    async (req, res) => {
      try {
        const { name, category, price, description, stock_quantity = 0 } = req.body;

        if (!name || !category || price === undefined) {
          return responseHandler.error(res, 'Name, category, and price are required', 400);
        }

        const product = await database.query(`
          INSERT INTO products (product_name, category_id, price, stock_quantity, is_available)
          VALUES ($1, $2, $3, $4, true)
          RETURNING *
        `, [name, category || 1, price, stock_quantity || 0]);

        logger.info('Product created', { 
          productId: product.rows[0].id,
          productName: name,
          userId: req.user?.id 
        });

        return responseHandler.success(res, product.rows[0], 'Product created successfully');
      } catch (error) {
        logger.error('Error creating product', { error: error.message });
        return responseHandler.error(res, 'Failed to create product', 500);
      }
    }
  );

  return router;
}

module.exports = createPOSRoutes;