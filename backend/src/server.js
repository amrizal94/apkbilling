require('dotenv').config();
const { createDIContainer } = require('./infrastructure/container/DIContainer');

/**
 * APK Billing System - Clean Architecture Server
 * Entry point for the application using dependency injection
 */

// Global error handlers
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

async function startServer() {
  try {
    // Create DI container
    const container = createDIContainer();
    
    // Resolve dependencies
    const logger = container.resolve('logger');
    const database = container.resolve('database');
    const cacheService = container.resolve('cacheService');
    const socketService = container.resolve('socketService');
    const app = container.resolve('app');
    
    // Initialize infrastructure
    logger.info('Initializing APK Billing System', {
      version: process.env.APP_VERSION || '2.0.0',
      environment: process.env.NODE_ENV || 'development'
    });

    // Initialize database
    logger.info('Connecting to database...');
    await database.connect();
    logger.info('Database connected successfully');

    // Initialize cache (optional)
    if (process.env.ENABLE_REDIS !== 'false') {
      logger.info('Connecting to cache...');
      try {
        await Promise.race([
          cacheService.connect(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Cache connection timeout')), 3000)
          )
        ]);
        logger.info('Cache connected successfully');
      } catch (error) {
        logger.warn('Cache connection failed, continuing without cache', { error: error.message });
      }
    } else {
      logger.info('Redis disabled, skipping cache connection');
    }

    // Run database migrations if needed
    if (process.env.AUTO_MIGRATE === 'true') {
      logger.info('Running database migrations...');
      await database.migrate();
      logger.info('Database migrations completed');
    }

    // Start HTTP server
    const port = process.env.PORT || 3000;
    const server = app.listen(port, () => {
      logger.info('Server started successfully', { 
        port, 
        environment: process.env.NODE_ENV,
        pid: process.pid 
      });
    });

    // Initialize Socket.IO
    socketService.initialize(server);
    logger.info('Socket.IO initialized successfully');

    // Graceful shutdown
    const gracefulShutdown = async (signal) => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);

      server.close(async () => {
        try {
          logger.info('HTTP server closed');

          // Close database connections
          await database.disconnect();
          logger.info('Database disconnected');

          // Close cache connections
          try {
            await cacheService.disconnect();
            logger.info('Cache disconnected');
          } catch (error) {
            logger.warn('Cache disconnect failed', { error: error.message });
          }

          logger.info('Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown', { error: error.message });
          process.exit(1);
        }
      });

      // Force exit if graceful shutdown takes too long
      setTimeout(() => {
        logger.error('Graceful shutdown timeout, forcing exit');
        process.exit(1);
      }, 10000);
    };

    // Register shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Health monitoring
    if (process.env.ENABLE_HEALTH_MONITORING === 'true') {
      setInterval(async () => {
        try {
          const memUsage = process.memoryUsage();
          logger.debug('Health check', {
            uptime: process.uptime(),
            memory: {
              rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
              heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
              heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB'
            }
          });
        } catch (error) {
          logger.error('Health check failed', { error: error.message });
        }
      }, 60000); // Every minute
    }

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();