#!/bin/bash
# Script to enable project management for your platform
# This script finds your platform ID and enables the feature

set -e

echo "🔍 Finding your platform ID..."

# Check if using PostgreSQL or SQLite
if [ -n "$AP_POSTGRES_HOST" ] || [ -n "$AP_DB_TYPE" ] && [ "$AP_DB_TYPE" = "POSTGRES" ]; then
    # PostgreSQL
    DB_HOST="${AP_POSTGRES_HOST:-localhost}"
    DB_PORT="${AP_POSTGRES_PORT:-5432}"
    DB_NAME="${AP_POSTGRES_DATABASE:-activepieces}"
    DB_USER="${AP_POSTGRES_USERNAME:-postgres}"
    DB_PASS="${AP_POSTGRES_PASSWORD:-}"
    
    echo "📊 Using PostgreSQL database: $DB_NAME"
    
    # Get platform ID
    if [ -n "$DB_PASS" ]; then
        PLATFORM_ID=$(PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT id FROM platform LIMIT 1;" 2>/dev/null | xargs)
    else
        PLATFORM_ID=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT id FROM platform LIMIT 1;" 2>/dev/null | xargs)
    fi
    
    if [ -z "$PLATFORM_ID" ]; then
        echo "❌ Could not find platform ID. Please check your database connection."
        echo ""
        echo "Manual SQL (PostgreSQL):"
        echo "  psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME"
        echo "  UPDATE platform_plan SET \"manageProjectsEnabled\" = true;"
        exit 1
    fi
    
    echo "✅ Found platform ID: $PLATFORM_ID"
    echo ""
    echo "🔄 Enabling project management..."
    
    # Update platform plan
    if [ -n "$DB_PASS" ]; then
        PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "UPDATE platform_plan SET \"manageProjectsEnabled\" = true WHERE \"platformId\" = '$PLATFORM_ID';" 2>/dev/null
    else
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "UPDATE platform_plan SET \"manageProjectsEnabled\" = true WHERE \"platformId\" = '$PLATFORM_ID';" 2>/dev/null
    fi
    
    echo "✅ Project management enabled!"
    
elif [ -f "packages/server/api/database.sqlite" ] || [ -f "database.sqlite" ]; then
    # SQLite
    DB_FILE="packages/server/api/database.sqlite"
    if [ ! -f "$DB_FILE" ]; then
        DB_FILE="database.sqlite"
    fi
    
    echo "📊 Using SQLite database: $DB_FILE"
    
    # Check if sqlite3 is available
    if ! command -v sqlite3 &> /dev/null; then
        echo "❌ sqlite3 not found. Please install it or run SQL manually."
        echo ""
        echo "Manual SQL (SQLite):"
        echo "  sqlite3 $DB_FILE"
        echo "  UPDATE platform_plan SET manageProjectsEnabled = 1;"
        exit 1
    fi
    
    # Get platform ID
    PLATFORM_ID=$(sqlite3 "$DB_FILE" "SELECT id FROM platform LIMIT 1;" 2>/dev/null | xargs)
    
    if [ -z "$PLATFORM_ID" ]; then
        echo "❌ Could not find platform ID. Please check your database file."
        exit 1
    fi
    
    echo "✅ Found platform ID: $PLATFORM_ID"
    echo ""
    echo "🔄 Enabling project management..."
    
    # Update platform plan
    sqlite3 "$DB_FILE" "UPDATE platform_plan SET manageProjectsEnabled = 1 WHERE platformId = '$PLATFORM_ID';" 2>/dev/null
    
    echo "✅ Project management enabled!"
    
else
    echo "❌ Could not detect database. Please run SQL manually."
    echo ""
    echo "Find your platform ID first:"
    echo "  SELECT id FROM platform LIMIT 1;"
    echo ""
    echo "Then enable projects:"
    echo "  UPDATE platform_plan SET \"manageProjectsEnabled\" = true WHERE \"platformId\" = '<your_platform_id>';"
    exit 1
fi

echo ""
echo "🎉 Done! Restart your server and refresh your browser."
echo "   Go to Platform Settings → Projects to see the 'New Project' button."

