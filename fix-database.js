#!/usr/bin/env node
// Script to add missing actionType column to flow_activity table

const fs = require('fs');
const path = require('path');

// Find database file
const possiblePaths = [
  'dev/config/database.sqlite',
  'packages/server/api/database.sqlite',
];

let dbPath = null;
for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    dbPath = p;
    break;
  }
}

if (!dbPath) {
  console.error('❌ Database file not found!');
  process.exit(1);
}

console.log(`✅ Found database: ${dbPath}`);

// Use better-sqlite3 if available, otherwise try to use the app's database connection
try {
  // Try to use better-sqlite3 (which the app likely uses)
  const Database = require('better-sqlite3');
  const db = new Database(dbPath);
  
  console.log('\nChecking current table structure...');
  const tableInfo = db.prepare('PRAGMA table_info(flow_activity)').all();
  console.log('Current columns:', tableInfo.map(col => col.name).join(', '));
  
  const hasActionType = tableInfo.some(col => col.name === 'actionType');
  const hasMetadata = tableInfo.some(col => col.name === 'metadata');
  
  if (!hasActionType) {
    console.log('\nAdding actionType column...');
    try {
      db.exec(`
        ALTER TABLE flow_activity ADD COLUMN actionType varchar(50) DEFAULT 'UPDATED';
        UPDATE flow_activity SET actionType = 'UPDATED' WHERE actionType IS NULL;
      `);
      console.log('✅ actionType column added successfully!');
    } catch (error) {
      if (error.message.includes('duplicate column') || error.message.includes('already exists')) {
        console.log('✅ actionType column already exists!');
      } else {
        throw error;
      }
    }
  } else {
    console.log('✅ actionType column already exists!');
  }
  
  if (!hasMetadata) {
    console.log('\nAdding metadata column...');
    try {
      db.exec(`
        ALTER TABLE flow_activity ADD COLUMN metadata text;
      `);
      console.log('✅ metadata column added successfully!');
    } catch (error) {
      if (error.message.includes('duplicate column') || error.message.includes('already exists')) {
        console.log('✅ metadata column already exists!');
      } else {
        throw error;
      }
    }
  } else {
    console.log('✅ metadata column already exists!');
  }
  
  console.log('\nFinal table structure:');
  const finalInfo = db.prepare('PRAGMA table_info(flow_activity)').all();
  finalInfo.forEach(col => {
    console.log(`  - ${col.name} (${col.type}${col.notnull ? ', NOT NULL' : ''}${col.dflt_value ? `, DEFAULT ${col.dflt_value}` : ''})`);
  });
  
  db.close();
  console.log('\n🎉 Done! Please restart your server.');
} catch (error) {
  if (error.code === 'MODULE_NOT_FOUND') {
    console.error('❌ better-sqlite3 not found. Trying alternative approach...');
    console.error('\nPlease run this SQL manually using any SQLite tool:');
    console.error(`\nALTER TABLE flow_activity ADD COLUMN actionType varchar(50) DEFAULT 'UPDATED';`);
    console.error(`UPDATE flow_activity SET actionType = 'UPDATED' WHERE actionType IS NULL;`);
    console.error(`\nOr install sqlite3: sudo apt-get install sqlite3`);
  } else {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

