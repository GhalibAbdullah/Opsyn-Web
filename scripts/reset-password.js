#!/usr/bin/env node

/**
 * Script to reset a user's password directly in the database
 * Usage: node scripts/reset-password.js <email> <newPassword>
 * 
 * Example: node scripts/reset-password.js user@example.com newpassword123
 */

const bcrypt = require('bcrypt');
const { DataSource } = require('typeorm');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Get command line arguments
const email = process.argv[2];
const newPassword = process.argv[3];

if (!email || !newPassword) {
    console.error('Usage: node scripts/reset-password.js <email> <newPassword>');
    console.error('Example: node scripts/reset-password.js user@example.com newpassword123');
    process.exit(1);
}

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

async function resetPassword() {
    let dataSource;
    let sqlitePath; // Declare outside the if block
    
    try {
        // Determine database type - check both AP_DB_TYPE and AP_DATABASE_TYPE
        const dbType = process.env.AP_DB_TYPE || process.env.AP_DATABASE_TYPE || 'SQLITE3';
        const cleanedEmail = email.toLowerCase().trim();
        
        console.log(`Database type: ${dbType}`);
        console.log(`AP_DB_TYPE: ${process.env.AP_DB_TYPE || '(not set)'}`);
        console.log(`AP_DATABASE_TYPE: ${process.env.AP_DATABASE_TYPE || '(not set)'}`);
        
        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        console.log('Password hashed successfully');
        
        if (dbType === 'POSTGRES') {
            // PostgreSQL connection
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
            // SQLite connection - use the same logic as the server
            let sqlitePath = process.env.AP_SQLITE_DATABASE_PATH;
            
            if (!sqlitePath) {
                // Use the same config path logic as the server
                // The server uses: process.env.AP_CONFIG_PATH or defaults to ~/.activepieces
                // But in dev mode, it might use dev/config
                let configPath = process.env.AP_CONFIG_PATH;
                
                if (!configPath) {
                    // Check if we're in dev mode - look for dev/config directory
                    const devConfigPath = path.join(process.cwd(), 'dev', 'config');
                    if (fs.existsSync(devConfigPath)) {
                        configPath = devConfigPath;
                        console.log(`Found dev/config directory, using: ${configPath}`);
                    } else {
                        configPath = path.join(os.homedir(), '.activepieces');
                    }
                }
                
                sqlitePath = path.resolve(path.join(configPath, 'database.sqlite'));
            }
            
            // Also search for other possible database files that might have data
            // The server uses dev/config/database.sqlite in development mode
            console.log('\nSearching for database files...');
            const searchPaths = [
                path.join(process.cwd(), 'dev', 'config', 'database.sqlite'), // Dev mode location (server uses this!)
                sqlitePath,
                path.join(os.homedir(), '.activepieces', 'database.sqlite'),
                path.join(process.cwd(), 'packages', 'server', 'api', 'database.sqlite'),
                path.join(process.cwd(), 'database.sqlite'),
            ];
            
            const foundDatabases = [];
            searchPaths.forEach(dbPath => {
                const resolvedPath = path.resolve(dbPath);
                if (fs.existsSync(resolvedPath)) {
                    const stats = fs.statSync(resolvedPath);
                    foundDatabases.push({
                        path: resolvedPath,
                        size: stats.size,
                        modified: stats.mtime
                    });
                }
            });
            
            if (foundDatabases.length > 0) {
                console.log('Found database files:');
                foundDatabases.forEach(db => {
                    console.log(`  - ${db.path} (${db.size} bytes, modified: ${db.modified})`);
                });
                
                // Use the largest non-empty database file (most likely to have data)
                const nonEmptyDbs = foundDatabases.filter(db => db.size > 0);
                if (nonEmptyDbs.length > 0) {
                    const largestDb = nonEmptyDbs.reduce((prev, current) => 
                        (prev.size > current.size) ? prev : current
                    );
                    console.log(`\n✅ Using largest database: ${largestDb.path} (${largestDb.size} bytes)`);
                    sqlitePath = largestDb.path;
                } else {
                    console.log('\n⚠️  All found databases are empty (0 bytes)');
                    console.log('   This might mean migrations haven\'t run yet.');
                }
            } else {
                console.log('No database files found in common locations.');
            }
            console.log('');
            
            console.log(`Using SQLite database at: ${sqlitePath}`);
            console.log(`File exists: ${fs.existsSync(sqlitePath)}`);
            if (fs.existsSync(sqlitePath)) {
                const stats = fs.statSync(sqlitePath);
                console.log(`File size: ${stats.size} bytes`);
            }
            
            // Check for WAL and journal files (SQLite might be using WAL mode)
            const walPath = sqlitePath + '-wal';
            const journalPath = sqlitePath + '-journal';
            const shmPath = sqlitePath + '-shm';
            
            if (fs.existsSync(walPath)) {
                const walStats = fs.statSync(walPath);
                console.log(`WAL file exists: ${walPath} (${walStats.size} bytes)`);
            }
            if (fs.existsSync(journalPath)) {
                const journalStats = fs.statSync(journalPath);
                console.log(`Journal file exists: ${journalPath} (${journalStats.size} bytes)`);
            }
            if (fs.existsSync(shmPath)) {
                const shmStats = fs.statSync(shmPath);
                console.log(`SHM file exists: ${shmPath} (${shmStats.size} bytes)`);
            }
            
            dataSource = new DataSource({
                type: 'sqlite',
                database: sqlitePath,
            });
        }
        
        // Initialize connection
        await dataSource.initialize();
        console.log('Database connection established');
        
        // For SQLite, verify we're connected to the right database
        if (dbType === 'SQLITE3' && sqlitePath) {
            try {
                const dbInfo = await dataSource.query("PRAGMA database_list");
                console.log('\nConnected to SQLite databases:');
                dbInfo.forEach(db => {
                    console.log(`  - ${db.name}: ${db.file || '(main)'}`);
                });
            } catch (error) {
                console.log('Could not get database info:', error.message);
            }
        }
        
        // Check what tables exist
        let tables;
        if (dbType === 'POSTGRES') {
            const tableCheck = await dataSource.query(
                `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
            );
            tables = tableCheck.map(t => t.table_name);
        } else {
            // For SQLite, also check if sqlite_master table itself exists
            try {
                const tableCheck = await dataSource.query(
                    `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
                );
                tables = tableCheck.map(t => t.name);
                
                // Also check for the migrations table to see if migrations ran
                const migrationsCheck = await dataSource.query(
                    `SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'`
                );
                if (migrationsCheck.length > 0) {
                    const migrationRecords = await dataSource.query(`SELECT * FROM migrations ORDER BY timestamp DESC LIMIT 5`);
                    console.log(`\nFound migrations table with ${migrationRecords.length} recent migrations:`);
                    migrationRecords.forEach(m => {
                        console.log(`  - ${m.name} (${new Date(parseInt(m.timestamp)).toISOString()})`);
                    });
                }
            } catch (error) {
                console.error('Error querying tables:', error.message);
                tables = [];
            }
        }
        
        console.log(`\nFound ${tables.length} tables in database:`);
        if (tables.length > 0) {
            tables.forEach(table => console.log(`  - ${table}`));
        } else {
            console.log('  (no tables found)');
        }
        console.log('');
        
        // Check if user_identity table exists
        const hasUserIdentity = tables.includes('user_identity');
        const hasUserTable = tables.includes('user');
        
        if (!hasUserIdentity && !hasUserTable) {
            console.error('❌ ERROR: Neither user_identity nor user table exists in the database.');
            console.error('This means migrations haven\'t run yet.\n');
            console.error('To fix this:');
            console.error('  1. Make sure your server started successfully');
            console.error('  2. Check server logs for migration errors');
            console.error('  3. Try starting the server again: npm run start:api');
            console.error('  4. Wait for "Migrations executed" or similar message');
            console.error('  5. Then run this script again\n');
            process.exit(1);
        }
        
        if (hasUserTable && !hasUserIdentity) {
            console.error('⚠️  WARNING: Found old "user" table but not "user_identity" table.');
            console.error('This database needs to be migrated to the new schema.\n');
            console.error('The migration should run automatically when you start the server.');
            console.error('If it didn\'t, check:');
            console.error('  1. Server logs for migration errors');
            console.error('  2. Make sure you\'re using the latest code');
            console.error('  3. The migration file: AddUserIdentity1735590074879 should run\n');
            process.exit(1);
        }
        
        if (!hasUserIdentity) {
            console.error('❌ ERROR: user_identity table does not exist.');
            console.error('Even though migrations should have created it.\n');
            console.error('Please check:');
            console.error('  1. Are you using the correct database file?');
            console.error(`  2. Database location: ${dbType === 'POSTGRES' ? 'PostgreSQL' : sqlitePath}`);
            console.error('  3. Check server logs for migration errors');
            console.error('  4. Try restarting the server\n');
            process.exit(1);
        }
        
        console.log('✅ user_identity table found!');
        
        // Check if user exists first
        let checkResult;
        if (dbType === 'POSTGRES') {
            checkResult = await dataSource.query(
                `SELECT id, email, "firstName", "lastName" FROM user_identity WHERE LOWER(TRIM(email)) = $1`,
                [cleanedEmail]
            );
        } else {
            checkResult = await dataSource.query(
                `SELECT id, email, firstName, lastName FROM user_identity WHERE LOWER(TRIM(email)) = ?`,
                [cleanedEmail]
            );
        }
        
        if (checkResult.length === 0) {
            console.error(`\n❌ User with email ${email} not found in database`);
            
            // List all users to help debug
            let allUsers;
            if (dbType === 'POSTGRES') {
                allUsers = await dataSource.query(
                    `SELECT email, "firstName", "lastName" FROM user_identity LIMIT 20`
                );
            } else {
                allUsers = await dataSource.query(
                    `SELECT email, firstName, lastName FROM user_identity LIMIT 20`
                );
            }
            
            if (allUsers.length > 0) {
                console.error(`\nFound ${allUsers.length} user(s) in database:`);
                allUsers.forEach(user => {
                    console.error(`  - ${user.email} (${user.firstName || ''} ${user.lastName || ''})`);
                });
            } else {
                console.error('\nNo users found in database at all.');
                console.error('This means either:');
                console.error('  1. You haven\'t signed up yet');
                console.error('  2. The database was reset');
                console.error('\nSince we enabled open sign-up, you can now:');
                console.error('  - Go to the sign-up page');
                console.error(`  - Sign up with email: ${email}`);
                console.error(`  - Use password: ${newPassword}`);
            }
            
            process.exit(1);
        }
        
        const user = checkResult[0];
        console.log(`Found user: ${user.email} (${user.firstName || user.firstName} ${user.lastName || user.lastName})`);
        
        // Generate new token version
        const { nanoid } = require('nanoid');
        const newTokenVersion = nanoid();
        
        // Update password
        if (dbType === 'POSTGRES') {
            await dataSource.query(
                `UPDATE user_identity 
                 SET password = $1, 
                     "tokenVersion" = $2, 
                     updated = NOW()
                 WHERE LOWER(TRIM(email)) = $3`,
                [hashedPassword, newTokenVersion, cleanedEmail]
            );
        } else {
            await dataSource.query(
                `UPDATE user_identity 
                 SET password = ?, 
                     tokenVersion = ?, 
                     updated = datetime('now')
                 WHERE LOWER(TRIM(email)) = ?`,
                [hashedPassword, newTokenVersion, cleanedEmail]
            );
        }
        
        console.log(`Password reset successfully for user: ${user.email}`);
        
        // Also verify the user if not already verified
        await dataSource.query(
            dbType === 'POSTGRES' 
                ? `UPDATE user_identity SET verified = true WHERE LOWER(TRIM(email)) = $1`
                : `UPDATE user_identity SET verified = 1 WHERE LOWER(TRIM(email)) = ?`,
            [cleanedEmail]
        );
        
        console.log('User verified status updated');
        console.log(`\nYou can now sign in with:`);
        console.log(`Email: ${email}`);
        console.log(`Password: ${newPassword}`);
        
    } catch (error) {
        console.error('Error resetting password:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        if (dataSource && dataSource.isInitialized) {
            await dataSource.destroy();
        }
    }
}

resetPassword();

