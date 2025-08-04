const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Get all packages
router.get('/', async (req, res) => {
    try {
        const [packages] = await db.execute(
            'SELECT * FROM packages ORDER BY duration_minutes ASC'
        );
        
        res.json({
            success: true,
            packages: packages
        });
    } catch (error) {
        console.error('Error fetching packages:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch packages'
        });
    }
});

// Get active packages only
router.get('/active', async (req, res) => {
    try {
        const [packages] = await db.execute(
            'SELECT * FROM packages WHERE is_active = true ORDER BY duration_minutes ASC'
        );
        
        res.json({
            success: true,
            packages: packages
        });
    } catch (error) {
        console.error('Error fetching active packages:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch active packages'
        });
    }
});

// Create new package
router.post('/', async (req, res) => {
    try {
        const { name, description, duration_minutes, price, is_active = true } = req.body;
        
        if (!name || !duration_minutes || !price) {
            return res.status(400).json({
                success: false,
                message: 'Name, duration, and price are required'
            });
        }

        const [result] = await db.execute(
            'INSERT INTO packages (name, description, duration_minutes, price, is_active) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [name, description, duration_minutes, price, is_active]
        );

        res.json({
            success: true,
            message: 'Package created successfully',
            package_id: result[0].id
        });
    } catch (error) {
        console.error('Error creating package:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create package'
        });
    }
});

// Update package
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, duration_minutes, price, is_active } = req.body;
        
        const [result] = await db.execute(
            `UPDATE packages 
             SET name = $1, description = $2, duration_minutes = $3, price = $4, is_active = $5, updated_at = CURRENT_TIMESTAMP
             WHERE id = $6`,
            [name, description, duration_minutes, price, is_active, id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Package not found'
            });
        }

        res.json({
            success: true,
            message: 'Package updated successfully'
        });
    } catch (error) {
        console.error('Error updating package:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update package'
        });
    }
});

// Delete package
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const [result] = await db.execute('DELETE FROM packages WHERE id = $1', [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Package not found'
            });
        }

        res.json({
            success: true,
            message: 'Package deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting package:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete package'
        });
    }
});

// Toggle package status
router.patch('/:id/toggle', async (req, res) => {
    try {
        const { id } = req.params;
        
        const [result] = await db.execute(
            'UPDATE packages SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Package not found'
            });
        }

        res.json({
            success: true,
            message: 'Package status toggled successfully'
        });
    } catch (error) {
        console.error('Error toggling package status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to toggle package status'
        });
    }
});

module.exports = router;