#!/usr/bin/env node

/**
 * Script to remove Zohha from project f and then test the API
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

async function removeZohhaFromF() {
    let dataSource;
    
    try {
        const dbType = process.env.AP_DB_TYPE || (process.env.AP_POSTGRES_URL || process.env.AP_POSTGRES_HOST ? 'POSTGRES' : 'SQLITE3');
        
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
            const devConfigPath = path.join(process.cwd(), 'dev', 'config', 'database.sqlite');
            let sqlitePath;
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
        
        // Find project "f"
        let projectF;
        if (dbType === 'POSTGRES') {
            const projects = await dataSource.query(
                `SELECT id, "displayName", "ownerId" FROM project WHERE "displayName" = 'f'`,
                []
            );
            projectF = projects[0];
        } else {
            const projects = await dataSource.query(
                `SELECT id, displayName, ownerId FROM project WHERE displayName = 'f'`,
                []
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
                 WHERE LOWER(TRIM(ui.email)) = 'zohhazhar13@gmail.com'`,
                []
            );
            zohhaUser = users[0];
        } else {
            const users = await dataSource.query(
                `SELECT u.id, ui.email
                 FROM user u
                 JOIN user_identity ui ON u.identityId = ui.id
                 WHERE LOWER(TRIM(ui.email)) = 'zohhazhar13@gmail.com'`,
                []
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
                `SELECT * FROM project_member WHERE "projectId" = $1 AND "userId" = $2`,
                [projectF.id || projectF.id, zohhaUser.id]
            );
            existingMember = members[0];
        } else {
            const members = await dataSource.query(
                `SELECT * FROM project_member WHERE projectId = ? AND userId = ?`,
                [projectF.id || projectF.id, zohhaUser.id]
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
                await dataSource.query(
                    `DELETE FROM project_member WHERE id = $1`,
                    [existingMember.id || existingMember.id]
                );
            } else {
                await dataSource.query(
                    `DELETE FROM project_member WHERE id = ?`,
                    [existingMember.id || existingMember.id]
                );
            }
            console.log('✅ Deleted successfully\n');
        } else {
            console.log('ℹ️  No ProjectMember record found for Zohha in project f\n');
        }
        
        // Verify deletion
        let verifyMember;
        if (dbType === 'POSTGRES') {
            const members = await dataSource.query(
                `SELECT * FROM project_member WHERE "projectId" = $1 AND "userId" = $2`,
                [projectF.id || projectF.id, zohhaUser.id]
            );
            verifyMember = members[0];
        } else {
            const members = await dataSource.query(
                `SELECT * FROM project_member WHERE projectId = ? AND userId = ?`,
                [projectF.id || projectF.id, zohhaUser.id]
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
        console.log('   2. Test the API endpoints:');
        console.log(`      GET /v1/project-members?projectId=${projectF.id || projectF.id}`);
        console.log('      GET /v1/project-members?projectId=<z_ project id>');
        console.log('   3. Verify that:');
        console.log('      - Project f has no entry for Zohha');
        console.log('      - Project z_ still shows Zohha as owner and bsd as editor');
        
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

removeZohhaFromF();

