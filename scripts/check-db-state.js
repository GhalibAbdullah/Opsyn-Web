#!/usr/bin/env node

/**
 * Script to check database state for projects f and z_ and their members
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

async function checkDbState() {
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
        
        // Find projects f and z_
        let projects;
        if (dbType === 'POSTGRES') {
            projects = await dataSource.query(
                `SELECT id, "displayName", "ownerId", "platformId", created, updated
                 FROM project
                 WHERE "displayName" IN ('f', 'z_') OR id IN (
                     SELECT id FROM project WHERE "displayName" = 'f' OR "displayName" = 'z_'
                 )
                 ORDER BY "displayName"`,
                []
            );
        } else {
            projects = await dataSource.query(
                `SELECT id, displayName, ownerId, platformId, created, updated
                 FROM project
                 WHERE displayName IN ('f', 'z_')
                 ORDER BY displayName`,
                []
            );
        }
        
        console.log('📁 PROJECTS TABLE:');
        console.log('='.repeat(80));
        if (projects.length === 0) {
            console.log('No projects found with displayName "f" or "z_"');
        } else {
            projects.forEach((p, i) => {
                console.log(`\nProject ${i + 1}:`);
                console.log(`  id: ${p.id || p.id}`);
                console.log(`  displayName: ${p.displayName || p.displayName}`);
                console.log(`  ownerId: ${p.ownerId || p.ownerId}`);
                console.log(`  platformId: ${p.platformId || p.platformId}`);
                console.log(`  created: ${p.created || p.created}`);
                console.log(`  updated: ${p.updated || p.updated}`);
            });
        }
        
        // Get user IDs for bsd and Zohha
        let bsdUser, zohhaUser;
        if (dbType === 'POSTGRES') {
            const bsdUsers = await dataSource.query(
                `SELECT u.id, ui.email
                 FROM "user" u
                 JOIN user_identity ui ON u."identityId" = ui.id
                 WHERE LOWER(TRIM(ui.email)) = 'bsdsf22m042@pucit.edu.pk'`,
                []
            );
            bsdUser = bsdUsers[0];
            
            const zohhaUsers = await dataSource.query(
                `SELECT u.id, ui.email
                 FROM "user" u
                 JOIN user_identity ui ON u."identityId" = ui.id
                 WHERE LOWER(TRIM(ui.email)) = 'zohhazhar13@gmail.com'`,
                []
            );
            zohhaUser = zohhaUsers[0];
        } else {
            const bsdUsers = await dataSource.query(
                `SELECT u.id, ui.email
                 FROM user u
                 JOIN user_identity ui ON u.identityId = ui.id
                 WHERE LOWER(TRIM(ui.email)) = 'bsdsf22m042@pucit.edu.pk'`,
                []
            );
            bsdUser = bsdUsers[0];
            
            const zohhaUsers = await dataSource.query(
                `SELECT u.id, ui.email
                 FROM user u
                 JOIN user_identity ui ON u.identityId = ui.id
                 WHERE LOWER(TRIM(ui.email)) = 'zohhazhar13@gmail.com'`,
                []
            );
            zohhaUser = zohhaUsers[0];
        }
        
        console.log('\n\n👤 USER IDs:');
        console.log('='.repeat(80));
        if (bsdUser) {
            console.log(`bsd: ${bsdUser.id} (${bsdUser.email})`);
        } else {
            console.log('bsd: NOT FOUND');
        }
        if (zohhaUser) {
            console.log(`Zohha: ${zohhaUser.id} (${zohhaUser.email})`);
        } else {
            console.log('Zohha: NOT FOUND');
        }
        
        // Get project_member records for these projects and users
        if (projects.length > 0 && (bsdUser || zohhaUser)) {
            const projectIds = projects.map(p => p.id || p.id);
            const userIds = [];
            if (bsdUser) userIds.push(bsdUser.id);
            if (zohhaUser) userIds.push(zohhaUser.id);
            
            let members;
            if (dbType === 'POSTGRES') {
                members = await dataSource.query(
                    `SELECT pm.id, pm."projectId", pm."userId", pm.role, pm."platformId", pm.created, pm.updated,
                            p."displayName" as project_name,
                            ui.email as user_email
                     FROM project_member pm
                     JOIN project p ON pm."projectId" = p.id
                     JOIN "user" u ON pm."userId" = u.id
                     JOIN user_identity ui ON u."identityId" = ui.id
                     WHERE pm."projectId" = ANY($1::text[]) AND pm."userId" = ANY($2::text[])
                     ORDER BY p."displayName", ui.email`,
                    [projectIds, userIds]
                );
            } else {
                const placeholders = projectIds.map(() => '?').join(',');
                const userPlaceholders = userIds.map(() => '?').join(',');
                members = await dataSource.query(
                    `SELECT pm.id, pm.projectId, pm.userId, pm.role, pm.platformId, pm.created, pm.updated,
                            p.displayName as project_name,
                            ui.email as user_email
                     FROM project_member pm
                     JOIN project p ON pm.projectId = p.id
                     JOIN user u ON pm.userId = u.id
                     JOIN user_identity ui ON u.identityId = ui.id
                     WHERE pm.projectId IN (${placeholders}) AND pm.userId IN (${userPlaceholders})
                     ORDER BY p.displayName, ui.email`,
                    [...projectIds, ...userIds]
                );
            }
            
            console.log('\n\n📋 PROJECT_MEMBER TABLE:');
            console.log('='.repeat(80));
            if (members.length === 0) {
                console.log('No ProjectMember records found for projects f/z_ and users bsd/Zohha');
            } else {
                members.forEach((m, i) => {
                    console.log(`\nMember ${i + 1}:`);
                    console.log(`  id: ${m.id || m.id}`);
                    console.log(`  projectId: ${m.projectId || m.projectId}`);
                    console.log(`  projectName: ${m.project_name || m.project_name}`);
                    console.log(`  userId: ${m.userId || m.userId}`);
                    console.log(`  userEmail: ${m.user_email || m.user_email}`);
                    console.log(`  role: ${m.role || m.role}`);
                    console.log(`  platformId: ${m.platformId || m.platformId}`);
                    console.log(`  created: ${m.created || m.created}`);
                    console.log(`  updated: ${m.updated || m.updated}`);
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

checkDbState();

