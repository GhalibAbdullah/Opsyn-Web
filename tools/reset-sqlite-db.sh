#!/bin/bash

# Reset SQLite database for clean start
# This will delete all data and let the app recreate it on next startup

echo "Resetting SQLite database..."

# Find and delete SQLite database files
find . -name "*.sqlite" -type f -delete
find . -name "*.sqlite-journal" -type f -delete
find . -name "*.sqlite-wal" -type f -delete
find . -name "*.sqlite-shm" -type f -delete

# Also delete database in dev/config if it exists
if [ -f "dev/config/database.sqlite" ]; then
    rm -f dev/config/database.sqlite
    echo "Deleted dev/config/database.sqlite"
fi

# Delete database in packages/server/api if it exists
if [ -f "packages/server/api/database.sqlite" ]; then
    rm -f packages/server/api/database.sqlite
    echo "Deleted packages/server/api/database.sqlite"
fi

echo "SQLite database files deleted. The database will be recreated on next server startup."
echo ""
echo "Note: You'll need to:"
echo "  1. Stop the server if it's running"
echo "  2. Restart the server - it will recreate the database automatically"
echo "  3. Create a new user account (or use existing platform if it auto-creates)"

