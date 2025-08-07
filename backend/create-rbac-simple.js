const db = require('./config/database');

async function createRBAC() {
  try {
    // Create roles table
    await db.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        role_name VARCHAR(50) UNIQUE NOT NULL,
        role_description TEXT,
        permissions JSONB NOT NULL DEFAULT '{}',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created roles table');

    // Add role_id to users table if not exists
    try {
      await db.query(`ALTER TABLE users ADD COLUMN role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL`);
      console.log('✅ Added role_id column to users table');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('⚠️ role_id column already exists in users table');
      } else {
        throw error;
      }
    }

    // Create user_sessions table
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        session_token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        ip_address INET,
        user_agent TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created user_sessions table');

    // Insert default roles
    const roles = [
      {
        name: 'super_admin',
        description: 'Super Administrator - Full system access',
        permissions: {
          user_management: true,
          system_settings: true,
          tv_management: true,
          package_management: true,
          pos_system: true,
          supplier_management: true,
          purchase_orders: true,
          financial_reports: true,
          stock_movements: true,
          delete_operations: true
        }
      },
      {
        name: 'manager',
        description: 'Manager - Operational management access',
        permissions: {
          user_management: false,
          system_settings: false,
          tv_management: true,
          package_management: true,
          pos_system: true,
          supplier_management: true,
          purchase_orders: true,
          financial_reports: true,
          stock_movements: true,
          delete_operations: false
        }
      },
      {
        name: 'cashier',
        description: 'Cashier/Staff - Daily operations access',
        permissions: {
          user_management: false,
          system_settings: false,
          tv_management: true,
          package_management: false,
          pos_system: true,
          supplier_management: false,
          purchase_orders: false,
          financial_reports: 'basic',
          stock_movements: 'view_only',
          delete_operations: false
        }
      },
      {
        name: 'kitchen_staff',
        description: 'Kitchen/F&B Staff - Food service operations',
        permissions: {
          user_management: false,
          system_settings: false,
          tv_management: false,
          package_management: false,
          pos_system: 'orders_only',
          supplier_management: false,
          purchase_orders: false,
          financial_reports: false,
          stock_movements: 'view_only',
          delete_operations: false
        }
      },
      {
        name: 'viewer',
        description: 'Viewer/Readonly - Monitoring and reporting only',
        permissions: {
          user_management: false,
          system_settings: false,
          tv_management: 'view_only',
          package_management: 'view_only',
          pos_system: 'view_only',
          supplier_management: 'view_only',
          purchase_orders: 'view_only',
          financial_reports: true,
          stock_movements: 'view_only',
          delete_operations: false
        }
      }
    ];

    for (const role of roles) {
      try {
        await db.query(`
          INSERT INTO roles (role_name, role_description, permissions) 
          VALUES ($1, $2, $3)
          ON CONFLICT (role_name) DO NOTHING
        `, [role.name, role.description, JSON.stringify(role.permissions)]);
        console.log(`✅ Created role: ${role.name}`);
      } catch (error) {
        console.log(`⚠️ Role ${role.name} may already exist`);
      }
    }

    // Update existing admin users to super_admin role
    const superAdminRole = await db.query(`SELECT id FROM roles WHERE role_name = 'super_admin'`);
    if (superAdminRole.rows.length > 0) {
      await db.query(`
        UPDATE users SET role_id = $1 WHERE role = 'admin' AND role_id IS NULL
      `, [superAdminRole.rows[0].id]);
      console.log('✅ Updated admin users to super_admin role');
    }

    // Update other users to cashier role by default
    const cashierRole = await db.query(`SELECT id FROM roles WHERE role_name = 'cashier'`);
    if (cashierRole.rows.length > 0) {
      await db.query(`
        UPDATE users SET role_id = $1 WHERE role != 'admin' AND role_id IS NULL
      `, [cashierRole.rows[0].id]);
      console.log('✅ Updated other users to cashier role');
    }

    // Create indexes
    try {
      await db.query(`CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id)`);
      await db.query(`CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id)`);
      await db.query(`CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token)`);
      console.log('✅ Created indexes');
    } catch (error) {
      console.log('⚠️ Some indexes may already exist');
    }

    // Verify setup
    console.log('\n📋 RBAC System Setup Complete!');
    const rolesResult = await db.query('SELECT role_name, role_description FROM roles ORDER BY id');
    console.log('\n🔐 Available Roles:');
    rolesResult.rows.forEach(role => {
      console.log(`  - ${role.role_name}: ${role.role_description}`);
    });

    const usersResult = await db.query(`
      SELECT u.full_name, u.username, r.role_name 
      FROM users u 
      LEFT JOIN roles r ON u.role_id = r.id 
      ORDER BY u.id
    `);
    console.log('\n👥 User Role Assignments:');
    usersResult.rows.forEach(user => {
      console.log(`  - ${user.full_name} (${user.username}): ${user.role_name || 'No role assigned'}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up RBAC:', error.message);
    process.exit(1);
  }
}

createRBAC();