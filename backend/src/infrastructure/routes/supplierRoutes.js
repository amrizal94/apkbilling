const express = require('express');

/**
 * Supplier Management Routes
 * Defines all supplier management API endpoints
 */
function createSupplierRoutes(container) {
  const router = express.Router();
  
  // Get dependencies from container
  const authMiddleware = container.resolve('authMiddleware');
  const rbacMiddleware = container.resolve('rbacMiddleware');
  const responseHandler = container.resolve('responseHandler');
  const database = container.resolve('database');
  const logger = container.resolve('logger');

  // All supplier routes require authentication
  router.use(authMiddleware.authenticate());

  // GET /api/suppliers - Get all suppliers
  router.get('/', 
    rbacMiddleware.requirePermission('supplier_management'),
    async (req, res) => {
      try {
        const { active_only } = req.query;
        
        let query = 'SELECT * FROM suppliers';
        const params = [];
        
        if (active_only === 'true') {
          query += ' WHERE is_active = $1';
          params.push(true);
        }
        
        query += ' ORDER BY supplier_name ASC';
        
        const result = await database.query(query, params);
        
        return responseHandler.success(res, result.rows, 'Suppliers retrieved successfully');
      } catch (error) {
        logger.error('Error fetching suppliers', { error: error.message });
        return responseHandler.error(res, 'Failed to fetch suppliers', 500);
      }
    }
  );

  // GET /api/suppliers/:id - Get supplier by ID
  router.get('/:id', 
    rbacMiddleware.requirePermission('supplier_management'),
    async (req, res) => {
      try {
        const { id } = req.params;
        
        const result = await database.query('SELECT * FROM suppliers WHERE id = $1', [id]);
        
        if (result.rows.length === 0) {
          return responseHandler.error(res, 'Supplier not found', 404);
        }
        
        return responseHandler.success(res, result.rows[0], 'Supplier retrieved successfully');
      } catch (error) {
        logger.error('Error fetching supplier', { error: error.message });
        return responseHandler.error(res, 'Failed to fetch supplier', 500);
      }
    }
  );

  // POST /api/suppliers - Create new supplier
  router.post('/', 
    rbacMiddleware.requirePermission('supplier_management'),
    async (req, res) => {
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
          return responseHandler.error(res, 'Supplier name is required', 400);
        }
        
        const result = await database.query(
          `INSERT INTO suppliers (supplier_name, contact_person, phone, email, address, notes, is_active) 
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [supplier_name, contact_person, phone, email, address, notes, is_active]
        );
        
        logger.info('Supplier created', { 
          supplierId: result.rows[0].id,
          supplierName: supplier_name,
          userId: req.user?.id 
        });
        
        return responseHandler.success(res, result.rows[0], 'Supplier created successfully', 201);
      } catch (error) {
        logger.error('Error creating supplier', { error: error.message });
        return responseHandler.error(res, 'Failed to create supplier', 500);
      }
    }
  );

  // PUT /api/suppliers/:id - Update supplier
  router.put('/:id', 
    rbacMiddleware.requirePermission('supplier_management'),
    async (req, res) => {
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
        
        const result = await database.query(
          `UPDATE suppliers SET 
           supplier_name = $1, contact_person = $2, phone = $3, email = $4, 
           address = $5, notes = $6, is_active = $7, updated_at = CURRENT_TIMESTAMP
           WHERE id = $8 RETURNING *`,
          [supplier_name, contact_person, phone, email, address, notes, is_active, id]
        );
        
        if (result.rows.length === 0) {
          return responseHandler.error(res, 'Supplier not found', 404);
        }
        
        logger.info('Supplier updated', { 
          supplierId: id,
          userId: req.user?.id 
        });
        
        return responseHandler.success(res, result.rows[0], 'Supplier updated successfully');
      } catch (error) {
        logger.error('Error updating supplier', { error: error.message });
        return responseHandler.error(res, 'Failed to update supplier', 500);
      }
    }
  );

  // PATCH /api/suppliers/:id/toggle - Toggle supplier status
  router.patch('/:id/toggle', 
    rbacMiddleware.requirePermission('supplier_management'),
    async (req, res) => {
      try {
        const { id } = req.params;
        
        const result = await database.query(
          `UPDATE suppliers SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP 
           WHERE id = $1 RETURNING *`,
          [id]
        );
        
        if (result.rows.length === 0) {
          return responseHandler.error(res, 'Supplier not found', 404);
        }
        
        logger.info('Supplier status toggled', { 
          supplierId: id,
          newStatus: result.rows[0].is_active,
          userId: req.user?.id 
        });
        
        return responseHandler.success(res, result.rows[0], 'Supplier status toggled successfully');
      } catch (error) {
        logger.error('Error toggling supplier status', { error: error.message });
        return responseHandler.error(res, 'Failed to toggle supplier status', 500);
      }
    }
  );

  // DELETE /api/suppliers/:id - Delete supplier
  router.delete('/:id', 
    rbacMiddleware.requirePermission('supplier_management'),
    async (req, res) => {
      try {
        const { id } = req.params;
        
        // Check if supplier has any purchase orders
        const purchaseOrderCheck = await database.query(
          'SELECT id FROM purchase_orders WHERE supplier_id = $1 LIMIT 1',
          [id]
        );
        
        if (purchaseOrderCheck.rows.length > 0) {
          return responseHandler.error(res, 'Cannot delete supplier with existing purchase orders. Set as inactive instead.', 400);
        }
        
        const result = await database.query('DELETE FROM suppliers WHERE id = $1 RETURNING *', [id]);
        
        if (result.rows.length === 0) {
          return responseHandler.error(res, 'Supplier not found', 404);
        }
        
        logger.info('Supplier deleted', { 
          supplierId: id,
          userId: req.user?.id 
        });
        
        return responseHandler.success(res, null, 'Supplier deleted successfully');
      } catch (error) {
        logger.error('Error deleting supplier', { error: error.message });
        return responseHandler.error(res, 'Failed to delete supplier', 500);
      }
    }
  );

  return router;
}

module.exports = createSupplierRoutes;