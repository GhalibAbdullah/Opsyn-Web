# Fresh Start Guide - Fixing the Circular Bug

## Step 1: Clean Up Database

Run this in your WSL bash terminal:

```bash
chmod +x scripts/cleanup-all.sh
./scripts/cleanup-all.sh
```

Or manually:

```bash
sqlite3 dev/config/database.sqlite "DELETE FROM project_member; DELETE FROM project;"
```

## Step 2: Verify Backend Fixes Are In Place

The backend code has been fixed with:
- ✅ Strict project filtering (members only from requested project)
- ✅ Virtual member validation (only adds owner for correct project)
- ✅ Deduplication with project validation
- ✅ Final safety checks

These fixes are already in `packages/server/api/src/app/project-members/project-member.service.ts`.

## Step 3: Restart Everything

1. **Stop your backend server** (Ctrl+C)
2. **Restart your backend server**
3. **Clear browser cache:**
   - Chrome/Edge: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
   - Or: DevTools → Application → Clear Storage → Clear site data

## Step 4: Test with Fresh Projects

1. **Create project "f"** with bsd as owner
2. **Create project "z_"** with Zohha as owner
3. **Add bsd as editor** to project "z_"
4. **Verify:**
   - Project "f" shows only bsd as owner
   - Project "z_" shows Zohha as owner and bsd as editor
   - No cross-contamination between projects

## What Was Fixed

The circular bug was caused by:
1. **Deduplication using `userId` only** - could merge members across projects
2. **Virtual member logic** - could add wrong owner if project.ownerId was incorrect
3. **Missing strict filtering** - members from wrong projects could slip through

**All of these are now fixed** with:
- Project-scoped deduplication
- Triple-check validation for virtual members
- Multiple layers of project filtering

## If Issues Persist

1. Check server logs for validation errors
2. Verify project.ownerId in database matches expected owner
3. Check API response in browser DevTools Network tab
4. Ensure browser cache is cleared

