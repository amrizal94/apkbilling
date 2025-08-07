const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

/**
 * Database Infrastructure Service
 * Manages PostgreSQL connections and query execution
 */
class Database {
  constructor({ config, logger }) {
    this.config = config.database;
    this.logger = logger;
    this.pool = null;
  }

  async connect() {
    try {
      const poolConfig = {
        host: this.config.host,
        port: this.config.port,
        database: this.config.name,
        user: this.config.user,
        password: this.config.password,
        max: this.config.maxConnections,
        connectionTimeoutMillis: this.config.connectionTimeout,
        idleTimeoutMillis: 30000,
        ssl: this.config.ssl ? { rejectUnauthorized: false } : false
      };

      this.pool = new Pool(poolConfig);

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      this.logger.info('Database connected successfully', {
        host: this.config.host,
        database: this.config.name,
        maxConnections: this.config.maxConnections
      });

      // Setup query logging if enabled
      if (this.config.logging) {
        this._setupQueryLogging();
      }

    } catch (error) {
      this.logger.error('Database connection failed', {
        error: error.message,
        host: this.config.host,
        database: this.config.name
      });
      throw error;
    }
  }

  async disconnect() {
    if (this.pool) {
      await this.pool.end();
      this.logger.info('Database disconnected');
    }
  }

  async query(text, params = []) {
    const startTime = Date.now();
    
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - startTime;

      if (this.config.logging) {
        this.logger.logDatabaseQuery(text, params, duration);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger.error('Database query failed', {
        error: error.message,
        query: text.replace(/\s+/g, ' ').trim(),
        params,
        duration
      });
      
      throw error;
    }
  }

  async getClient() {
    return await this.pool.connect();
  }

  async transaction(callback) {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Health check
  async healthCheck() {
    try {
      const result = await this.query('SELECT 1 as health_check, NOW() as timestamp');
      return {
        status: 'healthy',
        timestamp: result.rows[0].timestamp,
        totalConnections: this.pool.totalCount,
        idleConnections: this.pool.idleCount,
        waitingCount: this.pool.waitingCount
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  // Migration methods
  async migrate() {
    try {
      this.logger.info('Running database migrations...');
      
      // Create migrations table if it doesn't exist
      await this.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version VARCHAR(255) PRIMARY KEY,
          applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);

      const migrationsPath = path.join(__dirname, '../../../migrations');
      const migrationFiles = await this._getMigrationFiles(migrationsPath);
      
      for (const file of migrationFiles) {
        await this._runMigration(file, migrationsPath);
      }

      this.logger.info('Database migrations completed');
    } catch (error) {
      this.logger.error('Database migration failed', { error: error.message });
      throw error;
    }
  }

  async _getMigrationFiles(migrationsPath) {
    try {
      const files = await fs.readdir(migrationsPath);
      const sqlFiles = files
        .filter(file => file.endsWith('.sql'))
        .sort();

      // Get already applied migrations
      const result = await this.query('SELECT version FROM schema_migrations');
      const appliedMigrations = result.rows.map(row => row.version);

      // Return only unapplied migrations
      return sqlFiles.filter(file => {
        const version = path.parse(file).name;
        return !appliedMigrations.includes(version);
      });
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.logger.warn('Migrations directory not found', { path: migrationsPath });
        return [];
      }
      throw error;
    }
  }

  async _runMigration(file, migrationsPath) {
    const version = path.parse(file).name;
    const filePath = path.join(migrationsPath, file);

    try {
      this.logger.info('Running migration', { version });
      
      const sql = await fs.readFile(filePath, 'utf8');
      
      await this.transaction(async (client) => {
        // Execute migration
        await client.query(sql);
        
        // Record migration
        await client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1)',
          [version]
        );
      });

      this.logger.info('Migration completed', { version });
    } catch (error) {
      this.logger.error('Migration failed', { version, error: error.message });
      throw error;
    }
  }

  _setupQueryLogging() {
    // Override pool.query to add logging
    const originalQuery = this.pool.query.bind(this.pool);
    
    this.pool.query = async (text, params) => {
      const startTime = Date.now();
      try {
        const result = await originalQuery(text, params);
        const duration = Date.now() - startTime;
        this.logger.logDatabaseQuery(text, params, duration);
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        this.logger.error('Database query failed', {
          error: error.message,
          query: text.replace(/\s+/g, ' ').trim(),
          params,
          duration
        });
        throw error;
      }
    };
  }
}

module.exports = Database;