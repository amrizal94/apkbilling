const fs = require('fs');
const path = require('path');
const db = require('./config/database');

async function runRBACMigration() {
  try {
    const migrationPath = path.join(__dirname, 'migrations', 'create_rbac_system.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split by statements and execute one by one
    const statements = migrationSQL
      .split(';')
      .filter(stmt => stmt.trim().length > 0)
      .filter(stmt => !stmt.trim().startsWith('--'))
      .filter(stmt => stmt.trim() !== '');
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await db.query(statement.trim());
          const firstLine = statement.trim().split('\n')[0];
          console.log('✅ Executed:', firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : firstLine);
        } catch (error) {
          if (error.message.includes('already exists') || 
              error.message.includes('duplicate key') ||
              error.message.includes('column') && error.message.includes('already exists')) {
            console.log('⚠️ Already exists:', statement.trim().split('\n')[0].substring(0, 50) + '...');
          } else {
            console.error('❌ Error:', error.message);
          }
        }
      }
    }
    
    console.log('🎉 RBAC Migration completed!');
    
    // Verify roles were created
    const rolesResult = await db.query('SELECT role_name, role_description FROM roles ORDER BY id');
    console.log('\n📋 Created Roles:');
    rolesResult.rows.forEach(role => {
      console.log(`  - ${role.role_name}: ${role.role_description}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runRBACMigration();