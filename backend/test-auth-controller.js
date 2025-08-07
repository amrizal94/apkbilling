require('dotenv').config();
const { createDIContainer } = require('./src/infrastructure/container/DIContainer');

async function testAuthController() {
  try {
    console.log('Testing AuthController directly...');
    
    // Create DI container
    const container = createDIContainer();
    
    // Get dependencies
    const database = container.resolve('database');
    const authController = container.resolve('authController');
    
    // Connect to database
    await database.connect();
    console.log('✅ Database connected');
    
    // Create mock request and response objects
    const req = {
      body: {
        username: 'admin',
        password: 'admin123'
      }
    };
    
    const res = {
      status: function(code) {
        this.statusCode = code;
        console.log('Response status:', code);
        return this;
      },
      json: function(data) {
        console.log('Response data:', JSON.stringify(data, null, 2));
        return this;
      }
    };
    
    console.log('Testing login method...');
    await authController.login(req, res);
    
    await database.disconnect();
    console.log('✅ Database disconnected');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testAuthController();