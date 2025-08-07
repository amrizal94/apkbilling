const express = require('express');

/**
 * Package Management Routes
 * Defines all package CRUD API endpoints
 */
function createPackageRoutes(container) {
  const router = express.Router();
  
  // Get dependencies from container
  const authMiddleware = container.resolve('authMiddleware');
  const rbacMiddleware = container.resolve('rbacMiddleware');
  const responseHandler = container.resolve('responseHandler');
  const database = container.resolve('database');
  const logger = container.resolve('logger');

  // All package routes require authentication
  router.use(authMiddleware.authenticate());

  // GET /api/packages - Get all packages
  router.get('/', 
    async (req, res) => {
      try {
        logger.info('GET packages request received', { query: req.query });
        
        const { active_only = 'false', limit = 50, offset = 0 } = req.query;
        
        let query = 'SELECT * FROM packages';
        const params = [];

        if (active_only === 'true') {
          query += ' WHERE is_active = true';
        }

        query += ' ORDER BY name LIMIT $1 OFFSET $2';
        const packages = await database.query(query, [parseInt(limit), parseInt(offset)]);

        logger.info('Packages query executed', { 
          query: query, 
          params: [parseInt(limit), parseInt(offset)],
          count: packages.rows.length 
        });

        return res.status(200).json({
          success: true,
          message: 'Packages retrieved successfully',
          data: packages.rows,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error('Error fetching packages', { error: error.message, stack: error.stack });
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch packages',
          timestamp: new Date().toISOString()
        });
      }
    }
  );

  // GET /api/packages/:packageId - Get package by ID
  router.get('/:packageId', 
    rbacMiddleware.requirePermission('package_management'),
    async (req, res) => {
      try {
        const { packageId } = req.params;

        const packageResult = await database.query(
          'SELECT * FROM packages WHERE id = $1',
          [packageId]
        );

        if (packageResult.rows.length === 0) {
          return responseHandler.error(res, 'Package not found', 404);
        }

        // Get detailed usage stats
        const usageStats = await database.query(`
          SELECT 
            COUNT(*) as total_sessions,
            COUNT(CASE WHEN status = 'active' THEN 1 END) as active_sessions,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_sessions,
            COALESCE(SUM(amount_paid), 0) as total_revenue,
            COALESCE(AVG(amount_paid), 0) as avg_revenue_per_session,
            MIN(start_time) as first_used,
            MAX(start_time) as last_used
          FROM tv_sessions 
          WHERE package_id = $1
        `, [packageId]);

        const packageData = {
          ...packageResult.rows[0],
          stats: usageStats.rows[0]
        };

        return responseHandler.success(res, packageData, 'Package details retrieved successfully');
      } catch (error) {
        logger.error('Error fetching package details', { error: error.message });
        return responseHandler.error(res, 'Failed to fetch package details', 500);
      }
    }
  );

  // POST /api/packages - Create new package
  router.post('/', 
    rbacMiddleware.requirePermission('package_management'),
    async (req, res) => {
      try {
        const { name, duration_minutes, price, description } = req.body;

        if (!name || !duration_minutes || price === undefined) {
          return responseHandler.error(res, 'Name, duration, and price are required', 400);
        }

        if (duration_minutes <= 0 || price < 0) {
          return responseHandler.error(res, 'Duration must be positive and price cannot be negative', 400);
        }

        // Check if package name already exists
        const existingPackage = await database.query(
          'SELECT id FROM packages WHERE name = $1 AND is_active = true',
          [name]
        );

        if (existingPackage.rows.length > 0) {
          return responseHandler.error(res, 'Package name already exists', 409);
        }

        const newPackage = await database.query(`
          INSERT INTO packages (name, duration_minutes, price, description, is_active)
          VALUES ($1, $2, $3, $4, true)
          RETURNING *
        `, [name, duration_minutes, price, description || null]);

        logger.info('Package created', { 
          packageId: newPackage.rows[0].id,
          packageName: name,
          userId: req.user?.id 
        });

        return responseHandler.success(res, newPackage.rows[0], 'Package created successfully');
      } catch (error) {
        logger.error('Error creating package', { error: error.message });
        return responseHandler.error(res, 'Failed to create package', 500);
      }
    }
  );

  // PUT /api/packages/:packageId - Update package
  router.put('/:packageId', 
    rbacMiddleware.requirePermission('package_management'),
    async (req, res) => {
      try {
        const { packageId } = req.params;
        const { name, duration_minutes, price, description, is_active } = req.body;

        // Check if package exists
        const existingPackage = await database.query(
          'SELECT * FROM packages WHERE id = $1',
          [packageId]
        );

        if (existingPackage.rows.length === 0) {
          return responseHandler.error(res, 'Package not found', 404);
        }

        // Check if package name already exists (excluding current package)
        if (name) {
          const duplicateName = await database.query(
            'SELECT id FROM packages WHERE name = $1 AND id != $2 AND is_active = true',
            [name, packageId]
          );

          if (duplicateName.rows.length > 0) {
            return responseHandler.error(res, 'Package name already exists', 409);
          }
        }

        // Build update query dynamically
        const updates = [];
        const params = [packageId];

        if (name !== undefined) {
          updates.push(`name = $${params.length + 1}`);
          params.push(name);
        }

        if (duration_minutes !== undefined) {
          if (duration_minutes <= 0) {
            return responseHandler.error(res, 'Duration must be positive', 400);
          }
          updates.push(`duration_minutes = $${params.length + 1}`);
          params.push(duration_minutes);
        }

        if (price !== undefined) {
          if (price < 0) {
            return responseHandler.error(res, 'Price cannot be negative', 400);
          }
          updates.push(`price = $${params.length + 1}`);
          params.push(price);
        }

        if (description !== undefined) {
          updates.push(`description = $${params.length + 1}`);
          params.push(description);
        }

        if (is_active !== undefined) {
          updates.push(`is_active = $${params.length + 1}`);
          params.push(is_active);
        }

        if (updates.length === 0) {
          return responseHandler.error(res, 'No fields to update', 400);
        }

        const query = `
          UPDATE packages 
          SET ${updates.join(', ')}, updated_at = NOW()
          WHERE id = $1 
          RETURNING *
        `;

        const updatedPackage = await database.query(query, params);

        logger.info('Package updated', { 
          packageId: packageId,
          userId: req.user?.id 
        });

        return responseHandler.success(res, updatedPackage.rows[0], 'Package updated successfully');
      } catch (error) {
        logger.error('Error updating package', { error: error.message });
        return responseHandler.error(res, 'Failed to update package', 500);
      }
    }
  );

  // PATCH /api/packages/:packageId/toggle - Toggle package status
  router.patch('/:packageId/toggle', 
    rbacMiddleware.requirePermission('package_management'),
    async (req, res) => {
      try {
        const { packageId } = req.params;

        // Check if package exists
        const existingPackage = await database.query(
          'SELECT * FROM packages WHERE id = $1',
          [packageId]
        );

        if (existingPackage.rows.length === 0) {
          return responseHandler.error(res, 'Package not found', 404);
        }

        const currentPackage = existingPackage.rows[0];
        const newStatus = !currentPackage.is_active;

        // Update package status
        const updatedPackage = await database.query(
          'UPDATE packages SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
          [newStatus, packageId]
        );

        logger.info('Package status toggled', { 
          packageId: packageId,
          packageName: currentPackage.name,
          oldStatus: currentPackage.is_active,
          newStatus: newStatus,
          userId: req.user?.id 
        });

        return responseHandler.success(res, updatedPackage.rows[0], `Package ${newStatus ? 'activated' : 'deactivated'} successfully`);
      } catch (error) {
        logger.error('Error toggling package status', { error: error.message });
        return responseHandler.error(res, 'Failed to toggle package status', 500);
      }
    }
  );

  // DELETE /api/packages/:packageId - Delete package (soft delete)
  router.delete('/:packageId', 
    rbacMiddleware.requirePermission('package_management'),
    async (req, res) => {
      try {
        const { packageId } = req.params;

        // Check if package exists
        const existingPackage = await database.query(
          'SELECT * FROM packages WHERE id = $1',
          [packageId]
        );

        if (existingPackage.rows.length === 0) {
          return responseHandler.error(res, 'Package not found', 404);
        }

        // Check if package has active sessions
        const activeSessions = await database.query(
          'SELECT COUNT(*) as count FROM tv_sessions WHERE package_id = $1 AND status = $2',
          [packageId, 'active']
        );

        if (parseInt(activeSessions.rows[0].count) > 0) {
          return responseHandler.error(res, 'Cannot delete package with active sessions', 409);
        }

        // Soft delete package
        const deletedPackage = await database.query(
          'UPDATE packages SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *',
          [packageId]
        );

        logger.info('Package deleted', { 
          packageId: packageId,
          packageName: existingPackage.rows[0].name,
          userId: req.user?.id 
        });

        return responseHandler.success(res, deletedPackage.rows[0], 'Package deleted successfully');
      } catch (error) {
        logger.error('Error deleting package', { error: error.message });
        return responseHandler.error(res, 'Failed to delete package', 500);
      }
    }
  );

  // GET /api/packages/:packageId/sessions - Get package usage sessions
  router.get('/:packageId/sessions', 
    rbacMiddleware.requirePermission('package_management'),
    async (req, res) => {
      try {
        const { packageId } = req.params;
        const { limit = 50, offset = 0, status = 'all' } = req.query;

        // Check if package exists
        const packageExists = await database.query(
          'SELECT id, name FROM packages WHERE id = $1',
          [packageId]
        );

        if (packageExists.rows.length === 0) {
          return responseHandler.error(res, 'Package not found', 404);
        }

        let query = `
          SELECT 
            ts.id, ts.device_id, ts.customer_name, ts.start_time, ts.end_time,
            ts.status, ts.total_amount, ts.duration_minutes,
            td.device_name, td.device_location
          FROM tv_sessions ts
          LEFT JOIN tv_devices td ON ts.device_id = td.device_id
          WHERE ts.package_id = $1
        `;

        const params = [packageId];

        if (status !== 'all') {
          query += ` AND ts.status = $${params.length + 1}`;
          params.push(status);
        }

        query += ` ORDER BY ts.start_time DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(parseInt(limit), parseInt(offset));

        const sessions = await database.query(query, params);

        return responseHandler.success(res, {
          package: packageExists.rows[0],
          sessions: sessions.rows
        }, 'Package sessions retrieved successfully');
      } catch (error) {
        logger.error('Error fetching package sessions', { error: error.message });
        return responseHandler.error(res, 'Failed to fetch package sessions', 500);
      }
    }
  );

  return router;
}

module.exports = createPackageRoutes;