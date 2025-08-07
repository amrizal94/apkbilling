#!/usr/bin/env node

// Test script untuk koneksi database dan auto migration
const path = require('path');
require('dotenv').config();

console.log('🧪 APK Billing Database Connection Test');
console.log('=====================================');
console.log('');

// Print environment info
console.log('📋 Environment Configuration:');
console.log(`   Node Environment: ${process.env.NODE_ENV}`);
console.log(`   Database Host: ${process.env.DB_HOST}`);
console.log(`   Database Port: ${process.env.DB_PORT}`);
console.log(`   Database Name: ${process.env.DB_NAME}`);
console.log(`   Database User: ${process.env.DB_USER}`);
console.log(`   Max Connections: ${process.env.DB_MAX_CONNECTIONS}`);
console.log('');

async function testDatabaseConnection() {
    try {
        console.log('🔌 Testing PostgreSQL Connection...');
        
        // Test basic database connection
        const db = require('./config/database');
        
        const [rows] = await db.execute('SELECT NOW() as current_time, version() as pg_version');
        
        console.log('✅ Database Connection Successful!');
        console.log(`   Current Time: ${rows[0].current_time}`);
        console.log(`   PostgreSQL Version: ${rows[0].pg_version.split(' ')[0]} ${rows[0].pg_version.split(' ')[1]}`);
        console.log('');
        
        return true;
    } catch (error) {
        console.error('❌ Database Connection Failed!');
        console.error(`   Error: ${error.message}`);
        console.error(`   Code: ${error.code}`);
        console.log('');
        
        if (error.code === 'ECONNREFUSED') {
            console.log('💡 Troubleshooting Tips:');
            console.log('   1. Make sure PostgreSQL is running');
            console.log('   2. Check if port 5432 is accessible');
            console.log('   3. Verify database credentials');
            console.log('   4. Try: systemctl start postgresql (Linux)');
            console.log('   5. Try: brew services start postgresql (Mac)');
            console.log('   6. Try: net start postgresql-x64-14 (Windows)');
        } else if (error.code === '3D000') {
            console.log('💡 Database does not exist, will be created during migration');
        } else if (error.code === '28P01') {
            console.log('💡 Authentication failed - check username/password');
        }
        
        return false;
    }
}

async function testMigrationSystem() {
    try {
        console.log('🚀 Testing Auto Migration System...');
        
        const DatabaseMigrator = require('./migrations/migrator');
        const migrator = new DatabaseMigrator();
        
        // Test migration initialization
        await migrator.initialize();
        
        console.log('✅ Auto Migration System Working!');
        console.log('');
        
        return true;
    } catch (error) {
        console.error('❌ Migration System Failed!');
        console.error(`   Error: ${error.message}`);
        console.log('');
        return false;
    }
}

async function testDataRetrieval() {
    try {
        console.log('📊 Testing Data Retrieval...');
        
        const db = require('./config/database');
        
        // Test packages
        const [packages] = await db.execute('SELECT COUNT(*) as count FROM packages');
        console.log(`   Packages: ${packages[0].count} records`);
        
        // Test products
        const [products] = await db.execute('SELECT COUNT(*) as count FROM products');
        console.log(`   Products: ${products[0].count} records`);
        
        // Test users
        const [users] = await db.execute('SELECT COUNT(*) as count FROM users');
        console.log(`   Users: ${users[0].count} records`);
        
        // Test TV devices
        const [devices] = await db.execute('SELECT COUNT(*) as count FROM tv_devices');
        console.log(`   TV Devices: ${devices[0].count} records`);
        
        console.log('✅ Data Retrieval Successful!');
        console.log('');
        
        return true;
    } catch (error) {
        console.error('❌ Data Retrieval Failed!');
        console.error(`   Error: ${error.message}`);
        console.log('');
        return false;
    }
}

async function testAuthSystem() {
    try {
        console.log('🔐 Testing Authentication System...');
        
        const db = require('./config/database');
        const bcrypt = require('bcryptjs');
        
        // Check if admin user exists
        const [adminUsers] = await db.execute(
            'SELECT username, full_name, role FROM users WHERE username = $1',
            [process.env.DEFAULT_ADMIN_USERNAME || 'admin']
        );
        
        if (adminUsers.length > 0) {
            console.log(`   Admin User: ${adminUsers[0].username} (${adminUsers[0].full_name})`);
            console.log(`   Role: ${adminUsers[0].role}`);
            console.log('✅ Authentication System Ready!');
        } else {
            console.log('⚠️  Admin user not found - will be created on first run');
        }
        
        console.log('');
        return true;
    } catch (error) {
        console.error('❌ Authentication Test Failed!');
        console.error(`   Error: ${error.message}`);
        console.log('');
        return false;
    }
}

async function runFullTest() {
    console.log('🧪 Starting Full Database Test Suite...');
    console.log('');
    
    let allTestsPassed = true;
    
    // Test 1: Try Database Connection (might fail if DB doesn't exist)
    console.log('🔌 Testing Database Connection...');
    const connectionTest = await testDatabaseConnection();
    
    if (!connectionTest) {
        console.log('⚠️  Database connection failed, trying migration system to create database...');
        console.log('');
    }
    
    // Test 2: Migration System (will create database if doesn't exist)
    const migrationTest = await testMigrationSystem();
    allTestsPassed = allTestsPassed && migrationTest;
    
    if (migrationTest) {
        // Test 3: Database Connection (should work now)
        console.log('🔌 Re-testing Database Connection after migration...');
        const connectionTest2 = await testDatabaseConnection();
        allTestsPassed = allTestsPassed && connectionTest2;
        
        if (connectionTest2) {
            // Test 4: Data Retrieval
            const dataTest = await testDataRetrieval();
            allTestsPassed = allTestsPassed && dataTest;
            
            // Test 5: Authentication
            const authTest = await testAuthSystem();
            allTestsPassed = allTestsPassed && authTest;
        }
    }
    
    // Final Results
    console.log('📋 Test Results Summary:');
    console.log('========================');
    if (allTestsPassed) {
        console.log('🎉 ALL TESTS PASSED!');
        console.log('');
        console.log('✅ Database connection: Working');
        console.log('✅ Auto migration: Working');
        console.log('✅ Data retrieval: Working');
        console.log('✅ Authentication: Working');
        console.log('');
        console.log('🚀 System is ready for development!');
        console.log('');
        console.log('Next steps:');
        console.log('1. Start the development server: npm run dev');
        console.log('2. Access admin panel: http://localhost:3001');
        console.log('3. Login with: admin / admin123');
    } else {
        console.log('❌ SOME TESTS FAILED!');
        console.log('');
        console.log('Please fix the issues above before proceeding.');
        console.log('Check the troubleshooting tips provided.');
    }
    
    console.log('');
    process.exit(allTestsPassed ? 0 : 1);
}

// Handle unhandled promises
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Run the test
runFullTest().catch(error => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
});