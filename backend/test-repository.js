require('dotenv').config();
const { createDIContainer } = require('./src/infrastructure/container/DIContainer');

async function testRepository() {
  try {
    console.log('Testing repository directly...');
    
    // Create DI container
    const container = createDIContainer();
    
    // Get dependencies
    const database = container.resolve('database');
    const userRepository = container.resolve('userRepository');
    const logger = container.resolve('logger');
    
    // Connect to database
    await database.connect();
    console.log('✅ Database connected');
    
    // Test findByUsername
    console.log('Finding user "admin"...');
    const user = await userRepository.findByUsername('admin');
    
    if (user) {
      console.log('✅ User found:');
      console.log('  ID:', user.id);
      console.log('  Username:', user.username);
      console.log('  Full Name:', user.fullName);
      console.log('  Role ID:', user.roleId);
      console.log('  Is Active:', user.isActive);
      console.log('  Has Password:', !!user.password);
      console.log('  Role:', user.role ? user.role.roleName : 'No role');
      
      // Test password comparison
      if (user.password) {
        const bcrypt = require('bcryptjs');
        const isMatch = await bcrypt.compare('admin123', user.password);
        console.log('  Password match (admin123):', isMatch);
      }
    } else {
      console.log('❌ User not found');
    }
    
    await database.disconnect();
    console.log('✅ Database disconnected');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testRepository();