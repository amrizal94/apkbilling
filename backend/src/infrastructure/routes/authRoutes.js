const express = require('express');

/**
 * Authentication Routes
 * Defines all authentication-related API endpoints
 */
function createAuthRoutes(container) {
  const router = express.Router();
  
  // Get dependencies from container
  const authController = container.resolve('authController');
  const authMiddleware = container.resolve('authMiddleware');

  // POST /api/auth/login - User login
  router.post('/login', (req, res) => authController.login(req, res));

  // POST /api/auth/refresh - Refresh token
  router.post('/refresh', (req, res) => authController.refreshToken(req, res));

  // GET /api/auth/profile - Get current user profile (requires authentication)
  router.get('/profile', 
    authMiddleware.authenticate(),
    (req, res) => authController.profile(req, res)
  );

  // POST /api/auth/logout - User logout (requires authentication)
  router.post('/logout', 
    authMiddleware.authenticate(),
    (req, res) => authController.logout(req, res)
  );

  return router;
}

module.exports = createAuthRoutes;