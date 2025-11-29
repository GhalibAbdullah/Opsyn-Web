#!/usr/bin/env node
/**
 * Script to enable project management for your platform
 * This script finds your platform ID and enables the feature
 * 
 * Usage: node scripts/enable-projects.js
 */

const { readFileSync, existsSync } = require('fs');
const { execSync } = require('child_process');
const path = require('path');

function findEnvFile() {
    const possiblePaths = [
        'packages/server/api/.env',
        'server/api/.env',
        '.env',
        '.env.local',
    ];
    
    for (const envPath of possiblePaths) {
        if (existsSync(envPath)) {
            return envPath;
        }
    }
    return null;
}

function parseEnvFile(envPath) {
    if (!envPath || !existsSync(envPath)) {
        return {};
    }
    
    const env = {};
    const content = readFileSync(envPath, 'utf-8');
    
    content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const [key, ...valueParts] = trimmed.split('=');
            if (key && valueParts.length > 0) {
                env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
            }
        }
    });
    
    return env;
}

function findPlatformId(env) {
    const dbType = env.AP_DB_TYPE || 'SQLITE';
    
    if (dbType === 'POSTGRES') {
        // PostgreSQL
        const host = env.AP_POSTGRES_HOST || 'localhost';
        const port = env.AP_POSTGRES_PORT || '5432';
        const database = env.AP_POSTGRES_DATABASE || 'activepieces';
        const username = env.AP_POSTGRES_USERNAME || 'postgres';
        const password = env.AP_POSTGRES_PASSWORD || '';
        
        const pgUrl = password 
            ? `postgresql://${username}:${password}@${host}:${port}/${database}`
            : `postgresql://${username}@${host}:${port}/${database}`;
        
        try {
            // Try to use psql
            const platformId = execSync(
                `psql "${pgUrl}" -t -c "SELECT id FROM platform LIMIT 1;"`,
                { encoding: 'utf-8', stdio: 'pipe' }
            ).trim();
            
            if (platformId) {
                return { type: 'POSTGRES', id: platformId, connection: { host, port, database, username, password } };
            }
        } catch (error) {
            console.error('❌ Could not connect to PostgreSQL. Please check your connection.');
            console.error('   Error:', error.message);
            return null;
        }
    } else {
        // SQLite
        const dbPath = env.AP_SQLITE_PATH || 'packages/server/api/database.sqlite';
        const possiblePaths = [
            dbPath,
            'database.sqlite',
            'packages/server/api/database.sqlite',
        ];
        
        for (const dbFilePath of possiblePaths) {
            if (existsSync(dbFilePath)) {
                try {
                    const platformId = execSync(
                        `sqlite3 "${dbFilePath}" "SELECT id FROM platform LIMIT 1;"`,
                        { encoding: 'utf-8', stdio: 'pipe' }
                    ).trim();
                    
                    if (platformId) {
                        return { type: 'SQLITE', id: platformId, dbPath: dbFilePath };
                    }
                } catch (error) {
                    console.error(`❌ Could not read SQLite database at ${dbFilePath}`);
                    console.error('   Error:', error.message);
                }
            }
        }
    }
    
    return null;
}

function enableProjects(platformInfo) {
    if (platformInfo.type === 'POSTGRES') {
        const { host, port, database, username, password } = platformInfo.connection;
        const pgUrl = password 
            ? `postgresql://${username}:${password}@${host}:${port}/${database}`
            : `postgresql://${username}@${host}:${port}/${database}`;
        
        try {
            execSync(
                `psql "${pgUrl}" -c "UPDATE platform_plan SET \\"manageProjectsEnabled\\" = true WHERE \\"platformId\\" = '${platformInfo.id}';"`,
                { encoding: 'utf-8', stdio: 'inherit' }
            );
            return true;
        } catch (error) {
            console.error('❌ Could not update platform plan.');
            console.error('   Error:', error.message);
            return false;
        }
    } else {
        // SQLite
        try {
            execSync(
                `sqlite3 "${platformInfo.dbPath}" "UPDATE platform_plan SET manageProjectsEnabled = 1 WHERE platformId = '${platformInfo.id}';"`,
                { encoding: 'utf-8', stdio: 'inherit' }
            );
            return true;
        } catch (error) {
            console.error('❌ Could not update platform plan.');
            console.error('   Error:', error.message);
            return false;
        }
    }
}

// Main execution
console.log('🔍 Finding your platform ID...\n');

const envPath = findEnvFile();
if (envPath) {
    console.log(`📝 Found .env file: ${envPath}`);
}

const env = { ...process.env, ...parseEnvFile(envPath) };
const platformInfo = findPlatformId(env);

if (!platformInfo) {
    console.log('\n❌ Could not find platform ID automatically.');
    console.log('\n📋 Manual Instructions:');
    console.log('   1. Find your platform ID:');
    console.log('      SELECT id FROM platform LIMIT 1;');
    console.log('   2. Enable project management:');
    console.log('      UPDATE platform_plan SET "manageProjectsEnabled" = true WHERE "platformId" = \'<your_platform_id>\';');
    process.exit(1);
}

console.log(`✅ Found platform ID: ${platformInfo.id}`);
console.log(`📊 Database type: ${platformInfo.type}\n`);

console.log('🔄 Enabling project management...\n');

const success = enableProjects(platformInfo);

if (success) {
    console.log('\n✅ Project management enabled!');
    console.log('\n🎉 Next steps:');
    console.log('   1. Restart your server');
    console.log('   2. Refresh your browser');
    console.log('   3. Go to Platform Settings → Projects');
    console.log('   4. You should see the "New Project" button!');
} else {
    console.log('\n❌ Failed to enable project management.');
    console.log('   Please run the SQL manually (see instructions above).');
    process.exit(1);
}

