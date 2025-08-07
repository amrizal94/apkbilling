const db = require('../config/database');

// Role-Based Access Control Middleware
const rbac = (requiredPermission, level = true) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Get user with role and permissions
      const userResult = await db.query(`
        SELECT u.*, r.role_name, r.permissions 
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        WHERE u.id = $1
      `, [req.user.id]);

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const user = userResult.rows[0];
      
      // Handle legacy tokens - if user has old 'admin' role, treat as super_admin
      if (!user.role_name && req.user.role === 'admin') {
        console.log('🔄 Legacy admin token detected - treating as super_admin');
        req.userRole = 'super_admin';
        req.userPermissions = { user_management: true, system_settings: true };
        return next();
      }
      
      // If no role assigned, deny access (except for basic operations)
      if (!user.role_name || !user.permissions) {
        return res.status(403).json({
          success: false,
          message: 'No role assigned. Contact administrator. Please logout and login again to refresh your permissions.'
        });
      }

      const permissions = user.permissions;
      
      // Super admin has access to everything
      if (user.role_name === 'super_admin') {
        req.userRole = user.role_name;
        req.userPermissions = permissions;
        return next();
      }

      // Check specific permission
      if (!permissions[requiredPermission]) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required permission: ${requiredPermission}`
        });
      }

      // Handle different permission levels
      const userPermissionLevel = permissions[requiredPermission];
      
      if (level === true && userPermissionLevel !== true) {
        return res.status(403).json({
          success: false,
          message: `Insufficient permission level for ${requiredPermission}`
        });
      }

      if (level === 'view_only' && !['view_only', 'basic', true].includes(userPermissionLevel)) {
        return res.status(403).json({
          success: false,
          message: `View access denied for ${requiredPermission}`
        });
      }

      // Add user role info to request
      req.userRole = user.role_name;
      req.userPermissions = permissions;
      req.permissionLevel = userPermissionLevel;
      
      next();
    } catch (error) {
      console.error('RBAC middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Permission check failed'
      });
    }
  };
};

// Convenience functions for common permissions
const requireSuperAdmin = rbac('user_management');
const requireManager = rbac('package_management');
const requireCashier = rbac('pos_system');
const requireViewAccess = (permission) => rbac(permission, 'view_only');

// Multi-role access (user must have ANY of the specified roles)
const requireAnyRole = (allowedRoles) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const userResult = await db.query(`
        SELECT r.role_name 
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        WHERE u.id = $1
      `, [req.user.id]);

      if (userResult.rows.length === 0 || !userResult.rows[0].role_name) {
        return res.status(403).json({
          success: false,
          message: 'No role assigned'
        });
      }

      const userRole = userResult.rows[0].role_name;
      
      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required roles: ${allowedRoles.join(', ')}`
        });
      }

      req.userRole = userRole;
      next();
    } catch (error) {
      console.error('Multi-role middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Role check failed'
      });
    }
  };
};

// Check if user can perform delete operations
const requireDeletePermission = rbac('delete_operations');

// Permission level checker for gradual access
const checkPermissionLevel = (permission) => {
  return (req, res, next) => {
    const userLevel = req.permissionLevel || req.userPermissions?.[permission];
    
    // Add permission level info to request
    req.canFullAccess = userLevel === true;
    req.canViewOnly = ['view_only', 'basic', true].includes(userLevel);
    req.canBasicOperations = ['basic', true].includes(userLevel);
    
    next();
  };
};

module.exports = {
  rbac,
  requireSuperAdmin,
  requireManager,
  requireCashier,
  requireViewAccess,
  requireAnyRole,
  requireDeletePermission,
  checkPermissionLevel
};