#!/usr/bin/env node
/**
 * SIMPLE script to enable projects - just runs the SQL directly
 * No need to find platform ID - enables for ALL platforms
 */

const { execSync } = require('child_process');
const { existsSync } = require('fs');
const path = require('path');

console.log('🔍 Checking database type...\n');

// Check for SQLite database
const sqlitePaths = [
    'packages/server/api/database.sqlite',
    'database.sqlite',
    path.join(__dirname, '../packages/server/api/database.sqlite'),
];

let foundSqlite = null;
for (const sqlitePath of sqlitePaths) {
    if (existsSync(sqlitePath)) {
        foundSqlite = sqlitePath;
        console.log(`✅ Found SQLite database: ${sqlitePath}`);
        break;
    }
}

// Check for PostgreSQL via Docker
let foundPostgres = false;
try {
    const dockerPs = execSync('docker ps --format "{{.Names}}"', { encoding: 'utf-8', stdio: 'pipe' });
    if (dockerPs.includes('postgres')) {
        foundPostgres = true;
        console.log(`✅ Found PostgreSQL container: postgres`);
    }
} catch (e) {
    // Docker not available or postgres not running
}

if (foundSqlite) {
    // Try to enable using Python (usually available)
    console.log('\n🔄 Enabling projects (SQLite)...\n');
    
    try {
        // Use Python to access SQLite (no need for sqlite3 CLI)
        const pythonScript = `
import sqlite3
import sys
db_path = "${foundSqlite}"
try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("UPDATE platform_plan SET manageProjectsEnabled = 1;")
    affected = cursor.rowcount
    conn.commit()
    conn.close()
    print(f"✅ Updated {affected} platform(s)")
    print("✅ Project management enabled!")
    sys.exit(0)
except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)
`;
        
        execSync(`python3 -c "${pythonScript}"`, { encoding: 'utf-8', stdio: 'inherit' });
        console.log('\n🎉 Done! Restart your server and refresh your browser.');
        console.log('   Go to Platform Settings → Projects');
    } catch (error) {
        console.log('❌ Python not available. Trying alternative...\n');
        console.log('📋 Manual SQL (copy and paste into a SQLite browser or app):');
        console.log(`   File: ${foundSqlite}`);
        console.log(`   SQL: UPDATE platform_plan SET manageProjectsEnabled = 1;`);
        console.log('\n💡 Or install sqlite3: sudo apt install sqlite3');
        console.log('   Then run: sqlite3 packages/server/api/database.sqlite "UPDATE platform_plan SET manageProjectsEnabled = 1;"');
    }
    
} else if (foundPostgres) {
    // PostgreSQL via Docker
    console.log('\n🔄 Enabling projects (PostgreSQL via Docker)...\n');
    
    try {
        const result = execSync(
            'docker exec -i postgres psql -U postgres -d activepieces -c "UPDATE platform_plan SET \\"manageProjectsEnabled\\" = true;"',
            { encoding: 'utf-8', stdio: 'inherit' }
        );
        console.log('\n🎉 Done! Restart your server and refresh your browser.');
        console.log('   Go to Platform Settings → Projects');
    } catch (error) {
        console.log('❌ Could not connect to PostgreSQL container.');
        console.log('\n📋 Manual SQL (run in PostgreSQL):');
        console.log('   UPDATE platform_plan SET "manageProjectsEnabled" = true;');
        console.log('\n💡 Connect with: docker exec -it postgres psql -U postgres -d activepieces');
    }
    
} else {
    console.log('❌ Could not find database automatically.');
    console.log('\n📋 Please run this SQL manually:');
    console.log('\n   For SQLite:');
    console.log('     UPDATE platform_plan SET manageProjectsEnabled = 1;');
    console.log('\n   For PostgreSQL:');
    console.log('     UPDATE platform_plan SET "manageProjectsEnabled" = true;');
    console.log('\n💡 To find your database:');
    console.log('   - SQLite: Look for database.sqlite file');
    console.log('   - PostgreSQL: Check docker-compose.yml or .env file');
}

