const fs = require('fs');
const path = require('path');
const db = require('./config/database');

async function runMigration() {
  try {
    const migrationPath = path.join(__dirname, 'migrations', 'create_supplier_system_fixed.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split by statements and execute one by one
    const statements = migrationSQL
      .split(';')
      .filter(stmt => stmt.trim().length > 0)
      .filter(stmt => !stmt.trim().startsWith('--'));
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await db.query(statement.trim());
          console.log('✅ Executed:', statement.split('\n')[0].trim());
        } catch (error) {
          if (error.message.includes('already exists') || error.message.includes('duplicate key')) {
            console.log('⚠️ Already exists:', statement.split('\n')[0].trim());
          } else {
            console.error('❌ Error:', error.message);
          }
        }
      }
    }
    
    console.log('🎉 Migration completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();