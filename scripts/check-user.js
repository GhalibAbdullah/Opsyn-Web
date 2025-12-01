#!/usr/bin/env node

/**
 * Script to check user account status and platform association
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

const email = process.argv[2] || 'zohhazhar13@gmail.com';

async function checkUser() {
    let dataSource;
    let sqlitePath;
    
    try {
        const dbType = process.env.AP_DB_TYPE || 'SQLITE3';
        
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
            // Check dev/config first (where server uses it)
            const devConfigPath = path.join(process.cwd(), 'dev', 'config', 'database.sqlite');
            if (fs.existsSync(devConfigPath)) {
                sqlitePath = path.resolve(devConfigPath);
            } else {
                const configPath = process.env.AP_CONFIG_PATH || path.join(os.homedir(), '.activepieces');
                sqlitePath = path.resolve(path.join(configPath, 'database.sqlite'));
            }
            
            dataSource = new DataSource({
                type: 'sqlite',
                database: sqlitePath,
            });
        }
        
        await dataSource.initialize();
        console.log('✅ Database connected\n');
        
        const cleanedEmail = email.toLowerCase().trim();
        
        // Get user identity
        let userIdentity;
        if (dbType === 'POSTGRES') {
            userIdentity = await dataSource.query(
                `SELECT * FROM user_identity WHERE LOWER(TRIM(email)) = $1`,
                [cleanedEmail]
            );
        } else {
            userIdentity = await dataSource.query(
                `SELECT * FROM user_identity WHERE LOWER(TRIM(email)) = ?`,
                [cleanedEmail]
            );
        }
        
        if (!userIdentity || userIdentity.length === 0) {
            console.error(`❌ User with email ${email} not found`);
            process.exit(1);
        }
        
        const identity = userIdentity[0];
        console.log('📧 User Identity:');
        console.log(`   Email: ${identity.email}`);
        console.log(`   Name: ${identity.firstName} ${identity.lastName}`);
        console.log(`   Verified: ${identity.verified}`);
        console.log(`   Provider: ${identity.provider}`);
        console.log(`   ID: ${identity.id}\n`);
        
        // Get user record(s)
        let users;
        if (dbType === 'POSTGRES') {
            users = await dataSource.query(
                `SELECT u.*, p.id as platform_id, p.name as platform_name 
                 FROM "user" u 
                 LEFT JOIN platform p ON u."platformId" = p.id 
                 WHERE u."identityId" = $1`,
                [identity.id]
            );
        } else {
            users = await dataSource.query(
                `SELECT u.*, p.id as platform_id, p.name as platform_name 
                 FROM user u 
                 LEFT JOIN platform p ON u.platformId = p.id 
                 WHERE u.identityId = ?`,
                [identity.id]
            );
        }
        
        console.log(`👤 User Records (${users.length}):`);
        if (users.length === 0) {
            console.error('   ❌ No user records found! This is the problem.');
            console.error('   The user identity exists but there\'s no user record in the user table.');
            console.error('   This means the user can\'t sign in because they\'re not associated with any platform.\n');
        } else {
            users.forEach((user, index) => {
                console.log(`   User ${index + 1}:`);
                console.log(`      User ID: ${user.id}`);
                console.log(`      Platform ID: ${user.platformId || '(none)'}`);
                console.log(`      Platform Name: ${user.platform_name || '(none)'}`);
                console.log(`      Platform Role: ${user.platformRole}`);
                console.log(`      Status: ${user.status || 'ACTIVE'}`);
            });
        }
        
        // Get projects for the user
        if (users.length > 0 && users[0].platformId) {
            let projects;
            if (dbType === 'POSTGRES') {
                projects = await dataSource.query(
                    `SELECT p.* FROM project p 
                     INNER JOIN project_member pm ON p.id = pm."projectId" 
                     WHERE pm."userId" = $1 OR p."ownerId" = $1`,
                    [users[0].id]
                );
            } else {
                projects = await dataSource.query(
                    `SELECT p.* FROM project p 
                     INNER JOIN project_member pm ON p.id = pm.projectId 
                     WHERE pm.userId = ? OR p.ownerId = ?`,
                    [users[0].id, users[0].id]
                );
            }
            
            console.log(`\n📁 Projects (${projects.length}):`);
            if (projects.length === 0) {
                console.log('   (no projects)');
            } else {
                projects.forEach(project => {
                    console.log(`   - ${project.displayName || project.name} (${project.id})`);
                });
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        if (dataSource && dataSource.isInitialized) {
            await dataSource.destroy();
        }
    }
}

checkUser();

