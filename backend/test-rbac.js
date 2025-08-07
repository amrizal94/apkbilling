require('dotenv').config();
const { createDIContainer } = require('./src/infrastructure/container/DIContainer');

async function testRBAC() {
  try {
    console.log('Testing RBAC middleware...');
    
    // Create DI container
    const container = createDIContainer();
    
    // Get RBAC middleware
    const rbacMiddleware = container.resolve('rbacMiddleware');
    
    // Create mock request object with user permissions
    const req = {
      user: {
        id: 1,
        username: 'admin',
        roleId: 1,
        roleName: 'super_admin',
        permissions: {
          "pos_system": true,
          "tv_management": true,
          "purchase_orders": true,
          "stock_movements": true,
          "system_settings": true,
          "user_management": true,
          "delete_operations": true,
          "financial_reports": true,
          "package_management": true,
          "supplier_management": true
        }
      }
    };

    const res = {
      status: function(code) {
        this.statusCode = code;
        console.log('Response status:', code);
        return this;
      },
      json: function(data) {
        console.log('Response:', data);
        return this;
      }
    };

    const next = function() {
      console.log('✅ Access granted - next() called');
    };

    console.log('Testing permission "user_management"...');
    const middleware = rbacMiddleware.requirePermission('user_management');
    
    // Test the middleware
    middleware(req, res, next);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testRBAC();