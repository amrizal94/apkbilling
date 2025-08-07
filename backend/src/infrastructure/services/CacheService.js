const Redis = require('redis');

/**
 * Cache Service using Redis
 * Provides caching functionality for the application
 */
class CacheService {
  constructor({ config, logger }) {
    this.config = config.redis;
    this.logger = logger;
    this.client = null;
  }

  async connect() {
    try {
      const redisConfig = {
        socket: {
          host: this.config.host,
          port: this.config.port,
          connectTimeout: 5000,  // 5 second timeout
          reconnectDelay: 1000
        },
        database: this.config.db
      };

      // Add password if provided
      if (this.config.password) {
        redisConfig.password = this.config.password;
      }

      this.client = Redis.createClient(redisConfig);

      // Error handling
      this.client.on('error', (err) => {
        this.logger.error('Redis error', { error: err.message });
      });

      this.client.on('connect', () => {
        this.logger.debug('Redis connecting...');
      });

      this.client.on('ready', () => {
        this.logger.info('Redis connected successfully');
      });

      this.client.on('end', () => {
        this.logger.info('Redis connection ended');
      });

      // Connect with timeout
      await Promise.race([
        this.client.connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Redis connection timeout')), 5000)
        )
      ]);

    } catch (error) {
      this.logger.error('Redis connection failed', {
        error: error.message,
        host: this.config.host,
        port: this.config.port
      });
      throw error;
    }
  }

  async disconnect() {
    if (this.client && this.client.isOpen) {
      await this.client.disconnect();
      this.logger.info('Redis disconnected');
    }
  }

  async get(key) {
    try {
      // Check if client is available and connected
      if (!this.client || !this.client.isOpen) {
        this.logger.debug('Cache not available, skipping get', { key });
        return null;
      }
      
      const fullKey = `${this.config.keyPrefix}${key}`;
      const value = await this.client.get(fullKey);
      
      this.logger.debug('Cache get', { key: fullKey, hit: !!value });
      
      return value;
    } catch (error) {
      this.logger.error('Cache get failed', { key, error: error.message });
      return null; // Return null instead of throwing to prevent cache errors from breaking the app
    }
  }

  async set(key, value, ttl = null) {
    try {
      // Check if client is available and connected
      if (!this.client || !this.client.isOpen) {
        this.logger.debug('Cache not available, skipping set', { key });
        return false;
      }
      
      const fullKey = `${this.config.keyPrefix}${key}`;
      const cacheTTL = ttl || this.config.ttl;

      if (cacheTTL) {
        await this.client.setEx(fullKey, cacheTTL, value);
      } else {
        await this.client.set(fullKey, value);
      }

      this.logger.debug('Cache set', { key: fullKey, ttl: cacheTTL });
      
      return true;
    } catch (error) {
      this.logger.error('Cache set failed', { key, error: error.message });
      return false;
    }
  }

  async delete(key) {
    try {
      const fullKey = `${this.config.keyPrefix}${key}`;
      const result = await this.client.del(fullKey);
      
      this.logger.debug('Cache delete', { key: fullKey, deleted: result > 0 });
      
      return result > 0;
    } catch (error) {
      this.logger.error('Cache delete failed', { key, error: error.message });
      return false;
    }
  }

  async exists(key) {
    try {
      const fullKey = `${this.config.keyPrefix}${key}`;
      const result = await this.client.exists(fullKey);
      
      this.logger.debug('Cache exists', { key: fullKey, exists: result === 1 });
      
      return result === 1;
    } catch (error) {
      this.logger.error('Cache exists failed', { key, error: error.message });
      return false;
    }
  }

  async flush() {
    try {
      await this.client.flushDb();
      this.logger.info('Cache flushed');
      return true;
    } catch (error) {
      this.logger.error('Cache flush failed', { error: error.message });
      return false;
    }
  }

  async keys(pattern = '*') {
    try {
      const fullPattern = `${this.config.keyPrefix}${pattern}`;
      const keys = await this.client.keys(fullPattern);
      
      // Remove prefix from keys
      const cleanKeys = keys.map(key => key.replace(this.config.keyPrefix, ''));
      
      this.logger.debug('Cache keys', { pattern: fullPattern, count: keys.length });
      
      return cleanKeys;
    } catch (error) {
      this.logger.error('Cache keys failed', { pattern, error: error.message });
      return [];
    }
  }

  async increment(key, increment = 1, ttl = null) {
    try {
      const fullKey = `${this.config.keyPrefix}${key}`;
      const result = await this.client.incrBy(fullKey, increment);
      
      if (ttl && result === increment) {
        // Set TTL only if this is a new key
        await this.client.expire(fullKey, ttl);
      }

      this.logger.debug('Cache increment', { key: fullKey, increment, result });
      
      return result;
    } catch (error) {
      this.logger.error('Cache increment failed', { key, error: error.message });
      return null;
    }
  }

  async setHash(key, field, value, ttl = null) {
    try {
      const fullKey = `${this.config.keyPrefix}${key}`;
      await this.client.hSet(fullKey, field, value);
      
      if (ttl) {
        await this.client.expire(fullKey, ttl);
      }

      this.logger.debug('Cache hash set', { key: fullKey, field, ttl });
      
      return true;
    } catch (error) {
      this.logger.error('Cache hash set failed', { key, field, error: error.message });
      return false;
    }
  }

  async getHash(key, field = null) {
    try {
      const fullKey = `${this.config.keyPrefix}${key}`;
      
      let result;
      if (field) {
        result = await this.client.hGet(fullKey, field);
      } else {
        result = await this.client.hGetAll(fullKey);
      }

      this.logger.debug('Cache hash get', { key: fullKey, field, hit: !!result });
      
      return result;
    } catch (error) {
      this.logger.error('Cache hash get failed', { key, field, error: error.message });
      return null;
    }
  }

  async setList(key, values, ttl = null) {
    try {
      const fullKey = `${this.config.keyPrefix}${key}`;
      
      // Clear existing list and add new values
      await this.client.del(fullKey);
      if (values.length > 0) {
        await this.client.lPush(fullKey, ...values);
      }
      
      if (ttl) {
        await this.client.expire(fullKey, ttl);
      }

      this.logger.debug('Cache list set', { key: fullKey, count: values.length, ttl });
      
      return true;
    } catch (error) {
      this.logger.error('Cache list set failed', { key, error: error.message });
      return false;
    }
  }

  async getList(key, start = 0, end = -1) {
    try {
      const fullKey = `${this.config.keyPrefix}${key}`;
      const result = await this.client.lRange(fullKey, start, end);
      
      this.logger.debug('Cache list get', { key: fullKey, start, end, count: result.length });
      
      return result;
    } catch (error) {
      this.logger.error('Cache list get failed', { key, error: error.message });
      return [];
    }
  }

  // Health check
  async healthCheck() {
    try {
      const startTime = Date.now();
      await this.client.ping();
      const responseTime = Date.now() - startTime;

      const info = await this.client.info('memory');
      const memoryInfo = this._parseRedisInfo(info);

      return {
        status: 'healthy',
        responseTime: `${responseTime}ms`,
        memory: memoryInfo
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  _parseRedisInfo(info) {
    const lines = info.split('\r\n');
    const memoryInfo = {};
    
    lines.forEach(line => {
      if (line.startsWith('used_memory_human:')) {
        memoryInfo.used = line.split(':')[1];
      } else if (line.startsWith('used_memory_peak_human:')) {
        memoryInfo.peak = line.split(':')[1];
      }
    });

    return memoryInfo;
  }
}

module.exports = CacheService;