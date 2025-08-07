/**
 * Response Handler
 * Standardizes HTTP responses across the application
 */
class ResponseHandler {
  constructor({ logger }) {
    this.logger = logger;
  }

  /**
   * Send successful response
   */
  success(res, data = null, message = 'Success', statusCode = 200) {
    const response = {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    };

    if (data === null || data === undefined) {
      delete response.data;
    }

    this.logger.debug('Success response sent', { 
      statusCode, 
      message,
      hasData: data !== null && data !== undefined 
    });

    return res.status(statusCode).json(response);
  }

  /**
   * Send error response
   */
  error(res, message = 'An error occurred', statusCode = 500, errors = null) {
    const response = {
      success: false,
      message,
      timestamp: new Date().toISOString()
    };

    if (errors) {
      response.errors = errors;
    }

    // Log error responses
    if (statusCode >= 500) {
      this.logger.error('Server error response', { statusCode, message, errors });
    } else if (statusCode >= 400) {
      this.logger.warn('Client error response', { statusCode, message, errors });
    }

    return res.status(statusCode).json(response);
  }

  /**
   * Send validation error response
   */
  validationError(res, errors, message = 'Validation failed') {
    return this.error(res, message, 400, errors);
  }

  /**
   * Send not found response
   */
  notFound(res, message = 'Resource not found') {
    return this.error(res, message, 404);
  }

  /**
   * Send unauthorized response
   */
  unauthorized(res, message = 'Unauthorized access') {
    return this.error(res, message, 401);
  }

  /**
   * Send forbidden response
   */
  forbidden(res, message = 'Access forbidden') {
    return this.error(res, message, 403);
  }

  /**
   * Send conflict response
   */
  conflict(res, message = 'Resource conflict') {
    return this.error(res, message, 409);
  }

  /**
   * Send paginated response
   */
  paginated(res, data, pagination, message = 'Data retrieved successfully') {
    const response = {
      success: true,
      message,
      data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        totalPages: pagination.totalPages,
        hasNext: pagination.page < pagination.totalPages,
        hasPrev: pagination.page > 1
      },
      timestamp: new Date().toISOString()
    };

    this.logger.debug('Paginated response sent', { 
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      itemCount: data ? data.length : 0
    });

    return res.status(200).json(response);
  }

  /**
   * Send created response
   */
  created(res, data, message = 'Resource created successfully') {
    return this.success(res, data, message, 201);
  }

  /**
   * Send updated response
   */
  updated(res, data, message = 'Resource updated successfully') {
    return this.success(res, data, message, 200);
  }

  /**
   * Send deleted response
   */
  deleted(res, message = 'Resource deleted successfully') {
    return this.success(res, null, message, 200);
  }

  /**
   * Send no content response
   */
  noContent(res) {
    return res.status(204).send();
  }

  /**
   * Send rate limit exceeded response
   */
  rateLimitExceeded(res, message = 'Too many requests, please try again later') {
    return this.error(res, message, 429);
  }

  /**
   * Send maintenance mode response
   */
  maintenance(res, message = 'Service temporarily unavailable for maintenance') {
    return this.error(res, message, 503);
  }

  /**
   * Send health check response
   */
  health(res, status = 'healthy', checks = {}) {
    const isHealthy = Object.values(checks).every(check => check.status === 'healthy');
    const statusCode = isHealthy ? 200 : 503;

    const response = {
      success: isHealthy,
      status,
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || '2.0.0',
      uptime: process.uptime(),
      checks
    };

    return res.status(statusCode).json(response);
  }

  /**
   * Handle async route errors
   */
  asyncHandler(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  /**
   * Send file download response
   */
  download(res, filePath, filename, message = 'File ready for download') {
    this.logger.info('File download requested', { filename, filePath });
    
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    
    return res.download(filePath, filename, (err) => {
      if (err) {
        this.logger.error('File download failed', { error: err.message, filename });
        if (!res.headersSent) {
          this.error(res, 'File download failed', 500);
        }
      } else {
        this.logger.info('File download completed', { filename });
      }
    });
  }

  /**
   * Send streaming response
   */
  stream(res, stream, contentType = 'application/octet-stream') {
    res.setHeader('Content-Type', contentType);
    stream.pipe(res);

    stream.on('error', (err) => {
      this.logger.error('Stream error', { error: err.message });
      if (!res.headersSent) {
        this.error(res, 'Stream error', 500);
      }
    });
  }
}

module.exports = ResponseHandler;