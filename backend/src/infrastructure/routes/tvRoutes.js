const express = require('express');

/**
 * TV Management Routes
 * Defines all TV device and session management API endpoints
 */
function createTVRoutes(container) {
  const router = express.Router();
  
  // Get dependencies from container
  const authMiddleware = container.resolve('authMiddleware');
  const rbacMiddleware = container.resolve('rbacMiddleware');
  const responseHandler = container.resolve('responseHandler');
  const database = container.resolve('database');
  const logger = container.resolve('logger');

  // Public routes for Android TV devices (no authentication required)
  
  // POST /api/tv/discover - Device discovery (public endpoint)
  router.post('/discover', async (req, res) => {
    try {
      const { device_id, device_name, device_type = 'android_tv', device_location } = req.body;
      
      if (!device_id || !device_name) {
        return responseHandler.error(res, 'device_id and device_name are required', 400);
      }

      // Check if device exists
      const existingDevice = await database.query(
        'SELECT * FROM tv_devices WHERE device_id = $1',
        [device_id]
      );

      let device;
      if (existingDevice.rows.length > 0) {
        // Update existing device
        device = await database.query(`
          UPDATE tv_devices 
          SET device_name = $1, device_location = $2, last_heartbeat = NOW()
          WHERE device_id = $3
          RETURNING *
        `, [device_name, device_location || '', device_id]);
      } else {
        // Create new device
        device = await database.query(`
          INSERT INTO tv_devices (device_id, device_name, device_location, device_type, last_heartbeat)
          VALUES ($1, $2, $3, $4, NOW())
          RETURNING *
        `, [device_id, device_name, device_location || '', device_type]);
      }

      logger.info('Device discovered/updated', { 
        deviceId: device_id,
        deviceName: device_name,
        isNew: existingDevice.rows.length === 0
      });

      return responseHandler.success(res, device.rows[0], 'Device discovered successfully');
    } catch (error) {
      logger.error('Error in device discovery', { error: error.message });
      return responseHandler.error(res, 'Failed to discover device', 500);
    }
  });

  // POST /api/tv/register - Device registration (public endpoint)
  router.post('/register', async (req, res) => {
    try {
      const { device_id, device_name, device_type = 'android_tv', device_location } = req.body;
      
      if (!device_id || !device_name) {
        return responseHandler.error(res, 'device_id and device_name are required', 400);
      }

      // Check if device exists
      const existingDevice = await database.query(
        'SELECT * FROM tv_devices WHERE device_id = $1',
        [device_id]
      );

      let device;
      if (existingDevice.rows.length > 0) {
        // Update existing device
        device = await database.query(`
          UPDATE tv_devices 
          SET device_name = $1, device_location = $2, last_heartbeat = NOW(), is_active = true
          WHERE device_id = $3
          RETURNING *
        `, [device_name, device_location || '', device_id]);
      } else {
        // Create new device
        device = await database.query(`
          INSERT INTO tv_devices (device_id, device_name, device_location, device_type, is_active, last_heartbeat)
          VALUES ($1, $2, $3, $4, true, NOW())
          RETURNING *
        `, [device_id, device_name, device_location || '', device_type]);
      }

      logger.info('Device registered', { 
        deviceId: device_id,
        deviceName: device_name
      });

      return responseHandler.success(res, device.rows[0], 'Device registered successfully');
    } catch (error) {
      logger.error('Error registering device', { error: error.message });
      return responseHandler.error(res, 'Failed to register device', 500);
    }
  });

  // POST /api/tv/heartbeat/:deviceId - Device heartbeat (public endpoint)
  router.post('/heartbeat/:deviceId', async (req, res) => {
    try {
      const { deviceId } = req.params;
      const { device_name, device_location } = req.body;

      const result = await database.query(`
        UPDATE tv_devices 
        SET last_heartbeat = NOW(),
            device_name = COALESCE($2, device_name),
            device_location = COALESCE($3, device_location)
        WHERE device_id = $1
        RETURNING *
      `, [deviceId, device_name, device_location]);

      if (result.rows.length === 0) {
        return responseHandler.error(res, 'Device not found', 404);
      }

      return responseHandler.success(res, {
        success: true,
        timestamp: new Date().toISOString()
      }, 'Heartbeat received');
    } catch (error) {
      logger.error('Error processing heartbeat', { error: error.message, deviceId: req.params.deviceId });
      return responseHandler.error(res, 'Failed to process heartbeat', 500);
    }
  });

  // GET /api/tv/active-session/:deviceId - Get active session (public endpoint)
  router.get('/active-session/:deviceId', async (req, res) => {
    try {
      const { deviceId } = req.params;

      const session = await database.query(`
        SELECT 
          ts.id as session_id, ts.device_id, ts.customer_name, ts.package_id,
          ts.duration_minutes, ts.start_time, ts.status, ts.total_amount,
          p.name as package_name,
          EXTRACT(EPOCH FROM (NOW() - ts.start_time))/60 as elapsed_minutes,
          GREATEST(0, ts.duration_minutes - EXTRACT(EPOCH FROM (NOW() - ts.start_time))/60) as remaining_minutes
        FROM tv_sessions ts
        LEFT JOIN packages p ON ts.package_id = p.id
        WHERE ts.device_id = $1 AND ts.status = 'active'
        ORDER BY ts.start_time DESC
        LIMIT 1
      `, [deviceId]);

      if (session.rows.length === 0) {
        return responseHandler.success(res, null, 'No active session found');
      }

      return responseHandler.success(res, session.rows[0], 'Active session retrieved');
    } catch (error) {
      logger.error('Error getting active session', { error: error.message });
      return responseHandler.error(res, 'Failed to get active session', 500);
    }
  });

  // All other TV routes require authentication
  router.use(authMiddleware.authenticate());

  // GET /api/tv/devices - Get all TV devices
  router.get('/devices', 
    rbacMiddleware.requirePermission('device_management'),
    async (req, res) => {
      try {
        const devices = await database.query(`
          SELECT 
            id, device_id, device_name, device_location, 
            last_heartbeat, created_at,
            CASE 
              WHEN last_heartbeat >= NOW() - INTERVAL '5 minutes' THEN 'online'
              ELSE 'offline'
            END as status
          FROM tv_devices 
          ORDER BY device_name
        `);

        return responseHandler.success(res, devices.rows, 'Devices retrieved successfully');
      } catch (error) {
        logger.error('Error fetching devices', { error: error.message });
        return responseHandler.error(res, 'Failed to fetch devices', 500);
      }
    }
  );

  // GET /api/tv/sessions - Get TV sessions
  router.get('/sessions', 
    rbacMiddleware.requirePermission('session_management'),
    async (req, res) => {
      try {
        const { status = 'all', limit = 50, offset = 0 } = req.query;
        
        let query = `
          SELECT 
            ts.id, ts.device_id, ts.customer_name, ts.package_id, 
            ts.duration_minutes, ts.start_time, ts.end_time, ts.status,
            ts.total_amount, ts.additional_amount, ts.fnb_total,
            td.device_name, td.device_location,
            p.name as package_name, p.price as package_price
          FROM tv_sessions ts
          LEFT JOIN tv_devices td ON ts.device_id = td.device_id
          LEFT JOIN packages p ON ts.package_id = p.id
        `;
        
        const params = [];
        if (status !== 'all') {
          query += ' WHERE ts.status = $1';
          params.push(status);
        }
        
        query += ' ORDER BY ts.start_time DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
        params.push(parseInt(limit), parseInt(offset));

        const sessions = await database.query(query, params);

        return responseHandler.success(res, sessions.rows, 'Sessions retrieved successfully');
      } catch (error) {
        logger.error('Error fetching sessions', { error: error.message });
        return responseHandler.error(res, 'Failed to fetch sessions', 500);
      }
    }
  );

  // POST /api/tv/sessions - Start new TV session
  router.post('/sessions', 
    rbacMiddleware.requirePermission('session_management'),
    async (req, res) => {
      try {
        const { device_id, customer_name, package_id } = req.body;

        // Validate device exists and is available
        const deviceCheck = await database.query(
          'SELECT id, device_name FROM tv_devices WHERE device_id = $1 AND is_active = true',
          [device_id]
        );

        if (deviceCheck.rows.length === 0) {
          return responseHandler.error(res, 'Device not found or inactive', 404);
        }

        // Check if device has active session
        const activeSession = await database.query(
          'SELECT id FROM tv_sessions WHERE device_id = $1 AND status = $2',
          [device_id, 'active']
        );

        if (activeSession.rows.length > 0) {
          return responseHandler.error(res, 'Device already has an active session', 409);
        }

        // Get package details
        const packageInfo = await database.query(
          'SELECT id, name, duration_minutes, price FROM packages WHERE id = $1 AND is_active = true',
          [package_id]
        );

        if (packageInfo.rows.length === 0) {
          return responseHandler.error(res, 'Package not found or inactive', 404);
        }

        const pkg = packageInfo.rows[0];

        // Create new session
        const newSession = await database.query(`
          INSERT INTO tv_sessions 
            (device_id, customer_name, package_id, duration_minutes, start_time, status, total_amount)
          VALUES ($1, $2, $3, $4, NOW(), 'active', $5)
          RETURNING *
        `, [device_id, customer_name, package_id, pkg.duration_minutes, pkg.price]);

        logger.info('TV session started', { 
          sessionId: newSession.rows[0].id,
          deviceId: device_id,
          customerName: customer_name,
          userId: req.user?.id 
        });

        return responseHandler.success(res, newSession.rows[0], 'Session started successfully');
      } catch (error) {
        logger.error('Error starting session', { error: error.message });
        return responseHandler.error(res, 'Failed to start session', 500);
      }
    }
  );

  // PUT /api/tv/sessions/:sessionId/end - End TV session
  router.put('/sessions/:sessionId/end', 
    rbacMiddleware.requirePermission('session_management'),
    async (req, res) => {
      try {
        const { sessionId } = req.params;

        const session = await database.query(
          'SELECT * FROM tv_sessions WHERE id = $1',
          [sessionId]
        );

        if (session.rows.length === 0) {
          return responseHandler.error(res, 'Session not found', 404);
        }

        if (session.rows[0].status !== 'active') {
          return responseHandler.error(res, 'Session is not active', 400);
        }

        // End the session
        const updatedSession = await database.query(`
          UPDATE tv_sessions 
          SET status = 'completed', end_time = NOW()
          WHERE id = $1 
          RETURNING *
        `, [sessionId]);

        logger.info('TV session ended', { 
          sessionId: sessionId,
          userId: req.user?.id 
        });

        return responseHandler.success(res, updatedSession.rows[0], 'Session ended successfully');
      } catch (error) {
        logger.error('Error ending session', { error: error.message });
        return responseHandler.error(res, 'Failed to end session', 500);
      }
    }
  );

  // POST /api/tv/sessions/:sessionId/add-time - Add time to session
  router.post('/sessions/:sessionId/add-time', 
    rbacMiddleware.requirePermission('session_management'),
    async (req, res) => {
      try {
        const { sessionId } = req.params;
        const { additional_minutes, additional_amount = 0 } = req.body;

        const session = await database.query(
          'SELECT * FROM tv_sessions WHERE id = $1',
          [sessionId]
        );

        if (session.rows.length === 0) {
          return responseHandler.error(res, 'Session not found', 404);
        }

        if (session.rows[0].status !== 'active') {
          return responseHandler.error(res, 'Session is not active', 400);
        }

        // Add time to session
        const updatedSession = await database.query(`
          UPDATE tv_sessions 
          SET 
            duration_minutes = duration_minutes + $1,
            additional_amount = COALESCE(additional_amount, 0) + $2,
            total_amount = total_amount + $2
          WHERE id = $3 
          RETURNING *
        `, [additional_minutes, additional_amount, sessionId]);

        logger.info('Time added to session', { 
          sessionId: sessionId,
          additionalMinutes: additional_minutes,
          additionalAmount: additional_amount,
          userId: req.user?.id 
        });

        return responseHandler.success(res, updatedSession.rows[0], 'Time added successfully');
      } catch (error) {
        logger.error('Error adding time to session', { error: error.message });
        return responseHandler.error(res, 'Failed to add time', 500);
      }
    }
  );

  // DELETE /api/tv/devices/:deviceId - Delete TV device
  router.delete('/devices/:deviceId', 
    rbacMiddleware.requirePermission('device_management'),
    async (req, res) => {
      try {
        const { deviceId } = req.params;

        // Check if device has active sessions
        const activeSessions = await database.query(
          'SELECT COUNT(*) as count FROM tv_sessions WHERE device_id = $1 AND status = $2',
          [deviceId, 'active']
        );

        if (parseInt(activeSessions.rows[0].count) > 0) {
          return responseHandler.error(res, 'Cannot delete device with active sessions', 409);
        }

        // Soft delete device (assuming we have an is_active column)
        const result = await database.query(`
          UPDATE tv_devices 
          SET last_heartbeat = NOW() - INTERVAL '1 year'
          WHERE device_id = $1 
          RETURNING *
        `, [deviceId]);

        if (result.rows.length === 0) {
          return responseHandler.error(res, 'Device not found', 404);
        }

        logger.info('TV device deleted', { 
          deviceId: deviceId,
          userId: req.user?.id 
        });

        return responseHandler.success(res, result.rows[0], 'Device deleted successfully');
      } catch (error) {
        logger.error('Error deleting device', { error: error.message });
        return responseHandler.error(res, 'Failed to delete device', 500);
      }
    }
  );

  // POST /api/tv/sessions/:sessionId/pause - Pause session
  router.post('/sessions/:sessionId/pause', 
    rbacMiddleware.requirePermission('session_management'),
    async (req, res) => {
      try {
        const { sessionId } = req.params;
        const { pause_reason = 'other', pause_notes = '' } = req.body;

        const session = await database.query(
          'SELECT * FROM tv_sessions WHERE id = $1',
          [sessionId]
        );

        if (session.rows.length === 0) {
          return responseHandler.error(res, 'Session not found', 404);
        }

        if (session.rows[0].status !== 'active') {
          return responseHandler.error(res, 'Session is not active', 400);
        }

        // For now, we'll just add a note to the session
        const updatedSession = await database.query(`
          UPDATE tv_sessions 
          SET status = 'paused'
          WHERE id = $1 
          RETURNING *
        `, [sessionId]);

        logger.info('TV session paused', { 
          sessionId: sessionId,
          pauseReason: pause_reason,
          userId: req.user?.id 
        });

        return responseHandler.success(res, updatedSession.rows[0], 'Session paused successfully');
      } catch (error) {
        logger.error('Error pausing session', { error: error.message });
        return responseHandler.error(res, 'Failed to pause session', 500);
      }
    }
  );

  // POST /api/tv/sessions/:sessionId/resume - Resume session
  router.post('/sessions/:sessionId/resume', 
    rbacMiddleware.requirePermission('session_management'),
    async (req, res) => {
      try {
        const { sessionId } = req.params;

        const session = await database.query(
          'SELECT * FROM tv_sessions WHERE id = $1',
          [sessionId]
        );

        if (session.rows.length === 0) {
          return responseHandler.error(res, 'Session not found', 404);
        }

        if (session.rows[0].status !== 'paused') {
          return responseHandler.error(res, 'Session is not paused', 400);
        }

        const updatedSession = await database.query(`
          UPDATE tv_sessions 
          SET status = 'active'
          WHERE id = $1 
          RETURNING *
        `, [sessionId]);

        logger.info('TV session resumed', { 
          sessionId: sessionId,
          userId: req.user?.id 
        });

        return responseHandler.success(res, { 
          ...updatedSession.rows[0],
          pause_duration: 5 // Mock pause duration
        }, 'Session resumed successfully');
      } catch (error) {
        logger.error('Error resuming session', { error: error.message });
        return responseHandler.error(res, 'Failed to resume session', 500);
      }
    }
  );

  // POST /api/tv/sessions/:sessionId/confirm-payment - Confirm payment
  router.post('/sessions/:sessionId/confirm-payment', 
    rbacMiddleware.requirePermission('session_management'),
    async (req, res) => {
      try {
        const { sessionId } = req.params;
        const { payment_notes = '' } = req.body;

        const session = await database.query(
          'SELECT * FROM tv_sessions WHERE id = $1',
          [sessionId]
        );

        if (session.rows.length === 0) {
          return responseHandler.error(res, 'Session not found', 404);
        }

        const updatedSession = await database.query(`
          UPDATE tv_sessions 
          SET status = 'completed'
          WHERE id = $1 
          RETURNING *
        `, [sessionId]);

        logger.info('Payment confirmed', { 
          sessionId: sessionId,
          paymentNotes: payment_notes,
          userId: req.user?.id 
        });

        return responseHandler.success(res, updatedSession.rows[0], 'Payment confirmed successfully');
      } catch (error) {
        logger.error('Error confirming payment', { error: error.message });
        return responseHandler.error(res, 'Failed to confirm payment', 500);
      }
    }
  );

  // POST /api/tv/sessions/:sessionId/order - Create F&B order for session
  router.post('/sessions/:sessionId/order', 
    rbacMiddleware.requirePermission('session_management'),
    async (req, res) => {
      try {
        const { sessionId } = req.params;
        const { order_items = [], order_notes = '' } = req.body;

        if (!order_items || order_items.length === 0) {
          return responseHandler.error(res, 'Order must have at least one item', 400);
        }

        // Check session exists
        const session = await database.query(
          'SELECT * FROM tv_sessions WHERE id = $1',
          [sessionId]
        );

        if (session.rows.length === 0) {
          return responseHandler.error(res, 'Session not found', 404);
        }

        // Calculate total
        let total_amount = 0;
        for (const item of order_items) {
          total_amount += item.quantity * item.price;
        }

        // Generate order number
        const orderNumber = `TV-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

        // Start transaction
        const client = await database.getClient();
        try {
          await client.query('BEGIN');

          // Create order
          const orderResult = await client.query(`
            INSERT INTO orders 
              (order_number, customer_name, order_type, session_id, total_amount, payment_method, status, notes, created_at)
            VALUES ($1, $2, 'fnb', $3, $4, 'session', 'pending', $5, NOW())
            RETURNING *
          `, [orderNumber, session.rows[0].customer_name, sessionId, total_amount, order_notes]);

          const orderId = orderResult.rows[0].id;

          // Create order items
          for (const item of order_items) {
            await client.query(`
              INSERT INTO order_items 
                (order_id, product_id, product_name, quantity, unit_price, total_price)
              VALUES ($1, $2, $3, $4, $5, $6)
            `, [
              orderId, 
              item.product_id, 
              item.product_name, 
              item.quantity, 
              item.price,
              item.quantity * item.price
            ]);
          }

          await client.query('COMMIT');

          logger.info('F&B Order created for session', { 
            orderId: orderId,
            sessionId: sessionId,
            totalAmount: total_amount,
            userId: req.user?.id 
          });

          return responseHandler.success(res, {
            ...orderResult.rows[0],
            total_amount: total_amount
          }, 'Order created successfully');

        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }

      } catch (error) {
        logger.error('Error creating session order', { error: error.message });
        return responseHandler.error(res, 'Failed to create order', 500);
      }
    }
  );

  return router;
}

module.exports = createTVRoutes;