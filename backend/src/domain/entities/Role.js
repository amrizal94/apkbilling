/**
 * Role Entity
 * Represents the core Role business object with permission management
 */
class Role {
  constructor({
    id,
    roleName,
    roleDescription,
    permissions = {},
    isActive = true,
    createdAt
  }) {
    this.id = id;
    this.roleName = roleName;
    this.roleDescription = roleDescription;
    this.permissions = permissions;
    this.isActive = isActive;
    this.createdAt = createdAt;
  }

  // Business rules
  isValidRoleName() {
    return this.roleName && 
           this.roleName.length >= 3 && 
           this.roleName.length <= 50 &&
           /^[a-z_]+$/.test(this.roleName);
  }

  hasPermission(permission) {
    return this.permissions[permission] === true;
  }

  hasViewOnlyPermission(permission) {
    const value = this.permissions[permission];
    return value === 'view_only' || value === 'basic' || value === true;
  }

  hasBasicPermission(permission) {
    const value = this.permissions[permission];
    return value === 'basic' || value === true;
  }

  isSuperAdmin() {
    return this.roleName === 'super_admin';
  }

  canManageUsers() {
    return this.isSuperAdmin();
  }

  canManageSystem() {
    return this.hasPermission('system_settings');
  }

  getPermissionLevel(permission) {
    return this.permissions[permission] || false;
  }

  // Get all permissions that are set to true
  getFullPermissions() {
    return Object.entries(this.permissions)
      .filter(([key, value]) => value === true)
      .map(([key]) => key);
  }

  // Get all permissions with their levels
  getAllPermissions() {
    return this.permissions;
  }

  validate() {
    const errors = [];

    if (!this.isValidRoleName()) {
      errors.push('Invalid role name: must be 3-50 characters, lowercase, underscore only');
    }

    if (!this.roleDescription || this.roleDescription.length < 5) {
      errors.push('Role description must be at least 5 characters');
    }

    if (typeof this.permissions !== 'object') {
      errors.push('Permissions must be an object');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Static method to create predefined roles
  static createPredefinedRoles() {
    return [
      new Role({
        roleName: 'super_admin',
        roleDescription: 'Super Administrator - Full system access',
        permissions: {
          user_management: true,
          system_settings: true,
          tv_management: true,
          pos_system: true,
          package_management: true,
          reports: true,
          fnb_management: true,
          supplier_management: true,
          purchase_orders: true,
          delete_operations: true
        }
      }),
      new Role({
        roleName: 'manager',
        roleDescription: 'Manager - Operational management without user control',
        permissions: {
          user_management: false,
          system_settings: false,
          tv_management: true,
          pos_system: true,
          package_management: true,
          reports: true,
          fnb_management: true,
          supplier_management: true,
          purchase_orders: true,
          delete_operations: 'basic'
        }
      }),
      new Role({
        roleName: 'cashier',
        roleDescription: 'Cashier/Staff - Daily operations access',
        permissions: {
          user_management: false,
          system_settings: false,
          tv_management: true,
          pos_system: true,
          package_management: false,
          reports: 'basic',
          fnb_management: 'basic',
          supplier_management: false,
          purchase_orders: false,
          delete_operations: false
        }
      }),
      new Role({
        roleName: 'kitchen_staff',
        roleDescription: 'Kitchen Staff - F&B operations only',
        permissions: {
          user_management: false,
          system_settings: false,
          tv_management: false,
          pos_system: false,
          package_management: false,
          reports: 'view_only',
          fnb_management: true,
          supplier_management: false,
          purchase_orders: false,
          delete_operations: false
        }
      }),
      new Role({
        roleName: 'viewer',
        roleDescription: 'Viewer - Read-only access for monitoring',
        permissions: {
          user_management: false,
          system_settings: false,
          tv_management: 'view_only',
          pos_system: 'view_only',
          package_management: 'view_only',
          reports: 'view_only',
          fnb_management: 'view_only',
          supplier_management: 'view_only',
          purchase_orders: 'view_only',
          delete_operations: false
        }
      })
    ];
  }

  toJSON() {
    return {
      id: this.id,
      roleName: this.roleName,
      roleDescription: this.roleDescription,
      permissions: this.permissions,
      isActive: this.isActive,
      createdAt: this.createdAt
    };
  }
}

module.exports = Role;