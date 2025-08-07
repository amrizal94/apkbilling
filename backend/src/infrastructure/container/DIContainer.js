const { createContainer, asClass, asFunction, asValue } = require('awilix');

// Infrastructure
const Database = require('../database/Database');
const CacheService = require('../services/CacheService');
const Logger = require('../services/Logger');
const EventPublisher = require('../services/EventPublisher');
const ResponseHandler = require('../http/ResponseHandler');
const SocketService = require('../socket/SocketService');

// Repositories
const UserRepository = require('../repositories/UserRepository');
const RoleRepository = require('../repositories/RoleRepository');

// Use Cases
const CreateUserUseCase = require('../../domain/usecases/user/CreateUserUseCase');
const GetAllUsersUseCase = require('../../domain/usecases/user/GetAllUsersUseCase');
const GetUserByIdUseCase = require('../../domain/usecases/user/GetUserByIdUseCase');
const UpdateUserUseCase = require('../../domain/usecases/user/UpdateUserUseCase');
const DeleteUserUseCase = require('../../domain/usecases/user/DeleteUserUseCase');
const ToggleUserStatusUseCase = require('../../domain/usecases/user/ToggleUserStatusUseCase');
const ChangePasswordUseCase = require('../../domain/usecases/user/ChangePasswordUseCase');
const GetDashboardDataUseCase = require('../../domain/usecases/dashboard/GetDashboardDataUseCase');

// Controllers
const UserController = require('../../application/controllers/UserController');
const AuthController = require('../../application/controllers/AuthController');
const DashboardController = require('../../application/controllers/DashboardController');

// Middleware
const AuthMiddleware = require('../middleware/AuthMiddleware');
const RBACMiddleware = require('../middleware/RBACMiddleware');

/**
 * Dependency Injection Container Setup
 * Configures all application dependencies using Awilix
 */
function createDIContainer() {
  const container = createContainer();

  // Configuration
  container.register({
    config: asValue({
      database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5432,
        name: process.env.DB_NAME || 'apkbilling_dev',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
        maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS) || 10,
        connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 2000,
        ssl: process.env.DB_SSL === 'true',
        logging: process.env.DB_LOGGING === 'true'
      },
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || '',
        db: parseInt(process.env.REDIS_DB) || 1,
        keyPrefix: process.env.REDIS_KEY_PREFIX || 'apkbilling:',
        ttl: parseInt(process.env.REDIS_TTL) || 3600
      },
      jwt: {
        secret: process.env.JWT_SECRET || 'dev-jwt-secret-key',
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
      },
      app: {
        name: process.env.APP_NAME || 'APK Billing System',
        version: process.env.APP_VERSION || '2.0.0',
        environment: process.env.NODE_ENV || 'development',
        port: parseInt(process.env.PORT) || 3000
      },
      security: {
        bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
        rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW) || 900000,
        rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX) || 100
      }
    })
  });

  // Infrastructure Services
  container.register({
    logger: asClass(Logger).singleton(),
    database: asClass(Database).singleton(),
    cacheService: asClass(CacheService).singleton(),
    eventPublisher: asClass(EventPublisher).singleton(),
    responseHandler: asClass(ResponseHandler).singleton(),
    socketService: asClass(SocketService).singleton()
  });

  // Repositories
  container.register({
    userRepository: asClass(UserRepository).singleton(),
    roleRepository: asClass(RoleRepository).singleton()
  });

  // Use Cases
  container.register({
    createUserUseCase: asClass(CreateUserUseCase).singleton(),
    getAllUsersUseCase: asClass(GetAllUsersUseCase).singleton(),
    getUserByIdUseCase: asClass(GetUserByIdUseCase).singleton(),
    updateUserUseCase: asClass(UpdateUserUseCase).singleton(),
    deleteUserUseCase: asClass(DeleteUserUseCase).singleton(),
    toggleUserStatusUseCase: asClass(ToggleUserStatusUseCase).singleton(),
    changePasswordUseCase: asClass(ChangePasswordUseCase).singleton(),
    getDashboardDataUseCase: asClass(GetDashboardDataUseCase).singleton()
  });

  // Controllers
  container.register({
    userController: asClass(UserController).singleton(),
    authController: asClass(AuthController).singleton(),
    dashboardController: asClass(DashboardController).singleton()
  });

  // Middleware
  container.register({
    authMiddleware: asClass(AuthMiddleware).singleton(),
    rbacMiddleware: asClass(RBACMiddleware).singleton()
  });

  // Express app factory
  container.register({
    app: asFunction(({ 
      userController, 
      authController,
      authMiddleware,
      rbacMiddleware,
      logger 
    }) => {
      const express = require('express');
      const cors = require('cors');
      const rateLimit = require('express-rate-limit');
      
      const app = express();

      // Basic middleware
      app.use(cors({
        origin: process.env.CORS_ORIGIN || '*',
        credentials: true
      }));
      
      app.use(express.json({ limit: '10mb' }));
      app.use(express.urlencoded({ extended: true, limit: '10mb' }));

      // Rate limiting
      const limiter = rateLimit({
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 900000, // 15 minutes
        max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
        message: 'Too many requests from this IP, please try again later'
      });
      app.use('/api', limiter);

      // Request logging
      app.use((req, res, next) => {
        logger.info('HTTP Request', {
          method: req.method,
          url: req.url,
          userAgent: req.get('User-Agent'),
          ip: req.ip
        });
        next();
      });

      // Health check
      app.get('/api/health', (req, res) => {
        res.json({
          success: true,
          message: 'Server is healthy',
          timestamp: new Date().toISOString(),
          version: process.env.APP_VERSION || '2.0.0'
        });
      });

      // API Routes
      const createUserRoutes = require('../routes/userRoutes');
      const createAuthRoutes = require('../routes/authRoutes');
      const createDashboardRoutes = require('../routes/dashboardRoutes');
      const createTVRoutes = require('../routes/tvRoutes');
      const createPOSRoutes = require('../routes/posRoutes');
      const createPackageRoutes = require('../routes/packageRoutes');
      const createSettingsRoutes = require('../routes/settingsRoutes');
      const createSupplierRoutes = require('../routes/supplierRoutes');
      const createPurchaseRoutes = require('../routes/purchaseRoutes');
      const createRolesRoutes = require('../routes/rolesRoutes');
      
      app.use('/api/auth', createAuthRoutes(container));
      app.use('/api/users', createUserRoutes(container));
      app.use('/api/roles', createRolesRoutes(container));
      app.use('/api/reports', createDashboardRoutes(container));
      app.use('/api/tv', createTVRoutes(container));
      app.use('/api/pos', createPOSRoutes(container));
      app.use('/api/packages', createPackageRoutes(container));
      app.use('/api/settings', createSettingsRoutes(container));
      app.use('/api/suppliers', createSupplierRoutes(container));
      app.use('/api/purchases', createPurchaseRoutes(container));

      // 404 handler
      app.use('*', (req, res) => {
        res.status(404).json({
          success: false,
          message: 'Endpoint not found'
        });
      });

      // Global error handler
      app.use((err, req, res, next) => {
        logger.error('Unhandled error', { 
          error: err.message, 
          stack: err.stack,
          url: req.url,
          method: req.method
        });
        
        res.status(500).json({
          success: false,
          message: 'Internal server error',
          error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
      });

      return app;
    }).singleton()
  });

  return container;
}

module.exports = { createDIContainer };