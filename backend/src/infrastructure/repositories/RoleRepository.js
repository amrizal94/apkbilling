const Role = require('../../domain/entities/Role');

/**
 * Role Repository Implementation
 * Handles role data persistence using PostgreSQL
 */
class RoleRepository {
  constructor({ database, logger, cacheService }) {
    this.database = database;
    this.logger = logger;
    this.cache = cacheService;
    this.cachePrefix = 'role:';
    this.cacheTTL = parseInt(process.env.REDIS_TTL) || 3600;
  }

  async findById(id) {
    try {
      // Try cache first
      const cacheKey = `${this.cachePrefix}${id}`;
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        this.logger.debug('Role found in cache', { roleId: id });
        return this._mapToEntity(JSON.parse(cached));
      }

      const query = `
        SELECT id, role_name, role_description, permissions, is_active, created_at
        FROM roles
        WHERE id = $1
      `;
      
      const result = await this.database.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      const role = this._mapToEntity(row);
      
      // Cache the result
      await this.cache.set(cacheKey, JSON.stringify(row), this.cacheTTL);
      
      return role;
    } catch (error) {
      this.logger.error('RoleRepository.findById failed', { id, error: error.message });
      throw error;
    }
  }

  async findByName(name) {
    try {
      const query = `
        SELECT id, role_name, role_description, permissions, is_active, created_at
        FROM roles
        WHERE role_name = $1
      `;
      
      const result = await this.database.query(query, [name]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return this._mapToEntity(row);
    } catch (error) {
      this.logger.error('RoleRepository.findByName failed', { name, error: error.message });
      throw error;
    }
  }

  async findAll(filters = {}) {
    try {
      let query = `
        SELECT id, role_name, role_description, permissions, is_active, created_at
        FROM roles
      `;
      
      const conditions = [];
      const values = [];
      let paramIndex = 1;

      if (filters.isActive !== undefined) {
        conditions.push(`is_active = $${paramIndex++}`);
        values.push(filters.isActive);
      }

      if (filters.search) {
        conditions.push(`(role_name ILIKE $${paramIndex} OR role_description ILIKE $${paramIndex})`);
        values.push(`%${filters.search}%`);
        paramIndex++;
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY created_at ASC';

      if (filters.limit) {
        query += ` LIMIT $${paramIndex++}`;
        values.push(filters.limit);
      }

      if (filters.offset) {
        query += ` OFFSET $${paramIndex++}`;
        values.push(filters.offset);
      }

      const result = await this.database.query(query, values);
      return result.rows.map(row => this._mapToEntity(row));
    } catch (error) {
      this.logger.error('RoleRepository.findAll failed', { filters, error: error.message });
      throw error;
    }
  }

  async create(roleData) {
    try {
      const query = `
        INSERT INTO roles (role_name, role_description, permissions, is_active)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;
      
      const values = [
        roleData.roleName,
        roleData.roleDescription,
        JSON.stringify(roleData.permissions),
        roleData.isActive !== undefined ? roleData.isActive : true
      ];

      const result = await this.database.query(query, values);
      const row = result.rows[0];
      
      this.logger.info('Role created', { roleId: row.id, roleName: row.role_name });
      
      // Invalidate relevant cache
      await this._invalidateRoleCache();
      
      return this._mapToEntity(row);
    } catch (error) {
      this.logger.error('RoleRepository.create failed', { roleData: { roleName: roleData.roleName }, error: error.message });
      throw error;
    }
  }

  async update(id, roleData) {
    try {
      const fields = [];
      const values = [];
      let paramIndex = 1;

      if (roleData.roleName !== undefined) {
        fields.push(`role_name = $${paramIndex++}`);
        values.push(roleData.roleName);
      }

      if (roleData.roleDescription !== undefined) {
        fields.push(`role_description = $${paramIndex++}`);
        values.push(roleData.roleDescription);
      }

      if (roleData.permissions !== undefined) {
        fields.push(`permissions = $${paramIndex++}`);
        values.push(JSON.stringify(roleData.permissions));
      }

      if (roleData.isActive !== undefined) {
        fields.push(`is_active = $${paramIndex++}`);
        values.push(roleData.isActive);
      }

      if (fields.length === 0) {
        throw new Error('No fields to update');
      }

      const query = `
        UPDATE roles 
        SET ${fields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;
      
      values.push(id);

      const result = await this.database.query(query, values);
      
      if (result.rows.length === 0) {
        return null;
      }

      this.logger.info('Role updated', { roleId: id });
      
      // Invalidate cache
      await this._invalidateRoleCache(id);
      
      return this._mapToEntity(result.rows[0]);
    } catch (error) {
      this.logger.error('RoleRepository.update failed', { id, error: error.message });
      throw error;
    }
  }

  async delete(id) {
    try {
      // Check if role is being used by any users
      const userCheckQuery = 'SELECT COUNT(*) as count FROM users WHERE role_id = $1';
      const userCheckResult = await this.database.query(userCheckQuery, [id]);
      
      if (parseInt(userCheckResult.rows[0].count) > 0) {
        throw new Error('Cannot delete role that is assigned to users');
      }

      const query = 'DELETE FROM roles WHERE id = $1 RETURNING *';
      const result = await this.database.query(query, [id]);
      
      if (result.rows.length === 0) {
        return false;
      }

      this.logger.info('Role deleted', { roleId: id });
      
      // Invalidate cache
      await this._invalidateRoleCache(id);
      
      return true;
    } catch (error) {
      this.logger.error('RoleRepository.delete failed', { id, error: error.message });
      throw error;
    }
  }

  async exists(roleName) {
    try {
      const query = 'SELECT COUNT(*) as count FROM roles WHERE role_name = $1';
      const result = await this.database.query(query, [roleName]);
      return parseInt(result.rows[0].count) > 0;
    } catch (error) {
      this.logger.error('RoleRepository.exists failed', { roleName, error: error.message });
      throw error;
    }
  }

  async count(filters = {}) {
    try {
      let query = 'SELECT COUNT(*) as count FROM roles';
      const conditions = [];
      const values = [];
      let paramIndex = 1;

      if (filters.isActive !== undefined) {
        conditions.push(`is_active = $${paramIndex++}`);
        values.push(filters.isActive);
      }

      if (filters.search) {
        conditions.push(`(role_name ILIKE $${paramIndex} OR role_description ILIKE $${paramIndex})`);
        values.push(`%${filters.search}%`);
        paramIndex++;
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      const result = await this.database.query(query, values);
      return parseInt(result.rows[0].count);
    } catch (error) {
      this.logger.error('RoleRepository.count failed', { filters, error: error.message });
      throw error;
    }
  }

  async getUserCountByRole() {
    try {
      const query = `
        SELECT r.id, r.role_name, COUNT(u.id) as user_count
        FROM roles r
        LEFT JOIN users u ON r.id = u.role_id
        WHERE r.is_active = true
        GROUP BY r.id, r.role_name
        ORDER BY r.role_name
      `;
      
      const result = await this.database.query(query);
      return result.rows.map(row => ({
        roleId: row.id,
        roleName: row.role_name,
        userCount: parseInt(row.user_count)
      }));
    } catch (error) {
      this.logger.error('RoleRepository.getUserCountByRole failed', { error: error.message });
      throw error;
    }
  }

  _mapToEntity(row) {
    return new Role({
      id: row.id,
      roleName: row.role_name,
      roleDescription: row.role_description,
      permissions: typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions,
      isActive: row.is_active,
      createdAt: row.created_at
    });
  }

  async _invalidateRoleCache(id = null) {
    try {
      if (id) {
        const cacheKey = `${this.cachePrefix}${id}`;
        await this.cache.delete(cacheKey);
      } else {
        // Invalidate all role cache keys
        const keys = await this.cache.keys(`${this.cachePrefix}*`);
        for (const key of keys) {
          await this.cache.delete(key.replace(this.cachePrefix, ''));
        }
      }
    } catch (error) {
      this.logger.warn('Failed to invalidate role cache', { id, error: error.message });
    }
  }
}

module.exports = RoleRepository;