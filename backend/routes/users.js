const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const auth = require('../middleware/auth');
const { requireSuperAdmin, rbac, requireAnyRole } = require('../middleware/rbac');

// Get all users (Super Admin only)
router.get('/', auth, async (req, res) => {
    try {
        console.log('🔍 GET /users - User object:', req.user);
        console.log('🔍 GET /users - User role:', req.user?.role);
        console.log('🔍 GET /users - User role from middleware:', req.userRole);
        
        // Handle legacy admin tokens - allow access
        const isAuthorized = req.user.role === 'admin' || req.userRole === 'super_admin';
        console.log('🔍 GET /users - Is authorized:', isAuthorized);
        
        if (!isAuthorized) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Super Admin permission required.'
            });
        }
        
        const result = await db.query(`
            SELECT u.id, u.username, u.full_name, u.is_active, 
                   r.role_name, r.role_description, u.created_at
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.id
            ORDER BY u.created_at DESC
        `);
        
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch users'
        });
    }
});

// Get all roles (Super Admin and Manager)
router.get('/roles', auth, async (req, res) => {
    try {
        // Handle legacy admin tokens - allow access
        const isAuthorized = req.user.role === 'admin' || 
                           req.userRole === 'super_admin' || 
                           req.userRole === 'manager';
        if (!isAuthorized) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Manager permission or higher required.'
            });
        }
        const result = await db.query(`
            SELECT id, role_name, role_description, permissions, is_active
            FROM roles
            WHERE is_active = true
            ORDER BY 
                CASE role_name 
                    WHEN 'super_admin' THEN 1
                    WHEN 'manager' THEN 2
                    WHEN 'cashier' THEN 3
                    WHEN 'kitchen_staff' THEN 4
                    WHEN 'viewer' THEN 5
                    ELSE 6
                END
        `);
        
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching roles:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch roles'
        });
    }
});

// Create new user (Super Admin only)
router.post('/', auth, async (req, res) => {
    try {
        // Handle legacy admin tokens - allow access
        const isAuthorized = req.user.role === 'admin' || req.userRole === 'super_admin';
        if (!isAuthorized) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Super Admin permission required.'
            });
        }
        const { username, password, full_name, role_id } = req.body;
        
        if (!username || !password || !full_name) {
            return res.status(400).json({
                success: false,
                message: 'Username, password, and full name are required'
            });
        }

        // Check if username already exists
        const existingUser = await db.query('SELECT id FROM users WHERE username = $1', [username]);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Username already exists'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create user
        const result = await db.query(`
            INSERT INTO users (username, password, full_name, role_id, is_active)
            VALUES ($1, $2, $3, $4, true)
            RETURNING id, username, full_name, created_at
        `, [username, hashedPassword, full_name, role_id]);

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create user'
        });
    }
});

// Update user (Super Admin only)
router.put('/:id', auth, async (req, res) => {
    try {
        // Handle legacy admin tokens - allow access
        const isAuthorized = req.user.role === 'admin' || req.userRole === 'super_admin';
        if (!isAuthorized) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Super Admin permission required.'
            });
        }
        const { id } = req.params;
        const { username, full_name, role_id, is_active } = req.body;
        
        // Check if user exists
        const existingUser = await db.query('SELECT id FROM users WHERE id = $1', [id]);
        if (existingUser.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Update user
        const result = await db.query(`
            UPDATE users 
            SET username = $1, full_name = $2, role_id = $3, is_active = $4
            WHERE id = $5
            RETURNING id, username, full_name, is_active
        `, [username, full_name, role_id, is_active, id]);

        res.json({
            success: true,
            message: 'User updated successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update user'
        });
    }
});

// Change password
router.patch('/:id/password', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { current_password, new_password } = req.body;
        
        // Users can only change their own password unless they're super admin
        if (req.userRole !== 'super_admin' && req.user.id !== parseInt(id)) {
            return res.status(403).json({
                success: false,
                message: 'You can only change your own password'
            });
        }

        if (!new_password || new_password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 6 characters long'
            });
        }

        // Get user
        const userResult = await db.query('SELECT password FROM users WHERE id = $1', [id]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // If not super admin, verify current password
        if (req.userRole !== 'super_admin') {
            if (!current_password) {
                return res.status(400).json({
                    success: false,
                    message: 'Current password is required'
                });
            }

            const validPassword = await bcrypt.compare(current_password, userResult.rows[0].password);
            if (!validPassword) {
                return res.status(400).json({
                    success: false,
                    message: 'Current password is incorrect'
                });
            }
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(new_password, 10);
        
        // Update password
        await db.query('UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2', [hashedPassword, id]);

        res.json({
            success: true,
            message: 'Password updated successfully'
        });
    } catch (error) {
        console.error('Error updating password:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update password'
        });
    }
});

// Toggle user status (Super Admin only)
router.patch('/:id/toggle', auth, async (req, res) => {
    try {
        // Handle legacy admin tokens - allow access
        const isAuthorized = req.user.role === 'admin' || req.userRole === 'super_admin';
        if (!isAuthorized) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Super Admin permission required.'
            });
        }
        const { id } = req.params;
        
        const result = await db.query(`
            UPDATE users 
            SET is_active = NOT is_active
            WHERE id = $1
            RETURNING id, username, full_name, is_active
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            message: `User ${result.rows[0].is_active ? 'activated' : 'deactivated'} successfully`,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error toggling user status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to toggle user status'
        });
    }
});

// Get current user profile
router.get('/profile', auth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT u.id, u.username, u.full_name, u.email, u.is_active,
                   r.role_name, r.role_description, r.permissions, u.created_at
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.id
            WHERE u.id = $1
        `, [req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user profile'
        });
    }
});

// Delete user (Super Admin only)
router.delete('/:id', auth, async (req, res) => {
    try {
        // Handle legacy admin tokens - allow access
        const isAuthorized = req.user.role === 'admin' || req.userRole === 'super_admin';
        if (!isAuthorized) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Super Admin permission required.'
            });
        }
        const { id } = req.params;
        
        // Prevent deleting self
        if (req.user.id === parseInt(id)) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete your own account'
            });
        }

        const result = await db.query('DELETE FROM users WHERE id = $1 RETURNING username, full_name', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            message: `User ${result.rows[0].username} deleted successfully`
        });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete user'
        });
    }
});

module.exports = router;