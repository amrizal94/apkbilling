const express = require('express');

/**
 * Roles Routes
 * Defines all role-related API endpoints
 */
function createRolesRoutes(container) {
  const router = express.Router();
  
  // Get dependencies from container
  const authMiddleware = container.resolve('authMiddleware');
  const rbacMiddleware = container.resolve('rbacMiddleware');
  const responseHandler = container.resolve('responseHandler');
  const database = container.resolve('database');
  const logger = container.resolve('logger');

  // All role routes require authentication and permission
  router.use(authMiddleware.authenticate());

  // GET /api/roles - Get all roles
  router.get('/', 
    rbacMiddleware.requirePermission('user_management'),
    async (req, res) => {
      try {
        const result = await database.query('SELECT * FROM roles WHERE is_active = true ORDER BY id');
        
        return responseHandler.success(res, result.rows, 'Roles retrieved successfully');
      } catch (error) {
        logger.error('Error fetching roles', { error: error.message });
        return responseHandler.error(res, 'Failed to fetch roles', 500);
      }
    }
  );

  return router;
}

module.exports = createRolesRoutes;