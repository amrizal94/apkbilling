const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

/**
 * Authentication Controller
 * Handles authentication related HTTP requests
 */
class AuthController {
  constructor({ userRepository, logger, responseHandler, config }) {
    this.userRepository = userRepository;
    this.logger = logger;
    this.responseHandler = responseHandler;
    this.config = config;
  }

  async login(req, res) {
    try {
      const { username, password } = req.body;
      
      this.logger.info('POST /auth/login - Request received', { username });

      if (!username || !password) {
        return this.responseHandler.error(res, 'Username and password are required', 400);
      }

      // Find user
      this.logger.debug('Looking for user in database', { username });
      const user = await this.userRepository.findByUsername(username);
      if (!user) {
        this.logger.warn('User not found', { username });
        return this.responseHandler.error(res, 'Invalid credentials', 401);
      }
      
      this.logger.debug('User found', { userId: user.id, username: user.username, hasPassword: !!user.password });

      // Check if user is active
      if (!user.isActive) {
        return this.responseHandler.error(res, 'Account is deactivated', 401);
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return this.responseHandler.error(res, 'Invalid credentials', 401);
      }

      // Update last login
      try {
        await this.userRepository.update(user.id, {
          lastLogin: new Date()
        });
      } catch (updateError) {
        this.logger.warn('Failed to update last login', { 
          userId: user.id, 
          error: updateError.message 
        });
        // Continue with login even if last login update fails
      }

      // Generate JWT token
      const token = jwt.sign(
        { 
          id: user.id, 
          username: user.username, 
          roleId: user.roleId,
          roleName: user.role?.roleName || 'unknown'
        },
        this.config.jwt.secret,
        { expiresIn: this.config.jwt.expiresIn }
      );

      this.logger.info('User logged in successfully', { 
        userId: user.id, 
        username: user.username 
      });

      // Return user data without password
      const userData = {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        roleId: user.roleId,
        role: user.role,
        isActive: user.isActive,
        lastLogin: new Date()
      };

      return this.responseHandler.success(res, {
        user: userData,
        token,
        expiresIn: this.config.jwt.expiresIn
      }, 'Login successful');

    } catch (error) {
      this.logger.error('Error in login', { error: error.message, stack: error.stack });
      return this.responseHandler.error(res, 'Internal server error', 500);
    }
  }

  async profile(req, res) {
    try {
      const userId = req.user.id;
      
      this.logger.info('GET /auth/profile - Request received', { userId });

      const user = await this.userRepository.findById(userId);
      if (!user) {
        return this.responseHandler.error(res, 'User not found', 404);
      }

      // Return user data without password
      const userData = {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        roleId: user.roleId,
        role: user.role,
        isActive: user.isActive,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt
      };

      return this.responseHandler.success(res, userData, 'Profile retrieved successfully');

    } catch (error) {
      this.logger.error('Error in profile', { error: error.message, stack: error.stack });
      return this.responseHandler.error(res, 'Internal server error', 500);
    }
  }

  async refreshToken(req, res) {
    try {
      const { token } = req.body;
      
      if (!token) {
        return this.responseHandler.error(res, 'Token is required', 400);
      }

      // Verify current token
      const decoded = jwt.verify(token, this.config.jwt.secret);
      
      // Get fresh user data
      const user = await this.userRepository.findById(decoded.id);
      if (!user || !user.isActive) {
        return this.responseHandler.error(res, 'Invalid token', 401);
      }

      // Generate new token
      const newToken = jwt.sign(
        { 
          id: user.id, 
          username: user.username, 
          roleId: user.roleId,
          roleName: user.role?.roleName || 'unknown'
        },
        this.config.jwt.secret,
        { expiresIn: this.config.jwt.expiresIn }
      );

      this.logger.info('Token refreshed successfully', { userId: user.id });

      return this.responseHandler.success(res, {
        token: newToken,
        expiresIn: this.config.jwt.expiresIn
      }, 'Token refreshed successfully');

    } catch (error) {
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        return this.responseHandler.error(res, 'Invalid token', 401);
      }
      
      this.logger.error('Error in refreshToken', { error: error.message, stack: error.stack });
      return this.responseHandler.error(res, 'Internal server error', 500);
    }
  }

  async logout(req, res) {
    try {
      this.logger.info('POST /auth/logout - Request received', { userId: req.user?.id });

      // In a stateless JWT system, logout is handled client-side
      // But we can log the event for audit purposes
      
      return this.responseHandler.success(res, null, 'Logout successful');

    } catch (error) {
      this.logger.error('Error in logout', { error: error.message, stack: error.stack });
      return this.responseHandler.error(res, 'Internal server error', 500);
    }
  }
}

module.exports = AuthController;