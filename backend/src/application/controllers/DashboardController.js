/**
 * Dashboard Controller
 * Handles dashboard and reporting HTTP requests
 */
class DashboardController {
  constructor({
    getDashboardDataUseCase,
    logger,
    responseHandler
  }) {
    this.getDashboardDataUseCase = getDashboardDataUseCase;
    this.logger = logger;
    this.responseHandler = responseHandler;
  }

  async getDashboardData(req, res) {
    try {
      this.logger.info('GET /reports/dashboard - Request received', { 
        userId: req.user?.id,
        username: req.user?.username 
      });

      const dashboardData = await this.getDashboardDataUseCase.execute();

      return this.responseHandler.success(res, dashboardData, 'Dashboard data retrieved successfully');

    } catch (error) {
      this.logger.error('Error in getDashboardData', { 
        error: error.message, 
        stack: error.stack,
        userId: req.user?.id 
      });
      return this.responseHandler.error(res, 'Failed to fetch dashboard data', 500);
    }
  }

  async getHealthStatus(req, res) {
    try {
      this.logger.info('GET /api/health - Request received');

      const healthData = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.APP_VERSION || '2.0.0',
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
      };

      return this.responseHandler.success(res, healthData, 'System is healthy');

    } catch (error) {
      this.logger.error('Error in getHealthStatus', { error: error.message });
      return this.responseHandler.error(res, 'Health check failed', 500);
    }
  }
}

module.exports = DashboardController;