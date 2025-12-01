#!/usr/bin/env node

/**
 * Script to check project owner
 * Usage: node scripts/check-project-owner.js <project_id_or_name>
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

const projectIdentifier = process.argv[2] || 'TVmzIolrHNfKYNs4QFpWS';

async function checkProjectOwner() {
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
        
        // Find project by ID or name
        let project;
        if (dbType === 'POSTGRES') {
            const projects = await dataSource.query(
                `SELECT * FROM project WHERE id = $1 OR "displayName" = $1`,
                [projectIdentifier]
            );
            project = projects[0];
        } else {
            const projects = await dataSource.query(
                `SELECT * FROM project WHERE id = ? OR displayName = ?`,
                [projectIdentifier, projectIdentifier]
            );
            project = projects[0];
        }
        
        if (!project) {
            console.error(`❌ Project "${projectIdentifier}" not found`);
            process.exit(1);
        }
        
        console.log('📁 Project:');
        console.log(`   ID: ${project.id}`);
        console.log(`   Name: ${project.displayName}`);
        console.log(`   Owner ID: ${project.ownerId}`);
        console.log(`   Platform ID: ${project.platformId}\n`);
        
        // Get owner user details
        let ownerUser;
        if (dbType === 'POSTGRES') {
            const users = await dataSource.query(
                `SELECT u.*, ui.email, ui."firstName", ui."lastName"
                 FROM "user" u
                 JOIN user_identity ui ON u."identityId" = ui.id
                 WHERE u.id = $1`,
                [project.ownerId]
            );
            ownerUser = users[0];
        } else {
            const users = await dataSource.query(
                `SELECT u.*, ui.email, ui.firstName, ui.lastName
                 FROM user u
                 JOIN user_identity ui ON u.identityId = ui.id
                 WHERE u.id = ?`,
                [project.ownerId]
            );
            ownerUser = users[0];
        }
        
        if (ownerUser) {
            console.log('👤 Project Owner:');
            console.log(`   User ID: ${ownerUser.id}`);
            console.log(`   Name: ${ownerUser.firstName} ${ownerUser.lastName}`);
            console.log(`   Email: ${ownerUser.email}\n`);
        } else {
            console.log(`⚠️  Owner user with ID ${project.ownerId} not found\n`);
        }
        
        // Get all ProjectMember records for this project
        let members;
        if (dbType === 'POSTGRES') {
            members = await dataSource.query(
                `SELECT pm.*, u.id as user_id, ui.email, ui."firstName", ui."lastName"
                 FROM project_member pm
                 JOIN "user" u ON pm."userId" = u.id
                 JOIN user_identity ui ON u."identityId" = ui.id
                 WHERE pm."projectId" = $1`,
                [project.id]
            );
        } else {
            members = await dataSource.query(
                `SELECT pm.*, u.id as user_id, ui.email, ui.firstName, ui.lastName
                 FROM project_member pm
                 JOIN user u ON pm.userId = u.id
                 JOIN user_identity ui ON u.identityId = ui.id
                 WHERE pm.projectId = ?`,
                [project.id]
            );
        }
        
        console.log(`📋 ProjectMember Records (${members.length}):`);
        if (members.length === 0) {
            console.log('   (no explicit member records)');
        } else {
            members.forEach((member, i) => {
                console.log(`   ${i + 1}. ${member.firstName} ${member.lastName} (${member.email})`);
                console.log(`      Member ID: ${member.id}`);
                console.log(`      User ID: ${member.user_id}`);
                console.log(`      Role: ${member.role}`);
                console.log(`      Is Owner: ${member.user_id === project.ownerId ? 'YES' : 'NO'}\n`);
            });
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

checkProjectOwner();

