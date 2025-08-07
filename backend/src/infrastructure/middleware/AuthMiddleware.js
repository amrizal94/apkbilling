const jwt = require('jsonwebtoken');

/**
 * Authentication Middleware
 * Validates JWT tokens and extracts user information
 */
class AuthMiddleware {
  constructor({ userRepository, logger, config }) {
    this.userRepository = userRepository;
    this.logger = logger;
    this.config = config;
  }

  authenticate() {
    return async (req, res, next) => {
      try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
          return res.status(401).json({
            success: false,
            message: 'No token provided'
          });
        }

        const token = authHeader.startsWith('Bearer ') 
          ? authHeader.substring(7) 
          : authHeader;

        if (!token) {
          return res.status(401).json({
            success: false,
            message: 'Invalid token format'
          });
        }

        // Verify JWT token
        const decoded = jwt.verify(token, this.config.jwt.secret);
        
        // Get fresh user data
        const user = await this.userRepository.findById(decoded.id);
        
        if (!user) {
          return res.status(401).json({
            success: false,
            message: 'User not found'
          });
        }

        if (!user.isActive) {
          return res.status(401).json({
            success: false,
            message: 'Account is deactivated'
          });
        }

        // Attach user to request
        req.user = {
          id: user.id,
          username: user.username,
          roleId: user.roleId,
          roleName: user.role?.roleName || 'unknown',
          permissions: user.role?.permissions || {}
        };

        next();

      } catch (error) {
        this.logger.error('Authentication failed', { 
          error: error.message,
          url: req.url,
          method: req.method
        });

        if (error.name === 'JsonWebTokenError') {
          return res.status(401).json({
            success: false,
            message: 'Invalid token'
          });
        }

        if (error.name === 'TokenExpiredError') {
          return res.status(401).json({
            success: false,
            message: 'Token expired'
          });
        }

        return res.status(500).json({
          success: false,
          message: 'Authentication error'
        });
      }
    };
  }

  // Optional middleware for routes that can work with or without authentication
  optionalAuth() {
    return async (req, res, next) => {
      try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
          return next();
        }

        const token = authHeader.startsWith('Bearer ') 
          ? authHeader.substring(7) 
          : authHeader;

        if (!token) {
          return next();
        }

        // Verify JWT token
        const decoded = jwt.verify(token, this.config.jwt.secret);
        
        // Get user data
        const user = await this.userRepository.findById(decoded.id);
        
        if (user && user.isActive) {
          req.user = {
            id: user.id,
            username: user.username,
            roleId: user.roleId,
            roleName: user.role?.roleName || 'unknown',
            permissions: user.role?.permissions || {}
          };
        }

        next();

      } catch (error) {
        // For optional auth, we just continue without setting req.user
        this.logger.debug('Optional auth failed', { error: error.message });
        next();
      }
    };
  }
}

module.exports = AuthMiddleware;