#!/usr/bin/env node

/**
 * Script to delete Zohha from project f using the project's database connection
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

async function deleteZohhaFromF() {
    let dataSource;
    
    try {
        // Try to determine database type from environment
        const dbType = process.env.AP_DB_TYPE || (process.env.AP_POSTGRES_URL || process.env.AP_POSTGRES_HOST ? 'POSTGRES' : 'SQLITE3');
        
        console.log(`🔍 Detected database type: ${dbType}\n`);
        
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
            // Try to find SQLite database
            const devConfigPath = path.join(process.cwd(), 'dev', 'config', 'database.sqlite');
            let sqlitePath;
            if (fs.existsSync(devConfigPath)) {
                sqlitePath = path.resolve(devConfigPath);
            } else {
                const configPath = process.env.AP_CONFIG_PATH || path.join(os.homedir(), '.activepieces');
                sqlitePath = path.resolve(path.join(configPath, 'database.sqlite'));
            }
            
            if (!fs.existsSync(sqlitePath)) {
                console.error(`❌ SQLite database not found at: ${sqlitePath}`);
                console.error('   Please check your AP_CONFIG_PATH or ensure the database exists.');
                process.exit(1);
            }
            
            console.log(`📁 Using SQLite database at: ${sqlitePath}\n`);
            
            dataSource = new DataSource({
                type: 'sqlite',
                database: sqlitePath,
            });
        }
        
        await dataSource.initialize();
        console.log('✅ Database connected\n');
        
        // Find project "f"
        let projectF;
        if (dbType === 'POSTGRES') {
            const projects = await dataSource.query(
                `SELECT id, "displayName", "ownerId" FROM project WHERE "displayName" = $1`,
                ['f']
            );
            projectF = projects[0];
        } else {
            const projects = await dataSource.query(
                `SELECT id, displayName, ownerId FROM project WHERE displayName = ?`,
                ['f']
            );
            projectF = projects[0];
        }
        
        if (!projectF) {
            console.error('❌ Project "f" not found');
            process.exit(1);
        }
        
        console.log(`📁 Project "f":`);
        console.log(`   ID: ${projectF.id || projectF.id}`);
        console.log(`   Owner ID: ${projectF.ownerId || projectF.ownerId}\n`);
        
        // Find Zohha's user ID
        let zohhaUser;
        if (dbType === 'POSTGRES') {
            const users = await dataSource.query(
                `SELECT u.id, ui.email
                 FROM "user" u
                 JOIN user_identity ui ON u."identityId" = ui.id
                 WHERE LOWER(TRIM(ui.email)) = $1`,
                ['zohhazhar13@gmail.com']
            );
            zohhaUser = users[0];
        } else {
            const users = await dataSource.query(
                `SELECT u.id, ui.email
                 FROM user u
                 JOIN user_identity ui ON u.identityId = ui.id
                 WHERE LOWER(TRIM(ui.email)) = ?`,
                ['zohhazhar13@gmail.com']
            );
            zohhaUser = users[0];
        }
        
        if (!zohhaUser) {
            console.error('❌ Zohha user not found');
            process.exit(1);
        }
        
        console.log(`👤 Zohha:`);
        console.log(`   User ID: ${zohhaUser.id}`);
        console.log(`   Email: ${zohhaUser.email}\n`);
        
        // Check if Zohha has a project_member record in project f
        let existingMember;
        if (dbType === 'POSTGRES') {
            const members = await dataSource.query(
                `SELECT pm.*, p."displayName" as project_name, ui.email as user_email
                 FROM project_member pm
                 JOIN project p ON pm."projectId" = p.id
                 JOIN "user" u ON pm."userId" = u.id
                 JOIN user_identity ui ON u."identityId" = ui.id
                 WHERE p."displayName" = $1 AND LOWER(TRIM(ui.email)) = $2`,
                ['f', 'zohhazhar13@gmail.com']
            );
            existingMember = members[0];
        } else {
            const members = await dataSource.query(
                `SELECT pm.*, p.displayName as project_name, ui.email as user_email
                 FROM project_member pm
                 JOIN project p ON pm.projectId = p.id
                 JOIN user u ON pm.userId = u.id
                 JOIN user_identity ui ON u.identityId = ui.id
                 WHERE p.displayName = ? AND LOWER(TRIM(ui.email)) = ?`,
                ['f', 'zohhazhar13@gmail.com']
            );
            existingMember = members[0];
        }
        
        if (existingMember) {
            console.log(`🔍 Found ProjectMember record for Zohha in project f:`);
            console.log(`   Member ID: ${existingMember.id || existingMember.id}`);
            console.log(`   Role: ${existingMember.role || existingMember.role}\n`);
            
            // Delete the record
            console.log('🗑️  Deleting ProjectMember record...');
            if (dbType === 'POSTGRES') {
                const result = await dataSource.query(
                    `DELETE FROM project_member WHERE id = $1`,
                    [existingMember.id || existingMember.id]
                );
                console.log(`   Deleted ${result[1] || 0} row(s)\n`);
            } else {
                const result = await dataSource.query(
                    `DELETE FROM project_member WHERE id = ?`,
                    [existingMember.id || existingMember.id]
                );
                console.log(`   Deleted ${result.changes || 0} row(s)\n`);
            }
            console.log('✅ Deleted successfully\n');
        } else {
            console.log('ℹ️  No ProjectMember record found for Zohha in project f\n');
            console.log('   This means Zohha is not an explicit member of project f.');
            console.log('   If she appears in the UI, it might be due to:');
            console.log('   1. Virtual member logic (if project.ownerId is wrong)');
            console.log('   2. Frontend caching');
            console.log('   3. Backend logic issue\n');
        }
        
        // Verify deletion
        let verifyMember;
        if (dbType === 'POSTGRES') {
            const members = await dataSource.query(
                `SELECT pm.* FROM project_member pm
                 JOIN project p ON pm."projectId" = p.id
                 WHERE p."displayName" = $1 AND pm."userId" = $2`,
                ['f', zohhaUser.id]
            );
            verifyMember = members[0];
        } else {
            const members = await dataSource.query(
                `SELECT pm.* FROM project_member pm
                 JOIN project p ON pm.projectId = p.id
                 WHERE p.displayName = ? AND pm.userId = ?`,
                ['f', zohhaUser.id]
            );
            verifyMember = members[0];
        }
        
        if (verifyMember) {
            console.error('❌ ERROR: ProjectMember record still exists after deletion!');
            process.exit(1);
        } else {
            console.log('✅ Verification: Zohha no longer has a ProjectMember record in project f\n');
        }
        
        console.log('='.repeat(80));
        console.log('✅ SUCCESS: Zohha has been removed from project f');
        console.log('='.repeat(80));
        console.log('\n📋 Next steps:');
        console.log('   1. Restart your backend server');
        console.log('   2. Test the API endpoints to verify the fix');
        console.log(`   3. Project f ID: ${projectF.id || projectF.id}`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.stack) {
            console.error('\nStack trace:');
            console.error(error.stack);
        }
        process.exit(1);
    } finally {
        if (dataSource && dataSource.isInitialized) {
            await dataSource.destroy();
        }
    }
}

deleteZohhaFromF();

