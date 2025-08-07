const express = require('express');

/**
 * User Routes
 * Defines all user-related API endpoints
 */
function createUserRoutes(container) {
  const router = express.Router();
  
  // Get dependencies from container
  const userController = container.resolve('userController');
  const authMiddleware = container.resolve('authMiddleware');
  const rbacMiddleware = container.resolve('rbacMiddleware');

  // All user routes require authentication
  router.use(authMiddleware.authenticate());

  // GET /api/users/roles - Get all roles (special endpoint)
  router.get('/roles', 
    rbacMiddleware.requirePermission('user_management'),
    async (req, res) => {
      try {
        const database = container.resolve('database');
        const result = await database.query('SELECT * FROM roles WHERE is_active = true ORDER BY id');
        
        return res.json({
          success: true,
          message: 'Roles retrieved successfully',
          data: result.rows,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch roles',
          timestamp: new Date().toISOString()
        });
      }
    }
  );

  // GET /api/users - Get all users
  router.get('/', 
    rbacMiddleware.requirePermission('user_management'),
    (req, res) => userController.getAllUsers(req, res)
  );

  // POST /api/users - Create new user
  router.post('/', 
    rbacMiddleware.requirePermission('user_management'),
    (req, res) => userController.createUser(req, res)
  );

  // GET /api/users/:id - Get user by ID
  router.get('/:id', 
    rbacMiddleware.requireSelfOrPermission('user_management'),
    (req, res) => userController.getUserById(req, res)
  );

  // PUT /api/users/:id - Update user
  router.put('/:id', 
    rbacMiddleware.requireSelfOrPermission('user_management'),
    (req, res) => userController.updateUser(req, res)
  );

  // DELETE /api/users/:id - Delete user
  router.delete('/:id', 
    rbacMiddleware.requirePermission('user_management'),
    (req, res) => userController.deleteUser(req, res)
  );

  // PATCH /api/users/:id/toggle - Toggle user status (activate/deactivate)
  router.patch('/:id/toggle', 
    rbacMiddleware.requirePermission('user_management'),
    (req, res) => userController.toggleUserStatus(req, res)
  );

  // PATCH /api/users/:id/password - Change user password
  router.patch('/:id/password', 
    rbacMiddleware.requireSelfOrPermission('user_management'),
    (req, res) => userController.changePassword(req, res)
  );

  return router;
}

module.exports = createUserRoutes;