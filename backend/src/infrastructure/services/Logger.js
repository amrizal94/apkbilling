const winston = require('winston');
const path = require('path');

/**
 * Logger Service
 * Provides structured logging with different levels and formats
 */
class Logger {
  constructor({ config }) {
    this.config = config;
    this.logger = this._createLogger();
  }

  _createLogger() {
    const logDir = process.env.LOG_FILE_PATH || './logs';
    const logLevel = process.env.LOG_LEVEL || 'info';
    const isDevelopment = this.config?.app?.environment === 'development';

    // Create log format
    const logFormat = winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
      }),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.prettyPrint()
    );

    // Console format for development
    const consoleFormat = winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({
        format: 'HH:mm:ss'
      }),
      winston.format.printf(({ level, message, timestamp, ...meta }) => {
        const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
        return `${timestamp} [${level}]: ${message} ${metaStr}`;
      })
    );

    const transports = [];

    // Console transport
    if (isDevelopment || process.env.LOG_TO_CONSOLE !== 'false') {
      transports.push(
        new winston.transports.Console({
          level: logLevel,
          format: isDevelopment ? consoleFormat : logFormat
        })
      );
    }

    // File transports
    if (process.env.LOG_TO_FILE !== 'false') {
      // Error log
      transports.push(
        new winston.transports.File({
          filename: path.join(logDir, 'error.log'),
          level: 'error',
          format: logFormat,
          maxsize: parseInt(process.env.LOG_MAX_SIZE) || 52428800, // 50MB
          maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5
        })
      );

      // Combined log
      transports.push(
        new winston.transports.File({
          filename: path.join(logDir, 'combined.log'),
          format: logFormat,
          maxsize: parseInt(process.env.LOG_MAX_SIZE) || 52428800, // 50MB
          maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5
        })
      );

      // Daily rotate file
      if (process.env.LOG_ROTATE === 'true') {
        const DailyRotateFile = require('winston-daily-rotate-file');
        
        transports.push(
          new DailyRotateFile({
            filename: path.join(logDir, 'app-%DATE%.log'),
            datePattern: process.env.LOG_DATE_PATTERN || 'YYYY-MM-DD',
            maxSize: process.env.LOG_MAX_SIZE || '50m',
            maxFiles: process.env.LOG_MAX_FILES || '5d',
            format: logFormat
          })
        );
      }
    }

    return winston.createLogger({
      level: logLevel,
      format: logFormat,
      defaultMeta: { 
        service: this.config?.app?.name || 'apk-billing',
        version: this.config?.app?.version || '2.0.0',
        environment: this.config?.app?.environment || 'development'
      },
      transports
    });
  }

  // Log levels
  error(message, meta = {}) {
    this.logger.error(message, meta);
  }

  warn(message, meta = {}) {
    this.logger.warn(message, meta);
  }

  info(message, meta = {}) {
    this.logger.info(message, meta);
  }

  debug(message, meta = {}) {
    this.logger.debug(message, meta);
  }

  // Specific log methods for common scenarios
  logHttpRequest(req, res, responseTime) {
    const meta = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: req.user?.id
    };

    if (res.statusCode >= 400) {
      this.warn('HTTP Request Error', meta);
    } else {
      this.info('HTTP Request', meta);
    }
  }

  logDatabaseQuery(query, params, duration) {
    if (process.env.LOG_DATABASE_QUERIES === 'true') {
      this.debug('Database Query', {
        query: query.replace(/\s+/g, ' ').trim(),
        params,
        duration: `${duration}ms`
      });
    }
  }

  logAuthEvent(event, userId, details = {}) {
    this.info(`Auth Event: ${event}`, {
      userId,
      timestamp: new Date().toISOString(),
      ...details
    });
  }

  logBusinessEvent(event, data = {}) {
    this.info(`Business Event: ${event}`, {
      timestamp: new Date().toISOString(),
      ...data
    });
  }

  logSecurityEvent(event, details = {}) {
    this.warn(`Security Event: ${event}`, {
      timestamp: new Date().toISOString(),
      ...details
    });
  }

  logSystemEvent(event, details = {}) {
    this.info(`System Event: ${event}`, {
      timestamp: new Date().toISOString(),
      ...details
    });
  }

  // Performance logging
  startTimer(label) {
    const startTime = process.hrtime();
    return {
      end: () => {
        const diff = process.hrtime(startTime);
        const duration = diff[0] * 1000 + diff[1] * 1e-6; // Convert to milliseconds
        this.debug(`Timer: ${label}`, { duration: `${duration.toFixed(2)}ms` });
        return duration;
      }
    };
  }

  // Log with correlation ID for tracing requests
  logWithCorrelation(level, message, correlationId, meta = {}) {
    this.logger[level](message, {
      correlationId,
      ...meta
    });
  }
}

module.exports = Logger;