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
          SET device_name = $1, location = $2, updated_at = NOW()
          WHERE device_id = $3
          RETURNING *
        `, [device_name, device_location || '', device_id]);
      } else {
        // Create new device
        device = await database.query(`
          INSERT INTO tv_devices (device_id, device_name, location)
          VALUES ($1, $2, $3)
          RETURNING *
        `, [device_id, device_name, device_location || '']);
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
          SET device_name = $1, location = $2, updated_at = NOW()
          WHERE device_id = $3
          RETURNING *
        `, [device_name, device_location || '', device_id]);
      } else {
        // Create new device
        device = await database.query(`
          INSERT INTO tv_devices (device_id, device_name, location)
          VALUES ($1, $2, $3)
          RETURNING *
        `, [device_id, device_name, device_location || '']);
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

      // Get device status before update to detect status changes
      const beforeUpdate = await database.query(`
        SELECT device_id, device_name, location, updated_at,
               CASE 
                 WHEN updated_at >= NOW() - INTERVAL '5 minutes' THEN 'online'
                 ELSE 'offline'
               END as previous_status
        FROM tv_devices 
        WHERE device_id = $1
      `, [deviceId]);

      const result = await database.query(`
        UPDATE tv_devices 
        SET updated_at = NOW(),
            device_name = COALESCE($2, device_name),
            location = COALESCE($3, location)
        WHERE device_id = $1
        RETURNING *, 
                 CASE 
                   WHEN updated_at >= NOW() - INTERVAL '5 minutes' THEN 'online'
                   ELSE 'offline'
                 END as current_status
      `, [deviceId, device_name, device_location]);

      if (result.rows.length === 0) {
        return responseHandler.error(res, 'Device not found', 404);
      }

      const device = result.rows[0];
      const previousStatus = beforeUpdate.rows.length > 0 ? beforeUpdate.rows[0].previous_status : 'offline';
      const currentStatus = 'online'; // Device is online if it's sending heartbeat

      // Check if there's a real-time service available (WebSocket/Socket.IO)
      const socketService = container.resolve('socketService');
      
      // Emit real-time status change if status changed
      if (previousStatus !== currentStatus) {
        logger.info('Device status changed via heartbeat', { 
          deviceId, 
          previousStatus, 
          currentStatus,
          deviceName: device.device_name
        });

        if (socketService) {
          socketService.broadcast('device_status_changed', {
            device_id: deviceId,
            device_name: device.device_name,
            device_location: device.location,
            previous_status: previousStatus,
            new_status: currentStatus,
            timestamp: new Date().toISOString()
          });
        }
      }

      // Also emit device update for any name/location changes
      if (device_name || device_location) {
        if (socketService) {
          socketService.broadcast('device_updated', {
            device_id: deviceId,
            device_name: device.device_name,
            device_location: device.location,
            timestamp: new Date().toISOString()
          });
        }
      }

      return responseHandler.success(res, {
        success: true,
        timestamp: new Date().toISOString(),
        status: currentStatus
      }, 'Heartbeat received');
    } catch (error) {
      logger.error('Error processing heartbeat', { error: error.message, deviceId: req.params.deviceId });
      return responseHandler.error(res, 'Failed to process heartbeat', 500);
    }
  });

  // POST /api/tv/test-connection/:deviceId - Test connection (public endpoint)
  router.post('/test-connection/:deviceId', async (req, res) => {
    try {
      const { deviceId } = req.params;
      const { device_name, device_location, force_online = true } = req.body;

      // Get device status before update to detect status changes
      const beforeUpdate = await database.query(`
        SELECT device_id, device_name, location, updated_at,
               CASE 
                 WHEN updated_at >= NOW() - INTERVAL '2 minutes' THEN 'online'
                 ELSE 'offline'
               END as previous_status
        FROM tv_devices 
        WHERE device_id = $1
      `, [deviceId]);

      // Update device timestamp and info - this will force it online
      const result = await database.query(`
        UPDATE tv_devices 
        SET updated_at = NOW(),
            device_name = COALESCE($2, device_name),
            location = COALESCE($3, location)
        WHERE device_id = $1
        RETURNING *, 
                 CASE 
                   WHEN updated_at >= NOW() - INTERVAL '2 minutes' THEN 'online'
                   ELSE 'offline'
                 END as current_status
      `, [deviceId, device_name, device_location]);

      if (result.rows.length === 0) {
        return responseHandler.error(res, 'Device not found', 404);
      }

      const device = result.rows[0];
      const previousStatus = beforeUpdate.rows.length > 0 ? beforeUpdate.rows[0].previous_status : 'offline';
      const currentStatus = 'online'; // Test connection should force device online

      // Get socket service for real-time updates
      const socketService = container.resolve('socketService');
      
      // Always emit real-time status change for test connection
      logger.info('Device test connection successful', { 
        deviceId, 
        previousStatus, 
        currentStatus,
        deviceName: device.device_name,
        testConnection: true
      });

      if (socketService) {
        socketService.broadcast('device_status_changed', {
          device_id: deviceId,
          device_name: device.device_name,
          device_location: device.location,
          previous_status: previousStatus,
          new_status: currentStatus,
          test_connection: true,
          timestamp: new Date().toISOString()
        });

        // Also emit device update for any name/location changes
        if (device_name || device_location) {
          socketService.broadcast('device_updated', {
            device_id: deviceId,
            device_name: device.device_name,
            device_location: device.location,
            timestamp: new Date().toISOString()
          });
        }
      }

      return responseHandler.success(res, {
        success: true,
        connection_test: true,
        status: currentStatus,
        previous_status: previousStatus,
        device: {
          device_id: deviceId,
          device_name: device.device_name,
          location: device.location
        },
        timestamp: new Date().toISOString()
      }, 'Connection test successful - Device is now online');
    } catch (error) {
      logger.error('Error testing connection', { error: error.message, deviceId: req.params.deviceId });
      return responseHandler.error(res, 'Connection test failed', 500);
    }
  });

  // GET /api/tv/active-session/:deviceId - Get active session (public endpoint)
  router.get('/active-session/:deviceId', async (req, res) => {
    try {
      const { deviceId } = req.params;

      // Find the device first to get its internal ID
      let session;
      try {
        // First get device internal ID
        const deviceCheck = await database.query(
          'SELECT id FROM tv_devices WHERE device_id = $1',
          [deviceId]
        );

        if (deviceCheck.rows.length === 0) {
          return responseHandler.success(res, null, 'Device not found');
        }

        const deviceInternalId = deviceCheck.rows[0].id;

        // Now find session using device internal ID
        session = await database.query(`
          SELECT 
            ts.id as session_id, ts.device_id, ts.customer_name, ts.package_id,
            ts.duration_minutes, ts.start_time, ts.status, ts.amount_paid as total_amount,
            bp.name as package_name,
            EXTRACT(EPOCH FROM (NOW() - ts.start_time))/60 as elapsed_minutes,
            GREATEST(0, ts.duration_minutes - EXTRACT(EPOCH FROM (NOW() - ts.start_time))/60) as remaining_minutes
          FROM tv_sessions ts
          LEFT JOIN packages bp ON ts.package_id = bp.id
          WHERE ts.device_id = $1 AND ts.status = 'active'
          ORDER BY ts.start_time DESC
          LIMIT 1
        `, [deviceInternalId]);
        
      } catch (queryError) {
        logger.error('Error querying session', { deviceId, error: queryError.message });
        session = { rows: [] };
      }

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
  
  // GET /api/tv/discoveries - Get device discoveries pending approval
  router.get('/discoveries',
    rbacMiddleware.requirePermission('device_management'),
    async (req, res) => {
      try {
        const discoveries = await database.query(`
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

        logger.info('Device discoveries fetched', { count: discoveries.rows.length });
        return responseHandler.success(res, discoveries.rows, 'Device discoveries retrieved successfully');
      } catch (error) {
        logger.error('Error fetching device discoveries', { error: error.message });
        return responseHandler.error(res, 'Failed to fetch device discoveries', 500);
      }
    }
  );

  // GET /api/tv/devices - Get all TV devices
  router.get('/devices', 
    rbacMiddleware.requirePermission('device_management'),
    async (req, res) => {
      try {
        // First get all devices
        const devicesResult = await database.query(`
          SELECT 
            id, 
            device_id, 
            device_name, 
            location as device_location, 
            created_at, 
            updated_at,
            CASE 
              WHEN updated_at >= NOW() - INTERVAL '2 minutes' THEN 'online'
              ELSE 'offline'
            END as status
          FROM tv_devices
          ORDER BY device_name
        `);

        const devices = devicesResult.rows;

        // Then get active sessions for each device
        for (let device of devices) {
          try {
            // Use device internal ID (primary key) to find sessions
            // tv_sessions.device_id references tv_devices.id (INTEGER), not tv_devices.device_id (VARCHAR)
            const sessionResult = await database.query(`
              SELECT 
                ts.id as session_id,
                ts.customer_name,
                ts.package_id,
                ts.duration_minutes,
                ts.start_time,
                ts.end_time,
                ts.status as session_status,
                ts.amount_paid,
                CASE 
                  WHEN ts.status = 'active' THEN
                    GREATEST(0, ts.duration_minutes - EXTRACT(EPOCH FROM (NOW() - ts.start_time))/60)
                  ELSE 0
                END as remaining_minutes,
                bp.name as package_name
              FROM tv_sessions ts
              LEFT JOIN packages bp ON ts.package_id = bp.id
              WHERE ts.device_id = $1 AND ts.status IN ('active', 'pending_payment')
              ORDER BY ts.start_time DESC
              LIMIT 1
            `, [device.id]); // Use device.id (internal ID) instead of device.device_id (string ID)

            if (sessionResult.rows.length > 0) {
              const session = sessionResult.rows[0];
              Object.assign(device, {
                session_id: session.session_id,
                customer_name: session.customer_name,
                package_id: session.package_id,
                duration_minutes: session.duration_minutes,
                start_time: session.start_time,
                end_time: session.end_time,
                session_status: session.session_status,
                amount_paid: session.amount_paid,
                remaining_minutes: session.remaining_minutes,
                package_name: session.package_name
              });
            } else {
              // No active session
              Object.assign(device, {
                session_id: null,
                customer_name: null,
                package_id: null,
                duration_minutes: null,
                start_time: null,
                end_time: null,
                session_status: null,
                amount_paid: null,
                remaining_minutes: null,
                package_name: null
              });
            }
          } catch (sessionError) {
            // If session query fails, just set session fields to null
            logger.warn('Failed to get session for device', { 
              deviceId: device.device_id, 
              error: sessionError.message 
            });
            Object.assign(device, {
              session_id: null,
              customer_name: null,
              package_id: null,
              duration_minutes: null,
              start_time: null,
              end_time: null,
              session_status: null,
              amount_paid: null,
              remaining_minutes: null,
              package_name: null
            });
          }
        }

        return responseHandler.success(res, devices, 'Devices retrieved successfully');
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
            ts.amount_paid as total_amount, 0 as additional_amount, 0 as fnb_total,
            td.device_name, td.location,
            p.name as package_name, p.price as package_price
          FROM tv_sessions ts
          LEFT JOIN tv_devices td ON ts.device_id = td.id
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

  // POST /api/tv/sessions/debug - Debug session creation
  router.post('/sessions/debug', async (req, res) => {
    try {
      const { device_id, customer_name, package_id } = req.body;
      
      res.json({
        success: true,
        message: 'Debug info',
        data: {
          received: { device_id, customer_name, package_id },
          bodyType: typeof req.body,
          body: req.body
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        stack: error.stack
      });
    }
  });

  // POST /api/tv/sessions - Start new TV session
  router.post('/sessions', 
    rbacMiddleware.requirePermission('session_management'),
    async (req, res) => {
      try {
        const { device_id, customer_name, package_id } = req.body;
        
        logger.info('Starting session request', { device_id, customer_name, package_id });

        // Validate input
        if (!device_id || !customer_name || !package_id) {
          return responseHandler.error(res, 'Missing required fields: device_id, customer_name, package_id', 400);
        }

        // Validate device exists and is available
        logger.info('Checking device exists', { device_id });
        let deviceCheck;
        try {
          deviceCheck = await database.query(
            'SELECT id, device_name FROM tv_devices WHERE device_id = $1',
            [device_id]
          );
          logger.info('Device check query successful', { rowCount: deviceCheck.rows.length });
        } catch (deviceCheckError) {
          logger.error('Device check query failed', { 
            error: deviceCheckError.message,
            device_id,
            stack: deviceCheckError.stack 
          });
          throw deviceCheckError;
        }

        if (deviceCheck.rows.length === 0) {
          logger.warn('Device not found', { device_id });
          return responseHandler.error(res, 'Device not found or inactive', 404);
        }
        logger.info('Device found', { device: deviceCheck.rows[0] });

        // Check if device has active session using device internal ID
        const deviceInternalId = deviceCheck.rows[0].id; // INTEGER primary key from tv_devices
        logger.info('Checking for active sessions', { device_id, deviceInternalId });
        const activeSession = await database.query(
          'SELECT id FROM tv_sessions WHERE device_id = $1 AND status = $2',
          [deviceInternalId, 'active']
        );

        if (activeSession.rows.length > 0) {
          logger.warn('Device already has active session', { device_id, sessionId: activeSession.rows[0].id });
          return responseHandler.error(res, 'Device already has an active session', 409);
        }
        logger.info('No active session found for device', { device_id });

        // Get package details
        logger.info('Getting package details', { package_id });
        const packageInfo = await database.query(
          'SELECT id, name, duration_minutes, price FROM packages WHERE id = $1',
          [package_id]
        );

        if (packageInfo.rows.length === 0) {
          logger.warn('Package not found', { package_id });
          return responseHandler.error(res, 'Package not found or inactive', 404);
        }

        const pkg = packageInfo.rows[0];
        logger.info('Package found', { package: pkg });

        // Create new session
        logger.info('Creating new session', { 
          device_id, 
          customer_name, 
          package_id, 
          duration: pkg.duration_minutes, 
          price: pkg.price 
        });
        
        let newSession;
        try {
          // Since tv_sessions.device_id is INTEGER, we need to use the device's internal ID from tv_devices table
          // Get the device's internal ID (the auto-increment primary key)
          const deviceInternalId = deviceCheck.rows[0].id; // This is the INTEGER primary key from tv_devices
          
          logger.info('Using device internal ID for session', { 
            device_id_string: device_id,
            device_internal_id: deviceInternalId,
            device_check_result: deviceCheck.rows[0]
          });
          
          newSession = await database.query(`
            INSERT INTO tv_sessions 
              (device_id, customer_name, package_id, duration_minutes, start_time, status, amount_paid)
            VALUES ($1, $2, $3, $4, NOW(), 'active', $5)
            RETURNING *
          `, [deviceInternalId, customer_name, package_id, pkg.duration_minutes, pkg.price]);
          logger.info('Session INSERT successful', { sessionId: newSession.rows[0]?.id });
        } catch (insertError) {
          logger.error('Session INSERT failed', { 
            insertError: insertError.message,
            insertStack: insertError.stack,
            params: [deviceInternalId, customer_name, package_id, pkg.duration_minutes, pkg.price]
          });
          throw insertError;
        }

        logger.info('TV session started successfully', { 
          sessionId: newSession.rows[0].id,
          deviceId: device_id,
          customerName: customer_name,
          userId: req.user?.id 
        });

        return responseHandler.success(res, newSession.rows[0], 'Session started successfully');
      } catch (error) {
        logger.error('Error starting session', { 
          error: error.message,
          stack: error.stack,
          device_id: req.body?.device_id,
          customer_name: req.body?.customer_name,
          package_id: req.body?.package_id,
          reqBody: req.body
        });
        return res.status(500).json({
          success: false,
          message: `Failed to start session: ${error.message}`,
          details: error.message,
          timestamp: new Date().toISOString()
        });
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
            amount_paid = amount_paid + $2
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

  // POST /api/tv/devices/:deviceId/stop-session - Stop active session for device
  router.post('/devices/:deviceId/stop-session', 
    rbacMiddleware.requirePermission('session_management'),
    async (req, res) => {
      try {
        const { deviceId } = req.params;
        
        const result = await database.query(`
          UPDATE tv_sessions 
          SET status = $1, end_time = NOW() 
          WHERE device_id = (SELECT id FROM tv_devices WHERE device_id = $2) AND status = $3
        `, ['completed', deviceId, 'active']);

        logger.info('Active session stopped for device', { 
          deviceId, 
          rowsAffected: result.rowCount,
          userId: req.user?.id 
        });

        return responseHandler.success(res, {
          rows_affected: result.rowCount || 0
        }, 'Active session stopped successfully');
      } catch (error) {
        logger.error('Error stopping active session for device', { deviceId, error: error.message });
        return responseHandler.error(res, 'Failed to stop active session', 500);
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
  // GET /api/tv/products-for-order - Get products for F&B ordering
  router.get('/products-for-order', 
    rbacMiddleware.requirePermission('order_management'),
    async (req, res) => {
      try {
        const products = await database.query(`
          SELECT p.id, p.product_name, p.price, p.stock_quantity, p.image_url,
                 pc.category_name
          FROM products p
          LEFT JOIN product_categories pc ON p.category_id = pc.id
          WHERE p.is_available = true AND p.stock_quantity > 0
          ORDER BY pc.category_name, p.product_name
        `);

        logger.info('Products for order fetched', { count: products.rows.length });
        return responseHandler.success(res, products.rows, 'Products retrieved successfully');
      } catch (error) {
        logger.error('Error fetching products for order', { error: error.message });
        return responseHandler.error(res, 'Failed to fetch products', 500);
      }
    }
  );

  // GET /api/tv/sessions/:sessionId/orders - Get F&B orders for session
  router.get('/sessions/:sessionId/orders', 
    rbacMiddleware.requirePermission('order_management'),
    async (req, res) => {
      try {
        const { sessionId } = req.params;
        
        const orders = await database.query(`
          SELECT so.*, u.full_name as ordered_by_name
          FROM session_orders so
          LEFT JOIN users u ON so.ordered_by = u.id
          WHERE so.session_id = $1
          ORDER BY so.created_at DESC
        `, [sessionId]);

        logger.info('Session orders fetched', { sessionId, count: orders.rows.length });
        return responseHandler.success(res, orders.rows, 'Session orders retrieved successfully');
      } catch (error) {
        logger.error('Error fetching session orders', { sessionId: req.params.sessionId, error: error.message });
        return responseHandler.error(res, 'Failed to fetch session orders', 500);
      }
    }
  );

  // POST /api/tv/sessions/:sessionId/order - Create F&B order
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