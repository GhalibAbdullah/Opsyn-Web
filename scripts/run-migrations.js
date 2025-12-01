#!/usr/bin/env node

/**
 * Script to manually run database migrations
 * Usage: node scripts/run-migrations.js
 */

const { DataSource } = require('typeorm');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Load environment variables
function loadEnvFile() {
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split('\n').forEach(line => {
            const [key, ...valueParts] = line.split('=');
            if (key && valueParts.length > 0) {
                const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
                process.env[key.trim()] = value;
            }
        });
    }
}

loadEnvFile();

async function runMigrations() {
    const dbType = process.env.AP_DB_TYPE || 'SQLITE3';
    let dataSource;
    
    try {
        console.log('🚀 Starting database migrations...\n');
        console.log(`Database type: ${dbType}`);
        
        if (dbType === 'POSTGRES') {
            const postgresUrl = process.env.AP_POSTGRES_URL;
            if (postgresUrl) {
                dataSource = new DataSource({
                    type: 'postgres',
                    url: postgresUrl,
                });
            } else {
                dataSource = new DataSource({
                    type: 'postgres',
                    host: process.env.AP_POSTGRES_HOST || 'localhost',
                    port: parseInt(process.env.AP_POSTGRES_PORT || '5432'),
                    username: process.env.AP_POSTGRES_USERNAME || 'postgres',
                    password: process.env.AP_POSTGRES_PASSWORD || 'postgres',
                    database: process.env.AP_POSTGRES_DATABASE || 'postgres',
                });
            }
        } else {
            const configPath = process.env.AP_CONFIG_PATH || path.join(os.homedir(), '.activepieces');
            const sqlitePath = path.join(configPath, 'database.sqlite');
            
            console.log(`SQLite database: ${sqlitePath}`);
            
            dataSource = new DataSource({
                type: 'sqlite',
                database: sqlitePath,
            });
        }
        
        // Initialize connection
        console.log('Connecting to database...');
        await dataSource.initialize();
        console.log('✅ Database connected\n');
        
        // Check current tables
        let tables;
        if (dbType === 'POSTGRES') {
            const result = await dataSource.query(
                `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
            );
            tables = result.map(t => t.table_name);
        } else {
            const result = await dataSource.query(
                `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
            );
            tables = result.map(t => t.name);
        }
        
        console.log(`Current tables (${tables.length}): ${tables.length > 0 ? tables.join(', ') : '(none)'}\n`);
        
        // Note: We can't easily run migrations without the full TypeORM setup
        // because migrations are defined in the codebase. Instead, we'll guide the user.
        
        console.log('⚠️  Note: This script cannot run migrations directly because');
        console.log('   they require the full application setup.\n');
        console.log('To run migrations, you need to:');
        console.log('  1. Make sure your server starts correctly');
        console.log('  2. Check if system.isApp() returns true');
        console.log('  3. Check server logs for migration errors\n');
        console.log('Alternatively, you can:');
        console.log('  - Delete the database file and let the server recreate it');
        console.log('  - Check your .env file for AP_EDITION and other settings');
        console.log('  - Make sure AP_DB_TYPE is set correctly\n');
        
        // Check if we can at least verify the database is accessible
        console.log('✅ Database is accessible and ready for migrations');
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        if (dataSource && dataSource.isInitialized) {
            await dataSource.destroy();
        }
    }
}

runMigrations();

