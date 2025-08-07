const express = require('express');
const router = express.Router();
const db = require('../config/database');
const auth = require('../middleware/auth');
const { rbac, requireAnyRole } = require('../middleware/rbac');

// Apply authentication middleware to all supplier routes
router.use(auth);

// Get all suppliers (Manager and above)
router.get('/', rbac('supplier_management', 'view_only'), async (req, res) => {
    try {
        const { active_only } = req.query;
        
        let query = 'SELECT * FROM suppliers';
        let params = [];
        
        if (active_only === 'true') {
            query += ' WHERE is_active = $1';
            params.push(true);
        }
        
        query += ' ORDER BY supplier_name ASC';
        
        const result = await db.query(query, params);
        
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching suppliers:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch suppliers'
        });
    }
});

// Get supplier by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await db.query('SELECT * FROM suppliers WHERE id = $1', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Supplier not found'
            });
        }
        
        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error fetching supplier:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch supplier'
        });
    }
});

// Create new supplier (Manager and Super Admin only)
router.post('/', rbac('supplier_management'), async (req, res) => {
    try {
        const {
            supplier_name,
            contact_person,
            phone,
            email,
            address,
            notes,
            is_active = true
        } = req.body;
        
        if (!supplier_name) {
            return res.status(400).json({
                success: false,
                message: 'Supplier name is required'
            });
        }
        
        const result = await db.query(
            `INSERT INTO suppliers (supplier_name, contact_person, phone, email, address, notes, is_active) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [supplier_name, contact_person, phone, email, address, notes, is_active]
        );
        
        res.status(201).json({
            success: true,
            message: 'Supplier created successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating supplier:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create supplier'
        });
    }
});

// Update supplier
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            supplier_name,
            contact_person,
            phone,
            email,
            address,
            notes,
            is_active
        } = req.body;
        
        const result = await db.query(
            `UPDATE suppliers SET 
             supplier_name = $1, contact_person = $2, phone = $3, email = $4, 
             address = $5, notes = $6, is_active = $7, updated_at = CURRENT_TIMESTAMP
             WHERE id = $8 RETURNING *`,
            [supplier_name, contact_person, phone, email, address, notes, is_active, id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Supplier not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Supplier updated successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating supplier:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update supplier'
        });
    }
});

// Toggle supplier status
router.patch('/:id/toggle', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await db.query(
            `UPDATE suppliers SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $1 RETURNING *`,
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Supplier not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Supplier status toggled successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error toggling supplier status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to toggle supplier status'
        });
    }
});

// Delete supplier
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if supplier has any purchase orders
        const purchaseOrderCheck = await db.query(
            'SELECT id FROM purchase_orders WHERE supplier_id = $1 LIMIT 1',
            [id]
        );
        
        if (purchaseOrderCheck.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete supplier with existing purchase orders. Set as inactive instead.'
            });
        }
        
        const result = await db.query('DELETE FROM suppliers WHERE id = $1 RETURNING *', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Supplier not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Supplier deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting supplier:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete supplier'
        });
    }
});

module.exports = router;