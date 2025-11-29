# ✅ Easiest Way to Enable Projects

## Method 1: Browser Console (NO SQL NEEDED!) ⭐

**This is the EASIEST way - no database access needed!**

1. **Open your Activepieces app** in your browser (e.g., `http://localhost:4200`)
2. **Press F12** (or right-click → Inspect → Console tab)
3. **Copy and paste this code:**

```javascript
// Get your platform ID and enable projects
fetch('/api/v1/platform')
  .then(r => r.json())
  .then(platform => {
    const platformId = platform.id;
    console.log('Platform ID:', platformId);
    
    // Update platform to enable projects
    return fetch(`/api/v1/platform/${platformId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan: { manageProjectsEnabled: true }
      })
    });
  })
  .then(r => r.json())
  .then(data => {
    console.log('✅ Projects enabled!', data);
    alert('✅ Projects enabled! Refresh the page to see "New Project" button.');
    location.reload();
  })
  .catch(e => {
    console.error('❌ Error:', e);
    alert('Error: ' + e.message);
  });
```

4. **Press Enter**
5. **Refresh the page** - you should see the "New Project" button! 🎉

---

## Method 2: Check Your Database Type

**First, let's see what database you're using:**

1. **Open:** `packages/server/api/.env`
2. **Look for:** `AP_DB_TYPE` or `AP_POSTGRES_` or anything with `DB`

**Then follow the instructions below based on what you find:**

---

### If you see `AP_DB_TYPE=SQLITE` (or nothing):

You're using **SQLite**. Run this in your terminal:

```bash
# Install sqlite3 if needed
sudo apt install sqlite3

# Enable projects
sqlite3 packages/server/api/database.sqlite "UPDATE platform_plan SET manageProjectsEnabled = 1;"
```

**OR** if `sqlite3` doesn't work, use Python:

```bash
python3 -c "import sqlite3; conn = sqlite3.connect('packages/server/api/database.sqlite'); conn.execute('UPDATE platform_plan SET manageProjectsEnabled = 1'); conn.commit(); print('✅ Done!')"
```

---

### If you see `AP_DB_TYPE=POSTGRES` (or `AP_POSTGRES_HOST`):

You're using **PostgreSQL**. Run this:

```bash
# Connect to PostgreSQL
psql -h localhost -U postgres -d activepieces

# Then paste this:
UPDATE platform_plan SET "manageProjectsEnabled" = true;

# Exit with: \q
```

**OR** if that doesn't work, check your `.env` file for:
- `AP_POSTGRES_HOST` (usually `localhost`)
- `AP_POSTGRES_DATABASE` (usually `activepieces`)
- `AP_POSTGRES_USERNAME` (usually `postgres`)
- `AP_POSTGRES_PASSWORD` (your password)

Then run:
```bash
psql -h <HOST> -U <USERNAME> -d <DATABASE>
# (Enter password when prompted)
# Then: UPDATE platform_plan SET "manageProjectsEnabled" = true;
```

---

## Method 3: Just Tell Me What You See

**Share with me:**
1. What's in your `packages/server/api/.env` file? (especially lines with `DB`, `POSTGRES`, or `SQLITE`)
2. Are you running the server locally or in Docker?
3. What URL do you use to access Activepieces? (e.g., `http://localhost:4200`)

And I'll give you the **exact command** to run! 🎯

---

## After Enabling (Any Method)

1. ✅ Run the SQL or browser console code
2. 🔄 **Restart your server** (stop and start it again)
3. 🔄 **Refresh your browser**
4. 🎯 Go to **Platform Settings → Projects**
5. 🎉 You should see **"New Project"** button!

