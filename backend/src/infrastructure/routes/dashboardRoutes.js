const express = require('express');

/**
 * Dashboard & Reports Routes
 * Defines all dashboard and reporting API endpoints
 */
function createDashboardRoutes(container) {
  const router = express.Router();
  
  // Get dependencies from container
  const dashboardController = container.resolve('dashboardController');
  const authMiddleware = container.resolve('authMiddleware');
  const rbacMiddleware = container.resolve('rbacMiddleware');
  const responseHandler = container.resolve('responseHandler');
  const database = container.resolve('database');
  const logger = container.resolve('logger');

  // All dashboard routes require authentication
  router.use(authMiddleware.authenticate());

  // GET /api/reports/dashboard - Get dashboard data
  router.get('/dashboard', 
    rbacMiddleware.requirePermission('financial_reports'),
    (req, res) => dashboardController.getDashboardData(req, res)
  );

  // GET /api/reports/tv-billing - TV Billing report
  router.get('/tv-billing', 
    rbacMiddleware.requirePermission('financial_reports'),
    async (req, res) => {
      try {
        const { start_date, end_date, device_id } = req.query;
        
        let query = `
          SELECT 
            tv.id,
            tv.payment_notes,
            tv.start_time,
            tv.end_time,
            tv.duration_minutes,
            tv.amount_paid,
            tv.status,
            d.device_name,
            p.name as package_name,
            p.duration_minutes as package_duration,
            p.price as package_price,
            COALESCE(sp_additional.additional_minutes, 0) as additional_minutes,
            COALESCE(sp_additional.additional_amount, 0) as additional_amount,
            sp_details.packages_detail,
            sp_details.packages_breakdown
          FROM tv_sessions tv
          JOIN tv_devices d ON tv.device_id = d.id
          LEFT JOIN packages p ON tv.package_id = p.id
          LEFT JOIN (
            SELECT 
              session_id,
              SUM(CASE WHEN package_type = 'additional' THEN duration_minutes ELSE 0 END) as additional_minutes,
              SUM(CASE WHEN package_type = 'additional' THEN price ELSE 0 END) as additional_amount
            FROM session_packages 
            GROUP BY session_id
          ) sp_additional ON tv.id = sp_additional.session_id
          LEFT JOIN (
            SELECT 
              session_id,
              STRING_AGG(
                package_name || ' - ' || duration_minutes || ' menit',
                ' + ' ORDER BY added_at
              ) as packages_detail,
              JSON_AGG(
                JSON_BUILD_OBJECT(
                  'package_name', package_name,
                  'duration_minutes', duration_minutes,
                  'price', price,
                  'package_type', package_type
                ) ORDER BY added_at
              ) as packages_breakdown
            FROM session_packages
            GROUP BY session_id
          ) sp_details ON tv.id = sp_details.session_id
        `;
        
        const conditions = [];
        const params = [];
        
        if (start_date) {
          conditions.push(`DATE(tv.start_time) >= $${params.length + 1}`);
          params.push(start_date);
        }
        
        if (end_date) {
          conditions.push(`DATE(tv.start_time) <= $${params.length + 1}`);
          params.push(end_date);
        }
        
        if (device_id) {
          conditions.push(`tv.device_id = $${params.length + 1}`);
          params.push(device_id);
        }
        
        if (conditions.length > 0) {
          query += ' WHERE ' + conditions.join(' AND ');
        }
        
        query += ' ORDER BY tv.start_time DESC';
        
        const result = await database.query(query, params);
        const sessions = result.rows;
        
        // Summary statistics
        const totalRevenue = sessions.reduce((sum, session) => sum + parseFloat(session.amount_paid || 0), 0);
        const totalSessions = sessions.length;
        const activeSessions = sessions.filter(s => s.status === 'active').length;
        
        return responseHandler.success(res, {
          sessions,
          summary: {
            total_sessions: totalSessions,
            active_sessions: activeSessions,
            total_revenue: totalRevenue,
            average_session_value: totalSessions > 0 ? totalRevenue / totalSessions : 0
          }
        }, 'TV billing report retrieved successfully');
        
      } catch (error) {
        logger.error('Error fetching TV billing report', { error: error.message });
        return responseHandler.error(res, 'Failed to fetch TV billing report', 500);
      }
    }
  );

  // GET /api/reports/pos-sales - POS Sales report  
  router.get('/pos-sales', 
    rbacMiddleware.requirePermission('financial_reports'),
    async (req, res) => {
      try {
        const { start_date, end_date, category_id } = req.query;
        
        let query = `
          SELECT 
            o.id,
            o.order_number,
            o.customer_name,
            o.table_number,
            o.total_amount,
            o.status,
            o.order_type,
            o.created_at,
            COUNT(oi.id) as item_count,
            STRING_AGG(p.product_name || ' x' || oi.quantity, ', ') as items_detail
          FROM orders o
          LEFT JOIN order_items oi ON o.id = oi.order_id
          LEFT JOIN products p ON oi.product_id = p.id
        `;
        
        const conditions = [];
        const params = [];
        
        if (start_date) {
          conditions.push(`DATE(o.created_at) >= $${params.length + 1}`);
          params.push(start_date);
        }
        
        if (end_date) {
          conditions.push(`DATE(o.created_at) <= $${params.length + 1}`);
          params.push(end_date);
        }
        
        if (category_id) {
          conditions.push(`p.category_id = $${params.length + 1}`);
          params.push(category_id);
        }
        
        if (conditions.length > 0) {
          query += ' WHERE ' + conditions.join(' AND ');
        }
        
        query += `
          GROUP BY o.id, o.order_number, o.customer_name, o.table_number, 
                   o.total_amount, o.status, o.order_type, o.created_at
          ORDER BY o.created_at DESC
        `;
        
        const result = await database.query(query, params);
        const orders = result.rows;
        
        // Summary statistics
        const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.total_amount || 0), 0);
        const totalOrders = orders.length;
        const completedOrders = orders.filter(o => o.status === 'completed').length;
        
        return responseHandler.success(res, {
          orders,
          summary: {
            total_orders: totalOrders,
            completed_orders: completedOrders,
            total_revenue: totalRevenue,
            average_order_value: totalOrders > 0 ? totalRevenue / totalOrders : 0
          }
        }, 'POS sales report retrieved successfully');
        
      } catch (error) {
        logger.error('Error fetching POS sales report', { error: error.message });
        return responseHandler.error(res, 'Failed to fetch POS sales report', 500);
      }
    }
  );

  // GET /api/reports/financial-summary - Financial summary
  router.get('/financial-summary', 
    rbacMiddleware.requirePermission('financial_reports'),
    async (req, res) => {
      try {
        const { start_date, end_date } = req.query;
        
        // Get all transactions
        let query = `
          SELECT 
            transaction_type,
            SUM(amount) as total_amount,
            COUNT(*) as transaction_count,
            payment_method
          FROM transactions
        `;
        
        const conditions = [];
        const params = [];
        
        if (start_date) {
          conditions.push(`DATE(transaction_date) >= $${params.length + 1}`);
          params.push(start_date);
        }
        
        if (end_date) {
          conditions.push(`DATE(transaction_date) <= $${params.length + 1}`);
          params.push(end_date);
        }
        
        if (conditions.length > 0) {
          query += ' WHERE ' + conditions.join(' AND ');
        }
        
        query += ' GROUP BY transaction_type, payment_method ORDER BY transaction_type, payment_method';
        
        const result = await database.query(query, params);
        const transactions = result.rows;
        
        // Calculate totals
        const tvBillingRevenue = transactions
          .filter(t => t.transaction_type === 'tv_billing')
          .reduce((sum, t) => sum + parseFloat(t.total_amount), 0);
          
        const posRevenue = transactions
          .filter(t => t.transaction_type === 'cafe_order')
          .reduce((sum, t) => sum + parseFloat(t.total_amount), 0);
        
        const totalRevenue = tvBillingRevenue + posRevenue;
        const totalTransactions = transactions.reduce((sum, t) => sum + parseInt(t.transaction_count), 0);
        
        return responseHandler.success(res, {
          summary: {
            total_revenue: totalRevenue,
            tv_billing_revenue: tvBillingRevenue,
            pos_revenue: posRevenue,
            total_transactions: totalTransactions
          },
          breakdown: transactions
        }, 'Financial summary retrieved successfully');
        
      } catch (error) {
        logger.error('Error fetching financial summary', { error: error.message });
        return responseHandler.error(res, 'Failed to fetch financial summary', 500);
      }
    }
  );

  return router;
}

module.exports = createDashboardRoutes;