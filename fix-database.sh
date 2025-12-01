#!/bin/bash
# Quick fix script to add missing actionType column to flow_activity table

cd /home/alien/dev/activepieces

# Try common database locations
if [ -f "dev/config/database.sqlite" ]; then
    DB_FILE="dev/config/database.sqlite"
elif [ -f "packages/server/api/database.sqlite" ]; then
    DB_FILE="packages/server/api/database.sqlite"
else
    echo "❌ Database file not found in common locations"
    echo "Looking for database file..."
    DB_FILE=$(find . -name "*.sqlite" -o -name "*.db" 2>/dev/null | head -1)
    if [ -z "$DB_FILE" ]; then
        echo "❌ No database file found!"
        exit 1
    fi
    echo "Found database at: $DB_FILE"
fi

echo "✅ Found database: $DB_FILE"
echo ""
echo "Checking current table structure..."
sqlite3 "$DB_FILE" "PRAGMA table_info(flow_activity);" 2>/dev/null || echo "Table might not exist yet"

echo ""
echo "Adding missing columns..."

# Add actionType column
echo "Adding actionType column..."
sqlite3 "$DB_FILE" "ALTER TABLE flow_activity ADD COLUMN actionType varchar(50) DEFAULT 'UPDATED';" 2>/dev/null && echo "✅ actionType added" || echo "⚠️  actionType might already exist"
sqlite3 "$DB_FILE" "UPDATE flow_activity SET actionType = 'UPDATED' WHERE actionType IS NULL;" 2>/dev/null

# Add metadata column
echo "Adding metadata column..."
sqlite3 "$DB_FILE" "ALTER TABLE flow_activity ADD COLUMN metadata text;" 2>/dev/null && echo "✅ metadata added" || echo "⚠️  metadata might already exist"

echo ""
echo "Checking if columns exist now..."
sqlite3 "$DB_FILE" "PRAGMA table_info(flow_activity);" | grep -E "(actionType|metadata)" && echo "✅ Columns exist!" || echo "❌ Some columns still missing"

echo ""
echo "Final table structure:"
sqlite3 "$DB_FILE" "PRAGMA table_info(flow_activity);"

echo ""
echo "🎉 Done! Please restart your server."

