#!/usr/bin/env node

/**
 * Script to check database status and list tables
 */

const { DataSource } = require('typeorm');
const path = require('path');
const fs = require('fs');
const os = require('os');

async function checkDatabase() {
    const dbType = process.env.AP_DB_TYPE || 'SQLITE3';
    let dataSource;
    
    try {
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
            
            console.log(`Checking SQLite database at: ${sqlitePath}`);
            console.log(`File exists: ${fs.existsSync(sqlitePath)}`);
            if (fs.existsSync(sqlitePath)) {
                const stats = fs.statSync(sqlitePath);
                console.log(`File size: ${stats.size} bytes`);
            }
            
            dataSource = new DataSource({
                type: 'sqlite',
                database: sqlitePath,
            });
        }
        
        await dataSource.initialize();
        console.log('\n✅ Database connection established\n');
        
        // List all tables
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
        
        console.log(`Found ${tables.length} tables:`);
        if (tables.length === 0) {
            console.log('  (no tables found - database is empty)');
        } else {
            tables.forEach(table => console.log(`  - ${table}`));
        }
        
        // Check for user_identity table
        if (tables.includes('user_identity')) {
            console.log('\n✅ user_identity table exists!');
            
            // Count users
            let userCount;
            if (dbType === 'POSTGRES') {
                const result = await dataSource.query(`SELECT COUNT(*) as count FROM user_identity`);
                userCount = parseInt(result[0].count);
            } else {
                const result = await dataSource.query(`SELECT COUNT(*) as count FROM user_identity`);
                userCount = parseInt(result[0].count);
            }
            console.log(`   Total users: ${userCount}`);
            
            if (userCount > 0) {
                // List users
                let users;
                if (dbType === 'POSTGRES') {
                    users = await dataSource.query(
                        `SELECT email, "firstName", "lastName", verified FROM user_identity LIMIT 10`
                    );
                } else {
                    users = await dataSource.query(
                        `SELECT email, firstName, lastName, verified FROM user_identity LIMIT 10`
                    );
                }
                console.log('\n   Users:');
                users.forEach(user => {
                    console.log(`     - ${user.email} (${user.firstName} ${user.lastName}) - Verified: ${user.verified}`);
                });
            }
        } else {
            console.log('\n❌ user_identity table does NOT exist');
            console.log('\nThis means migrations haven\'t run.');
            console.log('\nTo fix:');
            console.log('  1. Make sure your server is starting correctly');
            console.log('  2. Check server logs for migration errors');
            console.log('  3. The server should automatically run migrations on startup');
            console.log('  4. If migrations fail, you may need to delete the database file and let it recreate');
        }
        
        // Check for old user table
        if (tables.includes('user') && !tables.includes('user_identity')) {
            console.log('\n⚠️  Found old "user" table but not "user_identity"');
            console.log('   This database needs migration to the new schema');
        }
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error);
    } finally {
        if (dataSource && dataSource.isInitialized) {
            await dataSource.destroy();
        }
    }
}

// Load .env file
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
checkDatabase();

