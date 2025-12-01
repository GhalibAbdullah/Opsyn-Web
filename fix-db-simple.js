// Simple fix using the project's database connection
const path = require('path');
const { Database } = require(path.join(__dirname, 'node_modules/better-sqlite3'));

const db = new Database(path.join(__dirname, 'dev/config/database.sqlite'));

try {
    db.exec(`ALTER TABLE flow_activity ADD COLUMN actionType varchar(50) DEFAULT 'UPDATED'`);
    db.exec(`UPDATE flow_activity SET actionType = COALESCE(action, 'UPDATED') WHERE actionType IS NULL OR actionType = 'UPDATED'`);
    db.exec(`ALTER TABLE flow_activity ADD COLUMN metadata text`);
    console.log('✅ Fixed flow_activity table');
} catch (e) {
    if (e.message.includes('duplicate column')) {
        console.log('✅ Columns already exist');
    } else {
        console.error('Error:', e.message);
    }
} finally {
    db.close();
}

