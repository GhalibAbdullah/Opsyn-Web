#!/bin/bash

# Cleanup script: Delete all projects and project members
# WARNING: This will delete ALL projects and project members!
# Users will remain, but they'll have no projects

DB_PATH="dev/config/database.sqlite"

if [ ! -f "$DB_PATH" ]; then
    echo "❌ Database not found at: $DB_PATH"
    exit 1
fi

echo "⚠️  WARNING: This will delete ALL projects and project members!"
echo "   Users will remain, but they'll have no projects."
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "🗑️  Deleting all project members..."
sqlite3 "$DB_PATH" "DELETE FROM project_member;"

echo "🗑️  Deleting all projects..."
sqlite3 "$DB_PATH" "DELETE FROM project;"

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "Verification:"
echo "  Remaining projects: $(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM project;")"
echo "  Remaining members: $(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM project_member;")"
echo ""
echo "📋 Next steps:"
echo "  1. Restart your backend server"
echo "  2. Clear browser cache (Ctrl+Shift+R)"
echo "  3. Create new projects and test"

