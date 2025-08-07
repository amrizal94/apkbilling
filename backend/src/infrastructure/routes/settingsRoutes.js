const express = require('express');

/**
 * Settings Routes
 * Defines all system settings and configuration API endpoints
 */
function createSettingsRoutes(container) {
  const router = express.Router();
  
  // Get dependencies from container
  const authMiddleware = container.resolve('authMiddleware');
  const rbacMiddleware = container.resolve('rbacMiddleware');
  const responseHandler = container.resolve('responseHandler');
  const database = container.resolve('database');
  const logger = container.resolve('logger');

  // GET /api/settings/public - Get public settings (no auth required)
  router.get('/public', async (req, res) => {
    try {
      const settings = await database.query(`
        SELECT key, value, category
        FROM system_settings 
        WHERE is_active = true AND is_public = true
        ORDER BY category, key
      `);

      // Group settings by category
      const groupedSettings = settings.rows.reduce((acc, setting) => {
        if (!acc[setting.category]) {
          acc[setting.category] = {};
        }
        acc[setting.category][setting.key] = setting.value;
        return acc;
      }, {});

      return responseHandler.success(res, groupedSettings, 'Public settings retrieved successfully');
    } catch (error) {
      logger.error('Error fetching public settings', { error: error.message });
      return responseHandler.error(res, 'Failed to fetch public settings', 500);
    }
  });

  // All other settings routes require authentication
  router.use(authMiddleware.authenticate());

  // GET /api/settings - Get system settings
  router.get('/', 
    rbacMiddleware.requirePermission('system_settings'),
    async (req, res) => {
      try {
        const settings = await database.query(`
          SELECT setting_key as key, setting_value as value, description
          FROM app_settings 
          ORDER BY setting_key
        `);

        // Convert to simple array format
        const settingsData = settings.rows.map(setting => ({
          key: setting.key,
          value: setting.value,
          description: setting.description,
          category: 'general',
          dataType: 'text',
          isPublic: false
        }));

        return responseHandler.success(res, settingsData, 'Settings retrieved successfully');
      } catch (error) {
        logger.error('Error fetching settings', { error: error.message });
        return responseHandler.error(res, 'Failed to fetch settings', 500);
      }
    }
  );

  // PUT /api/settings/:key - Update setting value
  router.put('/:key', 
    rbacMiddleware.requirePermission('system_settings'),
    async (req, res) => {
      try {
        const { key } = req.params;
        const { value } = req.body;

        if (value === undefined) {
          return responseHandler.error(res, 'Value is required', 400);
        }

        // Check if setting exists
        const existingSetting = await database.query(
          'SELECT * FROM system_settings WHERE key = $1 AND is_active = true',
          [key]
        );

        if (existingSetting.rows.length === 0) {
          return responseHandler.error(res, 'Setting not found', 404);
        }

        const setting = existingSetting.rows[0];

        // Validate value based on data type
        let validatedValue = value;
        try {
          switch (setting.data_type) {
            case 'integer':
              validatedValue = parseInt(value);
              if (isNaN(validatedValue)) {
                return responseHandler.error(res, 'Value must be a valid integer', 400);
              }
              break;
            case 'decimal':
              validatedValue = parseFloat(value);
              if (isNaN(validatedValue)) {
                return responseHandler.error(res, 'Value must be a valid decimal', 400);
              }
              break;
            case 'boolean':
              validatedValue = value === true || value === 'true' || value === '1' || value === 1;
              break;
            case 'json':
              if (typeof value === 'object') {
                validatedValue = JSON.stringify(value);
              } else {
                // Validate JSON string
                JSON.parse(value);
                validatedValue = value;
              }
              break;
            case 'text':
            default:
              validatedValue = String(value);
              break;
          }
        } catch (error) {
          return responseHandler.error(res, `Invalid value for ${setting.data_type} type: ${error.message}`, 400);
        }

        // Update setting
        const updatedSetting = await database.query(`
          UPDATE system_settings 
          SET value = $1, updated_at = NOW()
          WHERE key = $2 AND is_active = true
          RETURNING *
        `, [String(validatedValue), key]);

        logger.info('Setting updated', { 
          key: key,
          oldValue: setting.value,
          newValue: String(validatedValue),
          userId: req.user?.id 
        });

        return responseHandler.success(res, {
          key: updatedSetting.rows[0].key,
          value: updatedSetting.rows[0].value,
          category: updatedSetting.rows[0].category,
          description: updatedSetting.rows[0].description
        }, 'Setting updated successfully');

      } catch (error) {
        logger.error('Error updating setting', { error: error.message });
        return responseHandler.error(res, 'Failed to update setting', 500);
      }
    }
  );

  // POST /api/settings - Create new setting
  router.post('/', 
    rbacMiddleware.requirePermission('system_settings'),
    async (req, res) => {
      try {
        const { key, value, description, category = 'general', data_type = 'text', is_public = false } = req.body;

        if (!key || value === undefined) {
          return responseHandler.error(res, 'Key and value are required', 400);
        }

        // Check if setting already exists
        const existingSetting = await database.query(
          'SELECT id FROM system_settings WHERE key = $1',
          [key]
        );

        if (existingSetting.rows.length > 0) {
          return responseHandler.error(res, 'Setting key already exists', 409);
        }

        // Validate data type
        const validDataTypes = ['text', 'integer', 'decimal', 'boolean', 'json'];
        if (!validDataTypes.includes(data_type)) {
          return responseHandler.error(res, 'Invalid data type', 400);
        }

        const newSetting = await database.query(`
          INSERT INTO system_settings (key, value, description, category, data_type, is_public, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, true)
          RETURNING *
        `, [key, String(value), description, category, data_type, is_public]);

        logger.info('Setting created', { 
          key: key,
          value: String(value),
          category: category,
          userId: req.user?.id 
        });

        return responseHandler.success(res, {
          key: newSetting.rows[0].key,
          value: newSetting.rows[0].value,
          category: newSetting.rows[0].category,
          description: newSetting.rows[0].description,
          dataType: newSetting.rows[0].data_type,
          isPublic: newSetting.rows[0].is_public
        }, 'Setting created successfully');

      } catch (error) {
        logger.error('Error creating setting', { error: error.message });
        return responseHandler.error(res, 'Failed to create setting', 500);
      }
    }
  );

  // DELETE /api/settings/:key - Delete setting
  router.delete('/:key', 
    rbacMiddleware.requirePermission('system_settings'),
    async (req, res) => {
      try {
        const { key } = req.params;

        const result = await database.query(
          'UPDATE system_settings SET is_active = false, updated_at = NOW() WHERE key = $1 AND is_active = true RETURNING *',
          [key]
        );

        if (result.rows.length === 0) {
          return responseHandler.error(res, 'Setting not found', 404);
        }

        logger.info('Setting deleted', { 
          key: key,
          userId: req.user?.id 
        });

        return responseHandler.success(res, { key: key }, 'Setting deleted successfully');
      } catch (error) {
        logger.error('Error deleting setting', { error: error.message });
        return responseHandler.error(res, 'Failed to delete setting', 500);
      }
    }
  );

  // GET /api/settings/backup - Export settings backup
  router.get('/backup', 
    rbacMiddleware.requirePermission('system_settings'),
    async (req, res) => {
      try {
        const settings = await database.query(`
          SELECT key, value, description, category, data_type, is_public
          FROM system_settings 
          WHERE is_active = true
          ORDER BY category, key
        `);

        const backup = {
          exportedAt: new Date().toISOString(),
          version: process.env.APP_VERSION || '2.0.0',
          settings: settings.rows
        };

        logger.info('Settings backup exported', { 
          settingsCount: settings.rows.length,
          userId: req.user?.id 
        });

        return responseHandler.success(res, backup, 'Settings backup exported successfully');
      } catch (error) {
        logger.error('Error exporting settings backup', { error: error.message });
        return responseHandler.error(res, 'Failed to export settings backup', 500);
      }
    }
  );

  // POST /api/settings/restore - Restore settings from backup
  router.post('/restore', 
    rbacMiddleware.requirePermission('system_settings'),
    async (req, res) => {
      try {
        const { settings, overwrite = false } = req.body;

        if (!Array.isArray(settings)) {
          return responseHandler.error(res, 'Settings must be an array', 400);
        }

        const client = await database.getClient();
        let imported = 0;
        let skipped = 0;
        let updated = 0;

        try {
          await client.query('BEGIN');

          for (const setting of settings) {
            const { key, value, description, category, data_type, is_public } = setting;

            if (!key || value === undefined) {
              skipped++;
              continue;
            }

            // Check if setting exists
            const existingResult = await client.query(
              'SELECT id FROM system_settings WHERE key = $1',
              [key]
            );

            if (existingResult.rows.length > 0) {
              if (overwrite) {
                await client.query(`
                  UPDATE system_settings 
                  SET value = $1, description = $2, category = $3, data_type = $4, is_public = $5, updated_at = NOW()
                  WHERE key = $6
                `, [String(value), description, category, data_type, is_public, key]);
                updated++;
              } else {
                skipped++;
              }
            } else {
              await client.query(`
                INSERT INTO system_settings (key, value, description, category, data_type, is_public, is_active)
                VALUES ($1, $2, $3, $4, $5, $6, true)
              `, [key, String(value), description, category, data_type, is_public]);
              imported++;
            }
          }

          await client.query('COMMIT');

          logger.info('Settings restored from backup', { 
            imported,
            updated,
            skipped,
            userId: req.user?.id 
          });

          return responseHandler.success(res, {
            imported,
            updated,
            skipped,
            total: settings.length
          }, 'Settings restored successfully');

        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }

      } catch (error) {
        logger.error('Error restoring settings', { error: error.message });
        return responseHandler.error(res, 'Failed to restore settings', 500);
      }
    }
  );

  // GET /api/settings/system/info - Get system information
  router.get('/system/info', 
    rbacMiddleware.requirePermission('system_settings'),
    async (req, res) => {
      try {
        const systemInfo = {
          version: process.env.APP_VERSION || '2.0.0',
          environment: process.env.NODE_ENV || 'development',
          platform: process.platform,
          nodeVersion: process.version,
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          server: {
            name: process.env.APP_NAME || 'APK Billing System',
            port: process.env.PORT || 3000,
            pid: process.pid
          },
          database: {
            host: process.env.DB_HOST || 'localhost',
            name: process.env.DB_NAME || 'apkbilling_dev',
            port: process.env.DB_PORT || 5432
          },
          timestamp: new Date().toISOString()
        };

        logger.info('System info retrieved', { userId: req.user?.id });

        return responseHandler.success(res, systemInfo, 'System information retrieved successfully');
      } catch (error) {
        logger.error('Error fetching system info', { error: error.message });
        return responseHandler.error(res, 'Failed to fetch system information', 500);
      }
    }
  );

  return router;
}

module.exports = createSettingsRoutes;