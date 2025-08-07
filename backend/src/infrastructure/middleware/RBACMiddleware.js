/**
 * Role-Based Access Control (RBAC) Middleware
 * Checks user permissions for accessing specific resources
 */
class RBACMiddleware {
  constructor({ logger }) {
    this.logger = logger;
  }

  requirePermission(permission) {
    return (req, res, next) => {
      try {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            message: 'Authentication required'
          });
        }

        const userPermissions = req.user.permissions || {};
        
        this.logger.debug('RBAC Permission Check', {
          userId: req.user.id,
          username: req.user.username,
          requiredPermission: permission,
          userPermissions: userPermissions,
          hasPermission: this._hasPermission(userPermissions, permission)
        });
        
        // Check if user has the required permission
        if (!this._hasPermission(userPermissions, permission)) {
          this.logger.warn('Access denied - insufficient permissions', {
            userId: req.user.id,
            username: req.user.username,
            requiredPermission: permission,
            userPermissions: Object.keys(userPermissions),
            url: req.url,
            method: req.method
          });

          return res.status(403).json({
            success: false,
            message: 'Insufficient permissions'
          });
        }

        this.logger.debug('Access granted', {
          userId: req.user.id,
          permission: permission,
          url: req.url,
          method: req.method
        });

        next();

      } catch (error) {
        this.logger.error('RBAC middleware error', { 
          error: error.message,
          stack: error.stack,
          userId: req.user?.id
        });

        return res.status(500).json({
          success: false,
          message: 'Authorization error'
        });
      }
    };
  }

  requireRole(roleName) {
    return (req, res, next) => {
      try {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            message: 'Authentication required'
          });
        }

        if (req.user.roleName !== roleName) {
          this.logger.warn('Access denied - insufficient role', {
            userId: req.user.id,
            username: req.user.username,
            requiredRole: roleName,
            userRole: req.user.roleName,
            url: req.url,
            method: req.method
          });

          return res.status(403).json({
            success: false,
            message: 'Insufficient role privileges'
          });
        }

        next();

      } catch (error) {
        this.logger.error('RBAC role middleware error', { 
          error: error.message,
          stack: error.stack,
          userId: req.user?.id
        });

        return res.status(500).json({
          success: false,
          message: 'Authorization error'
        });
      }
    };
  }

  requireAnyRole(roleNames) {
    return (req, res, next) => {
      try {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            message: 'Authentication required'
          });
        }

        if (!roleNames.includes(req.user.roleName)) {
          this.logger.warn('Access denied - insufficient role', {
            userId: req.user.id,
            username: req.user.username,
            requiredRoles: roleNames,
            userRole: req.user.roleName,
            url: req.url,
            method: req.method
          });

          return res.status(403).json({
            success: false,
            message: 'Insufficient role privileges'
          });
        }

        next();

      } catch (error) {
        this.logger.error('RBAC any role middleware error', { 
          error: error.message,
          stack: error.stack,
          userId: req.user?.id
        });

        return res.status(500).json({
          success: false,
          message: 'Authorization error'
        });
      }
    };
  }

  requireAnyPermission(permissions) {
    return (req, res, next) => {
      try {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            message: 'Authentication required'
          });
        }

        const userPermissions = req.user.permissions || {};
        
        // Check if user has any of the required permissions
        const hasAnyPermission = permissions.some(permission => 
          this._hasPermission(userPermissions, permission)
        );

        if (!hasAnyPermission) {
          this.logger.warn('Access denied - no matching permissions', {
            userId: req.user.id,
            username: req.user.username,
            requiredPermissions: permissions,
            userPermissions: Object.keys(userPermissions),
            url: req.url,
            method: req.method
          });

          return res.status(403).json({
            success: false,
            message: 'Insufficient permissions'
          });
        }

        next();

      } catch (error) {
        this.logger.error('RBAC any permission middleware error', { 
          error: error.message,
          stack: error.stack,
          userId: req.user?.id
        });

        return res.status(500).json({
          success: false,
          message: 'Authorization error'
        });
      }
    };
  }

  // Allow only the user themselves or users with specific permission
  requireSelfOrPermission(permission) {
    return (req, res, next) => {
      try {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            message: 'Authentication required'
          });
        }

        const targetUserId = parseInt(req.params.id || req.params.userId);
        const currentUserId = req.user.id;

        // Allow if it's the user themselves
        if (currentUserId === targetUserId) {
          return next();
        }

        // Otherwise check permission
        const userPermissions = req.user.permissions || {};
        
        if (!this._hasPermission(userPermissions, permission)) {
          this.logger.warn('Access denied - not self and insufficient permissions', {
            userId: req.user.id,
            username: req.user.username,
            targetUserId: targetUserId,
            requiredPermission: permission,
            url: req.url,
            method: req.method
          });

          return res.status(403).json({
            success: false,
            message: 'Can only access your own resources or need admin privileges'
          });
        }

        next();

      } catch (error) {
        this.logger.error('RBAC self or permission middleware error', { 
          error: error.message,
          stack: error.stack,
          userId: req.user?.id
        });

        return res.status(500).json({
          success: false,
          message: 'Authorization error'
        });
      }
    };
  }

  // Helper method to check permissions
  _hasPermission(userPermissions, requiredPermission) {
    // If user has super admin permission, allow everything
    if (userPermissions.super_admin === true) {
      return true;
    }

    // Check for specific permission
    if (userPermissions[requiredPermission] === true) {
      return true;
    }

    // Check for wildcard permissions
    const permissionParts = requiredPermission.split('.');
    if (permissionParts.length > 1) {
      const wildcardPermission = `${permissionParts[0]}.*`;
      if (userPermissions[wildcardPermission] === true) {
        return true;
      }
    }

    return false;
  }
}

module.exports = RBACMiddleware;