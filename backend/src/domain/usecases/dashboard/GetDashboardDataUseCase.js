/**
 * Get Dashboard Data Use Case
 * Retrieves dashboard statistics and summary data
 */
class GetDashboardDataUseCase {
  constructor({ database, logger }) {
    this.database = database;
    this.logger = logger;
  }

  async execute() {
    try {
      this.logger.debug('Fetching dashboard data');

      const dashboardData = {
        summary: await this._getSummaryStats(),
        recentActivities: await this._getRecentActivities(),
        revenueChart: await this._getRevenueChart(),
        topPackages: await this._getTopPackages(),
        systemStatus: await this._getSystemStatus(),
        timestamp: new Date().toISOString()
      };

      this.logger.debug('Dashboard data retrieved successfully');
      
      return dashboardData;
    } catch (error) {
      this.logger.error('GetDashboardDataUseCase failed', { error: error.message });
      throw error;
    }
  }

  async _getSummaryStats() {
    try {
      // Get today's stats
      const today = new Date().toISOString().split('T')[0];
      
      const queries = await Promise.all([
        // Active TV sessions
        this.database.query(`
          SELECT COUNT(*) as count 
          FROM tv_sessions 
          WHERE status = 'active'
        `),
        
        // Today's revenue from TV sessions
        this.database.query(`
          SELECT COALESCE(SUM(amount_paid), 0) as total 
          FROM tv_sessions 
          WHERE DATE(start_time) = $1 AND status IN ('completed', 'active')
        `, [today]),
        
        // Today's POS orders
        this.database.query(`
          SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total
          FROM orders 
          WHERE DATE(created_at) = $1
        `, [today]),
        
        // Total registered devices
        this.database.query(`
          SELECT COUNT(*) as count 
          FROM tv_devices
        `)
      ]);

      return {
        activeSessions: parseInt(queries[0].rows[0]?.count || 0),
        todayRevenue: parseFloat(queries[1].rows[0]?.total || 0),
        todayOrders: parseInt(queries[2].rows[0]?.count || 0),
        todayOrdersRevenue: parseFloat(queries[2].rows[0]?.total || 0),
        totalDevices: parseInt(queries[3].rows[0]?.count || 0)
      };
    } catch (error) {
      this.logger.error('Error getting summary stats', { error: error.message });
      return {
        activeSessions: 0,
        todayRevenue: 0,
        todayOrders: 0,
        todayOrdersRevenue: 0,
        totalDevices: 0
      };
    }
  }

  async _getRecentActivities() {
    try {
      // Get recent TV sessions and orders
      const activities = await this.database.query(`
        SELECT 
          'tv_session' as type,
          device_id as identifier,
          'TV Session' as activity,
          total_amount as amount,
          start_time as timestamp,
          status
        FROM tv_sessions 
        WHERE start_time >= NOW() - INTERVAL '24 hours'
        
        UNION ALL
        
        SELECT 
          'pos_order' as type,
          id::text as identifier,
          'POS Order' as activity,
          total_amount as amount,
          created_at as timestamp,
          status
        FROM orders 
        WHERE created_at >= NOW() - INTERVAL '24 hours'
        
        ORDER BY timestamp DESC 
        LIMIT 10
      `);

      return activities.rows.map(activity => ({
        type: activity.type,
        identifier: activity.identifier,
        activity: activity.activity,
        amount: parseFloat(activity.amount || 0),
        timestamp: activity.timestamp,
        status: activity.status
      }));
    } catch (error) {
      this.logger.error('Error getting recent activities', { error: error.message });
      return [];
    }
  }

  async _getRevenueChart() {
    try {
      // Get last 7 days revenue
      const revenueData = await this.database.query(`
        WITH RECURSIVE dates AS (
          SELECT CURRENT_DATE - INTERVAL '6 days' as date
          UNION ALL
          SELECT date + INTERVAL '1 day'
          FROM dates
          WHERE date < CURRENT_DATE
        ),
        tv_revenue AS (
          SELECT 
            DATE(start_time) as date,
            COALESCE(SUM(amount_paid), 0) as tv_amount
          FROM tv_sessions
          WHERE start_time >= CURRENT_DATE - INTERVAL '6 days'
            AND status IN ('completed', 'active')
          GROUP BY DATE(start_time)
        ),
        pos_revenue AS (
          SELECT 
            DATE(created_at) as date,
            COALESCE(SUM(total_amount), 0) as pos_amount
          FROM orders
          WHERE created_at >= CURRENT_DATE - INTERVAL '6 days'
          GROUP BY DATE(created_at)
        )
        SELECT 
          d.date,
          COALESCE(tv.tv_amount, 0) as tv_revenue,
          COALESCE(pos.pos_amount, 0) as pos_revenue,
          COALESCE(tv.tv_amount, 0) + COALESCE(pos.pos_amount, 0) as total_revenue
        FROM dates d
        LEFT JOIN tv_revenue tv ON d.date = tv.date
        LEFT JOIN pos_revenue pos ON d.date = pos.date
        ORDER BY d.date
      `);

      return revenueData.rows.map(row => ({
        date: row.date,
        tvRevenue: parseFloat(row.tv_revenue || 0),
        posRevenue: parseFloat(row.pos_revenue || 0),
        totalRevenue: parseFloat(row.total_revenue || 0)
      }));
    } catch (error) {
      this.logger.error('Error getting revenue chart data', { error: error.message });
      return [];
    }
  }

  async _getTopPackages() {
    try {
      const topPackages = await this.database.query(`
        SELECT 
          p.name,
          p.duration_minutes,
          p.price,
          COUNT(ts.id) as usage_count,
          SUM(ts.amount_paid) as total_revenue
        FROM packages p
        LEFT JOIN tv_sessions ts ON p.id = ts.package_id
          AND ts.start_time >= NOW() - INTERVAL '7 days'
        WHERE p.is_active = true
        GROUP BY p.id, p.name, p.duration_minutes, p.price
        ORDER BY usage_count DESC, total_revenue DESC
        LIMIT 5
      `);

      return topPackages.rows.map(pkg => ({
        name: pkg.name,
        duration: parseInt(pkg.duration_minutes),
        price: parseFloat(pkg.price),
        usageCount: parseInt(pkg.usage_count || 0),
        totalRevenue: parseFloat(pkg.total_revenue || 0)
      }));
    } catch (error) {
      this.logger.error('Error getting top packages', { error: error.message });
      return [];
    }
  }

  async _getSystemStatus() {
    try {
      const systemChecks = await Promise.all([
        // Database health
        this.database.healthCheck(),
        
        // Device status
        this.database.query(`
          SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN last_heartbeat >= NOW() - INTERVAL '5 minutes' THEN 1 ELSE 0 END) as online
          FROM tv_devices
        `),
        
        // Pending orders
        this.database.query(`
          SELECT COUNT(*) as count 
          FROM orders 
          WHERE status = 'pending'
        `)
      ]);

      const deviceStatus = systemChecks[1].rows[0];
      
      return {
        database: systemChecks[0].status === 'healthy' ? 'healthy' : 'unhealthy',
        devicesTotal: parseInt(deviceStatus?.total || 0),
        devicesOnline: parseInt(deviceStatus?.online || 0),
        pendingOrders: parseInt(systemChecks[2].rows[0]?.count || 0)
      };
    } catch (error) {
      this.logger.error('Error getting system status', { error: error.message });
      return {
        database: 'unknown',
        devicesTotal: 0,
        devicesOnline: 0,
        pendingOrders: 0
      };
    }
  }
}

module.exports = GetDashboardDataUseCase;