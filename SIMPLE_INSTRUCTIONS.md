# Super Simple Instructions - Enable Projects

## The Easiest Way (No SQL Needed!)

### Option 1: Using Your Browser Console (Easiest!) ⭐

1. **Open your Activepieces app** in your browser
2. **Press F12** (or right-click → Inspect)
3. **Go to the Console tab**
4. **Paste this code and press Enter:**

```javascript
// Enable projects via API
fetch('/api/v1/platform', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    plan: {
      manageProjectsEnabled: true
    }
  })
})
.then(r => r.json())
.then(data => {
  console.log('✅ Projects enabled!', data);
  alert('Projects enabled! Refresh the page.');
})
.catch(e => console.error('❌ Error:', e));
```

5. **Refresh the page** - you should see the "New Project" button!

---

## Option 2: Direct SQL (If Option 1 Doesn't Work)

### Step 1: Find Your Database Type

**Are you using Docker?** (Check if you see `docker-compose.yml` file)

#### If YES (Docker/PostgreSQL):

Open a terminal and run:
```bash
docker exec -it postgres psql -U postgres -d activepieces
```

Then paste this:
```sql
UPDATE platform_plan SET "manageProjectsEnabled" = true;
```

Type `\q` and press Enter to exit.

#### If NO (SQLite):

**Option A - Using Python (usually installed):**
```bash
python3 -c "import sqlite3; conn = sqlite3.connect('packages/server/api/database.sqlite'); conn.execute('UPDATE platform_plan SET manageProjectsEnabled = 1'); conn.commit(); conn.close(); print('✅ Done!')"
```

**Option B - Install sqlite3 and use it:**
```bash
# Install sqlite3
sudo apt install sqlite3

# Run the SQL
sqlite3 packages/server/api/database.sqlite "UPDATE platform_plan SET manageProjectsEnabled = 1;"
```

**Option C - Use a SQLite GUI tool:**
- Download [DB Browser for SQLite](https://sqlitebrowser.org/)
- Open `packages/server/api/database.sqlite`
- Go to "Execute SQL" tab
- Paste: `UPDATE platform_plan SET manageProjectsEnabled = 1;`
- Click "Execute SQL"
- Click "Write Changes"

---

## Option 3: Create a Temporary Endpoint (Most Reliable)

I'll create a simple endpoint you can call. Let me know if you want this!

---

## After Enabling (Any Method)

1. **Restart your server** (if running locally)
2. **Refresh your browser**
3. **Go to Platform Settings → Projects**
4. **You should see "New Project" button!** 🎉

---

## Still Stuck?

Tell me:
1. **Are you running the server locally?** (not Docker)
2. **Do you see any errors in the terminal** where you started the server?
3. **What happens when you open your Activepieces URL?** (does it load?)

And I'll help you figure out the exact steps!

