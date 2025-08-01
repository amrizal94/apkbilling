const fs = require('fs').promises;
const path = require('path');
const db = require('../config/database');

class DatabaseMigrator {
    constructor() {
        this.migrationsPath = path.join(__dirname, '../../database/migrations');
        this.seedsPath = path.join(__dirname, '../../database/seeds');
    }

    async ensureMigrationsTable() {
        const query = `
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version VARCHAR(255) PRIMARY KEY,
                applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `;
        
        try {
            await db.execute(query);
            console.log('✓ Migrations table ensured');
        } catch (error) {
            console.error('✗ Failed to create migrations table:', error.message);
            throw error;
        }
    }

    async getAppliedMigrations() {
        try {
            const [rows] = await db.execute('SELECT version FROM schema_migrations ORDER BY version');
            return rows.map(row => row.version);
        } catch (error) {
            console.error('✗ Failed to get applied migrations:', error.message);
            return [];
        }
    }

    async getPendingMigrations() {
        try {
            const files = await fs.readdir(this.migrationsPath);
            const migrationFiles = files
                .filter(file => file.endsWith('.sql'))
                .sort();

            const appliedMigrations = await this.getAppliedMigrations();
            
            return migrationFiles
                .map(file => path.parse(file).name)
                .filter(migration => !appliedMigrations.includes(migration));
        } catch (error) {
            console.error('✗ Failed to get pending migrations:', error.message);
            return [];
        }
    }

    async runMigration(migrationName) {
        const migrationPath = path.join(this.migrationsPath, `${migrationName}.sql`);
        
        try {
            const sql = await fs.readFile(migrationPath, 'utf8');
            
            // Begin transaction
            await db.execute('BEGIN');
            
            try {
                // Execute migration SQL
                await db.execute(sql);
                
                // Record migration as applied (if not already recorded in SQL)
                await db.execute(
                    'INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT (version) DO NOTHING',
                    [migrationName]
                );
                
                // Commit transaction
                await db.execute('COMMIT');
                
                console.log(`✓ Applied migration: ${migrationName}`);
                return true;
            } catch (error) {
                // Rollback transaction
                await db.execute('ROLLBACK');
                throw error;
            }
        } catch (error) {
            console.error(`✗ Failed to apply migration ${migrationName}:`, error.message);
            throw error;
        }
    }

    async runAllPendingMigrations() {
        await this.ensureMigrationsTable();
        
        const pendingMigrations = await this.getPendingMigrations();
        
        if (pendingMigrations.length === 0) {
            console.log('✓ No pending migrations');
            return true;
        }

        console.log(`Found ${pendingMigrations.length} pending migrations`);
        
        for (const migration of pendingMigrations) {
            await this.runMigration(migration);
        }
        
        console.log(`✓ Applied ${pendingMigrations.length} migrations successfully`);
        return true;
    }

    async runSeeds() {
        try {
            const files = await fs.readdir(this.seedsPath);
            const seedFiles = files
                .filter(file => file.endsWith('.sql'))
                .sort();

            if (seedFiles.length === 0) {
                console.log('✓ No seed files found');
                return true;
            }

            console.log(`Found ${seedFiles.length} seed files`);

            for (const seedFile of seedFiles) {
                const seedPath = path.join(this.seedsPath, seedFile);
                const sql = await fs.readFile(seedPath, 'utf8');
                
                try {
                    await db.execute(sql);
                    console.log(`✓ Applied seed: ${seedFile}`);
                } catch (error) {
                    console.log(`- Seed ${seedFile} already applied or failed:`, error.message);
                }
            }
            
            console.log('✓ Seeds completed');
            return true;
        } catch (error) {
            console.error('✗ Failed to run seeds:', error.message);
            throw error;
        }
    }

    async createDatabase() {
        const dbName = process.env.DB_NAME || 'apkbilling_dev';
        
        try {
            console.log(`🔧 Checking if database '${dbName}' exists...`);
            
            // Connect to postgres database first
            const tempDb = require('../config/database-setup');
            
            // Check if database exists
            const [rows] = await tempDb.execute(
                'SELECT 1 FROM pg_database WHERE datname = $1',
                [dbName]
            );
            
            if (rows.length === 0) {
                console.log(`🏗️  Creating database: ${dbName}`);
                // Create database - need to use query directly for CREATE DATABASE
                const client = await tempDb.connect();
                try {
                    await client.query(`CREATE DATABASE "${dbName}"`);
                    console.log(`✓ Created database: ${dbName}`);
                } finally {
                    client.release();
                }
            } else {
                console.log(`✓ Database ${dbName} already exists`);
            }
            
            // Don't close the pool, just return
            return true;
        } catch (error) {
            console.error('✗ Failed to create database:', error.message);
            
            // If permission denied, suggest running as superuser
            if (error.code === '42501') {
                console.log('💡 Permission denied. You may need to:');
                console.log('   1. Run as database superuser');
                console.log('   2. Or create database manually:');
                console.log(`   CREATE DATABASE "${dbName}";`);
            }
            
            throw error;
        }
    }

    async initialize() {
        try {
            console.log('🚀 Starting database initialization...');
            
            // Step 1: Create database if not exists
            await this.createDatabase();
            
            // Step 2: Run migrations
            await this.runAllPendingMigrations();
            
            // Step 3: Run seeds
            await this.runSeeds();
            
            console.log('✅ Database initialization completed successfully!');
            return true;
        } catch (error) {
            console.error('❌ Database initialization failed:', error.message);
            throw error;
        }
    }
}

module.exports = DatabaseMigrator;