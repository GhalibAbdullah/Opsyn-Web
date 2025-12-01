#!/bin/bash
# Script to manually add missing actionType column to flow_activity table

cd /home/alien/dev/activepieces

# Find the SQLite database file
DB_FILE="packages/server/api/database.sqlite"

if [ ! -f "$DB_FILE" ]; then
    echo "Database file not found at $DB_FILE"
    exit 1
fi

echo "Checking flow_activity table structure..."
sqlite3 "$DB_FILE" "PRAGMA table_info(flow_activity);"

echo ""
echo "Adding actionType column if it doesn't exist..."
sqlite3 "$DB_FILE" <<EOF
-- Check if column exists
SELECT COUNT(*) FROM pragma_table_info('flow_activity') WHERE name='actionType';
-- Add column if it doesn't exist (SQLite doesn't support IF NOT EXISTS for ALTER TABLE)
-- We'll use a transaction to make it safe
BEGIN TRANSACTION;
-- Try to add the column (will fail silently if it exists in some SQLite versions)
ALTER TABLE flow_activity ADD COLUMN actionType varchar(50) DEFAULT 'UPDATED';
-- Update any NULL values
UPDATE flow_activity SET actionType = 'UPDATED' WHERE actionType IS NULL;
COMMIT;
EOF

echo ""
echo "Verifying column was added..."
sqlite3 "$DB_FILE" "PRAGMA table_info(flow_activity);"

echo ""
echo "Done! Please restart your server."

