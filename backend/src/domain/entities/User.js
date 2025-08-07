/**
 * User Entity
 * Represents the core User business object with all business rules
 */
class User {
  constructor({
    id,
    username,
    password,
    fullName,
    roleId,
    isActive = true,
    lastLogin,
    createdAt,
    role
  }) {
    this.id = id;
    this.username = username;
    this.password = password;
    this.fullName = fullName;
    this.roleId = roleId;
    this.isActive = isActive;
    this.lastLogin = lastLogin;
    this.createdAt = createdAt;
    this.role = role; // Role object when joined
  }

  // Business rules
  isValidUsername() {
    return this.username && 
           this.username.length >= 3 && 
           this.username.length <= 50 &&
           /^[a-zA-Z0-9_-]+$/.test(this.username);
  }

  isValidPassword(password) {
    return password && password.length >= 6;
  }

  isValidFullName() {
    return this.fullName && 
           this.fullName.length >= 2 && 
           this.fullName.length <= 100;
  }

  canBeDeleted() {
    // Business rule: Active users with admin role cannot be deleted
    return !(this.isActive && this.role?.roleName === 'super_admin');
  }

  canPerformAction(requiredPermission) {
    if (!this.role || !this.role.permissions) {
      return false;
    }
    
    // Super admin has all permissions
    if (this.role.roleName === 'super_admin') {
      return true;
    }
    
    return this.role.permissions[requiredPermission] === true;
  }

  getDisplayRole() {
    if (!this.role) return 'No Role';
    
    const roleMap = {
      'super_admin': 'Super Admin',
      'manager': 'Manager',
      'cashier': 'Cashier',
      'kitchen_staff': 'Kitchen Staff',
      'viewer': 'Viewer'
    };
    
    return roleMap[this.role.roleName] || this.role.roleName;
  }

  // Domain events
  static events = {
    USER_CREATED: 'user.created',
    USER_UPDATED: 'user.updated',
    USER_DELETED: 'user.deleted',
    USER_LOGGED_IN: 'user.logged_in',
    USER_STATUS_CHANGED: 'user.status_changed'
  };

  validate() {
    const errors = [];

    if (!this.isValidUsername()) {
      errors.push('Invalid username: must be 3-50 characters, alphanumeric, dash, underscore only');
    }

    if (!this.isValidFullName()) {
      errors.push('Invalid full name: must be 2-100 characters');
    }

    if (!this.roleId) {
      errors.push('Role is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  toJSON() {
    return {
      id: this.id,
      username: this.username,
      fullName: this.fullName,
      roleId: this.roleId,
      isActive: this.isActive,
      lastLogin: this.lastLogin,
      createdAt: this.createdAt,
      role: this.role
    };
  }
}

module.exports = User;