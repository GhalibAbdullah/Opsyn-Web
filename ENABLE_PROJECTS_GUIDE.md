# Enable Project Management - Quick Guide

## Option 1: Use the Script (Easiest) ✅

### For PostgreSQL (Docker/Production):
```bash
# Make script executable
chmod +x scripts/enable-projects.sh

# Run the script
./scripts/enable-projects.sh
```

### For Node.js (Alternative):
```bash
# Make script executable (Linux/Mac)
chmod +x scripts/enable-projects.js

# Run the script
node scripts/enable-projects.js
```

The script will:
1. ✅ Find your database configuration
2. ✅ Get your platform ID automatically
3. ✅ Enable project management

## Option 2: Manual SQL

### Find Your Platform ID First

#### If using PostgreSQL (Docker):
```bash
# Connect to your PostgreSQL container
docker exec -it postgres psql -U postgres -d activepieces

# Find your platform ID
SELECT id FROM platform LIMIT 1;
```

#### If using SQLite:
```bash
# Connect to your SQLite database
sqlite3 packages/server/api/database.sqlite

# Find your platform ID
SELECT id FROM platform LIMIT 1;
```

### Enable Project Management

#### PostgreSQL:
```sql
-- Replace '<your_platform_id>' with the ID from above
UPDATE platform_plan 
SET "manageProjectsEnabled" = true 
WHERE "platformId" = '<your_platform_id>';
```

#### SQLite:
```sql
-- Replace '<your_platform_id>' with the ID from above
UPDATE platform_plan 
SET manageProjectsEnabled = 1 
WHERE platformId = '<your_platform_id>';
```

Or enable for ALL platforms:
```sql
-- PostgreSQL
UPDATE platform_plan SET "manageProjectsEnabled" = true;

-- SQLite
UPDATE platform_plan SET manageProjectsEnabled = 1;
```

## Option 3: Find Platform ID from Browser

1. Open your browser DevTools (F12)
2. Go to the **Network** tab
3. Navigate to your Activepieces instance
4. Look for any API call to `/v1/platform` or similar
5. Check the response - it should contain your `platformId`

Then use that ID in the SQL queries above.

## Option 4: Check Your Database Connection

### If using Docker Compose:
```bash
# Check if PostgreSQL container is running
docker ps | grep postgres

# Connect to PostgreSQL
docker exec -it postgres psql -U postgres -d activepieces

# List all platforms
SELECT id, name, "ownerId" FROM platform;

# Check current platform plan settings
SELECT "platformId", "manageProjectsEnabled" FROM platform_plan;
```

### If using SQLite:
```bash
# Check if database file exists
ls -la packages/server/api/database.sqlite

# Connect to SQLite
sqlite3 packages/server/api/database.sqlite

# List all platforms
SELECT id, name, ownerId FROM platform;

# Check current platform plan settings
SELECT platformId, manageProjectsEnabled FROM platform_plan;
```

## Verify It's Enabled

After running the SQL, verify:

```sql
-- PostgreSQL
SELECT "platformId", "manageProjectsEnabled" FROM platform_plan;

-- SQLite
SELECT platformId, manageProjectsEnabled FROM platform_plan;
```

You should see `manageProjectsEnabled = true` (or `1` in SQLite).

## Next Steps

1. ✅ Run the SQL (using any method above)
2. 🔄 **Restart your server**
3. 🔄 **Refresh your browser**
4. 🎯 Go to **Platform Settings → Projects**
5. ✅ You should see the **"New Project"** button!

## Troubleshooting

### "Could not find platform ID"
- Make sure your database is running
- Check your database connection settings in `.env`
- Try the manual SQL method

### "Permission denied"
- Make sure you have database access
- Check your database user permissions
- Try running with appropriate user (e.g., `sudo` if needed)

### "Table platform_plan does not exist"
- You might need to run migrations first
- Check if you're using the correct database

### Still not working?
- Check server logs for errors
- Verify the SQL query ran successfully
- Make sure you restarted the server after updating the database

## Quick Reference

**Find Platform ID:**
```sql
SELECT id FROM platform LIMIT 1;
```

**Enable Projects:**
```sql
-- PostgreSQL
UPDATE platform_plan SET "manageProjectsEnabled" = true;

-- SQLite  
UPDATE platform_plan SET manageProjectsEnabled = 1;
```

**Verify:**
```sql
SELECT "platformId", "manageProjectsEnabled" FROM platform_plan;
```

