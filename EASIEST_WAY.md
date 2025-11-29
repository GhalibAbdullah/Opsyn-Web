# ✅ Easiest Way to Enable Projects

You're using **SQLite** (`AP_DB_TYPE=SQLITE3`). Here are your options:

## ⭐ Method 1: Browser Console (EASIEST - No SQL!)

1. **Open your Activepieces app** (e.g., `http://localhost:4200`)
2. **Press F12** (open DevTools)
3. **Go to Console tab**
4. **Paste this code:**

```javascript
fetch('/api/v1/platform')
  .then(r => r.json())
  .then(p => fetch(`/api/v1/platform/${p.id}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({plan: {manageProjectsEnabled: true}})
  }))
  .then(r => r.json())
  .then(() => {
    alert('✅ Projects enabled! Refreshing...');
    location.reload();
  })
  .catch(e => alert('Error: ' + e));
```

5. **Press Enter**
6. **Done!** Refresh the page - you should see "New Project" button! 🎉

---

## ⭐ Method 2: Python Script (Just Run It!)

I created a simple script for you! Just run:

```bash
python3 enable-projects.py
```

**That's it!** The script will:
- ✅ Find your database automatically
- ✅ Enable projects for all platforms
- ✅ Tell you what to do next

---

## Method 3: Install sqlite3 (If You Want SQL)

```bash
# Install sqlite3
sudo apt install sqlite3

# Run the SQL
sqlite3 packages/server/api/database.sqlite "UPDATE platform_plan SET manageProjectsEnabled = 1;"
```

---

## After Enabling (Any Method)

1. ✅ Run one of the methods above
2. 🔄 **Restart your server** (Ctrl+C, then start it again)
3. 🔄 **Refresh your browser**
4. 🎯 Go to **Platform Settings → Projects**
5. 🎉 You should see **"New Project"** button!

---

## Still Stuck?

**Try Method 1** (browser console) - it's the easiest and doesn't need any tools installed!

