#!/usr/bin/env node

/**
 * Script to find all SQLite database files and check their sizes
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

function findDatabaseFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
            try {
                findDatabaseFiles(filePath, fileList);
            } catch (e) {
                // Skip directories we can't read
            }
        } else if (file.endsWith('.sqlite') || file.endsWith('.db')) {
            fileList.push({
                path: filePath,
                size: stat.size,
                modified: stat.mtime
            });
        }
    });
    
    return fileList;
}

console.log('Searching for SQLite database files...\n');

// Check common locations
const commonPaths = [
    path.join(os.homedir(), '.activepieces'),
    path.join(process.cwd(), 'packages', 'server', 'api'),
    process.cwd(),
];

const allDatabases = [];

commonPaths.forEach(basePath => {
    if (fs.existsSync(basePath)) {
        try {
            const files = findDatabaseFiles(basePath);
            allDatabases.push(...files);
        } catch (e) {
            // Skip if we can't read
        }
    }
});

if (allDatabases.length === 0) {
    console.log('No database files found in common locations.');
} else {
    console.log(`Found ${allDatabases.length} database file(s):\n`);
    allDatabases.forEach(db => {
        console.log(`Path: ${db.path}`);
        console.log(`Size: ${db.size} bytes (${(db.size / 1024).toFixed(2)} KB)`);
        console.log(`Modified: ${db.modified}`);
        console.log('');
    });
}

// Also check the specific path the server uses
const serverDbPath = path.resolve(path.join(os.homedir(), '.activepieces', 'database.sqlite'));
console.log(`\nServer default database path: ${serverDbPath}`);
if (fs.existsSync(serverDbPath)) {
    const stats = fs.statSync(serverDbPath);
    console.log(`Exists: Yes`);
    console.log(`Size: ${stats.size} bytes (${(stats.size / 1024).toFixed(2)} KB)`);
    console.log(`Modified: ${stats.mtime}`);
} else {
    console.log(`Exists: No`);
}

