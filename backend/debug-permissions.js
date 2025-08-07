const permissions = {
  "pos_system": true,
  "tv_management": true,
  "purchase_orders": true,
  "stock_movements": true,
  "system_settings": true,
  "user_management": true,
  "delete_operations": true,
  "financial_reports": true,
  "package_management": true,
  "supplier_management": true
};

// Test the _hasPermission logic
function _hasPermission(userPermissions, requiredPermission) {
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

console.log('Testing permission check:');
console.log('User has user_management:', permissions.user_management);
console.log('_hasPermission(permissions, "user_management"):', _hasPermission(permissions, 'user_management'));
console.log('_hasPermission(permissions, "super_admin"):', _hasPermission(permissions, 'super_admin'));

// Show all permissions
console.log('\nAll user permissions:');
Object.keys(permissions).forEach(key => {
  console.log(`  ${key}: ${permissions[key]}`);
});