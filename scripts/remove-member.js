#!/usr/bin/env node

/**
 * Script to remove a user from a project by email and project name
 * Usage: node scripts/remove-member.js <user_email> <project_display_name>
 * Example: node scripts/remove-member.js zohhazhar13@gmail.com "f"
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

const userEmail = process.argv[2] || 'zohhazhar13@gmail.com';
const projectName = process.argv[3] || 'f';

async function removeMember() {
    let dataSource;
    let sqlitePath;
    
    try {
        // Check for PostgreSQL first, as it's more common in production
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
        
        const cleanedEmail = userEmail.toLowerCase().trim();
        
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
            console.error(`❌ User with email ${userEmail} not found`);
            process.exit(1);
        }
        
        const identity = userIdentity[0];
        console.log('📧 User Identity:');
        console.log(`   Email: ${identity.email}`);
        console.log(`   Name: ${identity.firstName} ${identity.lastName}`);
        console.log(`   ID: ${identity.id}\n`);
        
        // Get user record
        let users;
        if (dbType === 'POSTGRES') {
            users = await dataSource.query(
                `SELECT * FROM "user" WHERE "identityId" = $1`,
                [identity.id]
            );
        } else {
            users = await dataSource.query(
                `SELECT * FROM user WHERE identityId = ?`,
                [identity.id]
            );
        }
        
        if (!users || users.length === 0) {
            console.error('❌ No user records found for this identity');
            process.exit(1);
        }
        
        const user = users[0];
        console.log(`👤 User ID: ${user.id}\n`);
        
        // Find project by displayName
        let projects;
        if (dbType === 'POSTGRES') {
            projects = await dataSource.query(
                `SELECT * FROM project WHERE "displayName" = $1 AND "platformId" = $2`,
                [projectName, user.platformId]
            );
        } else {
            projects = await dataSource.query(
                `SELECT * FROM project WHERE displayName = ? AND platformId = ?`,
                [projectName, user.platformId]
            );
        }
        
        if (!projects || projects.length === 0) {
            console.error(`❌ Project "${projectName}" not found for platform ${user.platformId}`);
            process.exit(1);
        }
        
        if (projects.length > 1) {
            console.warn(`⚠️  Multiple projects found with name "${projectName}":`);
            projects.forEach((p, i) => {
                console.warn(`   ${i + 1}. ${p.displayName} (${p.id}) - Owner: ${p.ownerId}`);
            });
            console.warn(`   Using the first one: ${projects[0].id}\n`);
        }
        
        const project = projects[0];
        console.log(`📁 Project:`);
        console.log(`   Name: ${project.displayName}`);
        console.log(`   ID: ${project.id}`);
        console.log(`   Owner ID: ${project.ownerId}\n`);
        
        // Check if user is the project owner
        if (project.ownerId === user.id) {
            console.warn(`⚠️  User ${userEmail} is the owner of project "${projectName}"`);
            console.warn(`   Cannot remove project owner. If you want to change ownership, update the project.ownerId field.\n`);
        }
        
        // Find ProjectMember records
        let members;
        if (dbType === 'POSTGRES') {
            members = await dataSource.query(
                `SELECT * FROM project_member WHERE "userId" = $1 AND "projectId" = $2`,
                [user.id, project.id]
            );
        } else {
            members = await dataSource.query(
                `SELECT * FROM project_member WHERE userId = ? AND projectId = ?`,
                [user.id, project.id]
            );
        }
        
        if (!members || members.length === 0) {
            console.log(`ℹ️  No ProjectMember records found for ${userEmail} in project "${projectName}"`);
            console.log(`   User is not a member of this project (or is only the owner).\n`);
            return;
        }
        
        console.log(`🔍 Found ${members.length} ProjectMember record(s):`);
        members.forEach((member, i) => {
            console.log(`   ${i + 1}. Member ID: ${member.id}, Role: ${member.role}`);
        });
        console.log('');
        
        // Delete ProjectMember records
        console.log('🗑️  Deleting ProjectMember records...');
        let deletedCount = 0;
        
        for (const member of members) {
            if (dbType === 'POSTGRES') {
                const result = await dataSource.query(
                    `DELETE FROM project_member WHERE id = $1`,
                    [member.id]
                );
                deletedCount += result[1] || 0;
            } else {
                const result = await dataSource.query(
                    `DELETE FROM project_member WHERE id = ?`,
                    [member.id]
                );
                deletedCount += result.changes || 0;
            }
            console.log(`   ✅ Deleted member record: ${member.id}`);
        }
        
        console.log(`\n✅ Successfully removed ${deletedCount} ProjectMember record(s)`);
        console.log(`   User ${userEmail} is no longer a member of project "${projectName}"\n`);
        
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

removeMember();

