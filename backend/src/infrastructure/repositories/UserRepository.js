const User = require('../../domain/entities/User');
const Role = require('../../domain/entities/Role');

/**
 * User Repository Implementation
 * Handles data persistence for User entity
 */
class UserRepository {
  constructor({ database, logger, cacheService }) {
    this.db = database;
    this.logger = logger;
    this.cache = cacheService;
    this.cachePrefix = 'user:';
    this.cacheTTL = parseInt(process.env.REDIS_TTL) || 3600;
  }

  async findById(id) {
    try {
      // Try cache first (if available)
      try {
        const cacheKey = `${this.cachePrefix}${id}`;
        const cached = await this.cache.get(cacheKey);
        if (cached) {
          this.logger.debug('User found in cache', { userId: id });
          return this._mapRowToUser(JSON.parse(cached));
        }
      } catch (cacheError) {
        this.logger.debug('Cache read failed, continuing with database', { userId: id, error: cacheError.message });
      }

      const query = `
        SELECT u.id, u.username, u.password_hash as password, u.full_name, u.role_id, 
               u.is_active, u.last_login, u.created_at,
               r.id as role_id_ref, r.role_name, r.role_description, r.permissions
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        WHERE u.id = $1
      `;

      const result = await this.db.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const user = this._mapRowToUser(result.rows[0]);
      
      // Cache the result (if available)
      try {
        await this.cache.set(cacheKey, JSON.stringify(result.rows[0]), this.cacheTTL);
      } catch (cacheError) {
        this.logger.debug('Cache write failed', { userId: id, error: cacheError.message });
      }
      
      return user;

    } catch (error) {
      this.logger.error('Failed to find user by ID', { userId: id, error: error.message });
      throw error;
    }
  }

  async findByUsername(username) {
    try {
      const query = `
        SELECT u.id, u.username, u.password_hash as password, u.full_name, u.role_id, 
               u.is_active, u.last_login, u.created_at,
               r.id as role_id_ref, r.role_name, r.role_description, r.permissions
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        WHERE u.username = $1
      `;

      const result = await this.db.query(query, [username]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this._mapRowToUser(result.rows[0]);

    } catch (error) {
      this.logger.error('Failed to find user by username', { username, error: error.message });
      throw error;
    }
  }

  async findAll({ includeInactive = false, page = 1, limit = 50, includeRole = true } = {}) {
    try {
      const offset = (page - 1) * limit;
      
      let whereClause = '';
      let params = [];
      
      if (!includeInactive) {
        whereClause = 'WHERE u.is_active = true';
      }

      const countQuery = `
        SELECT COUNT(*) as total 
        FROM users u 
        ${whereClause}
      `;

      const selectQuery = `
        SELECT u.id, u.username, u.full_name, u.role_id, 
               u.is_active, u.last_login, u.created_at
        ${includeRole ? `, r.id as role_id_ref, r.role_name, r.role_description, r.permissions` : ''}
        FROM users u
        ${includeRole ? 'LEFT JOIN roles r ON u.role_id = r.id' : ''}
        ${whereClause}
        ORDER BY u.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;

      params.push(limit, offset);

      const [countResult, selectResult] = await Promise.all([
        this.db.query(countQuery),
        this.db.query(selectQuery, params)
      ]);

      const total = parseInt(countResult.rows[0].total);
      const users = selectResult.rows.map(row => this._mapRowToUser(row));

      return {
        users,
        total
      };

    } catch (error) {
      this.logger.error('Failed to find all users', { error: error.message });
      throw error;
    }
  }

  async create(user) {
    const client = await this.db.getClient();
    
    try {
      await client.query('BEGIN');

      const query = `
        INSERT INTO users (username, password_hash, full_name, role_id, is_active)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, username, full_name, role_id, is_active, created_at
      `;

      const values = [
        user.username,
        user.password,
        user.fullName,
        user.roleId,
        user.isActive
      ];

      const result = await client.query(query, values);
      
      await client.query('COMMIT');

      const newUser = new User({
        id: result.rows[0].id,
        username: result.rows[0].username,
        fullName: result.rows[0].full_name,
        roleId: result.rows[0].role_id,
        isActive: result.rows[0].is_active,
        createdAt: result.rows[0].created_at
      });

      // Invalidate cache
      await this._invalidateUserCache(newUser.id);

      return newUser;

    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Failed to create user', { 
        username: user.username, 
        error: error.message 
      });
      throw error;
    } finally {
      client.release();
    }
  }

  async update(id, userData) {
    const client = await this.db.getClient();
    
    try {
      await client.query('BEGIN');

      const setClause = [];
      const values = [];
      let paramCount = 1;

      // Build dynamic update query
      if (userData.username !== undefined) {
        setClause.push(`username = $${paramCount++}`);
        values.push(userData.username);
      }
      if (userData.fullName !== undefined) {
        setClause.push(`full_name = $${paramCount++}`);
        values.push(userData.fullName);
      }
      if (userData.roleId !== undefined) {
        setClause.push(`role_id = $${paramCount++}`);
        values.push(userData.roleId);
      }
      if (userData.isActive !== undefined) {
        setClause.push(`is_active = $${paramCount++}`);
        values.push(userData.isActive);
      }
      if (userData.password !== undefined) {
        setClause.push(`password_hash = $${paramCount++}`);
        values.push(userData.password);
      }
      if (userData.lastLogin !== undefined) {
        setClause.push(`last_login = $${paramCount++}`);
        values.push(userData.lastLogin);
      }

      if (setClause.length === 0) {
        throw new Error('No fields to update');
      }

      values.push(id);

      const query = `
        UPDATE users 
        SET ${setClause.join(', ')}
        WHERE id = $${paramCount}
        RETURNING id, username, full_name, role_id, is_active, created_at
      `;

      const result = await client.query(query, values);
      
      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      await client.query('COMMIT');

      // Invalidate cache
      await this._invalidateUserCache(id);

      return this._mapRowToUser(result.rows[0]);

    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Failed to update user', { userId: id, error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  async delete(id) {
    const client = await this.db.getClient();
    
    try {
      await client.query('BEGIN');

      const query = 'DELETE FROM users WHERE id = $1 RETURNING username';
      const result = await client.query(query, [id]);

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      await client.query('COMMIT');

      // Invalidate cache
      await this._invalidateUserCache(id);

      return result.rows[0];

    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Failed to delete user', { userId: id, error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  async updateLastLogin(id) {
    try {
      const query = 'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1';
      await this.db.query(query, [id]);
      
      // Invalidate cache
      await this._invalidateUserCache(id);

    } catch (error) {
      this.logger.error('Failed to update last login', { userId: id, error: error.message });
      throw error;
    }
  }

  // Helper methods
  _mapRowToUser(row) {
    if (!row) return null;

    let role = null;
    if (row.role_name) {
      role = new Role({
        id: row.role_id_ref || row.role_id,
        roleName: row.role_name,
        roleDescription: row.role_description,
        permissions: row.permissions || {}
      });
    }

    return new User({
      id: row.id,
      username: row.username,
      password: row.password,
      fullName: row.full_name,
      roleId: row.role_id,
      isActive: row.is_active,
      lastLogin: row.last_login,
      createdAt: row.created_at,
      role
    });
  }

  async _invalidateUserCache(userId) {
    try {
      const cacheKey = `${this.cachePrefix}${userId}`;
      await this.cache.delete(cacheKey);
    } catch (error) {
      this.logger.debug('Cache invalidation failed (cache may not be available)', { userId, error: error.message });
    }
  }
}

module.exports = UserRepository;