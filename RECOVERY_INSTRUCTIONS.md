# Recovery Instructions for Uncommitted Work

## The Situation

You had uncommitted work BEFORE the merge attempt. When you did `git reset --hard`, that work was lost. However, there's a dangling commit (stash) that might contain it.

## The Dangling Commit

**Commit:** `302d658dc2582ec8ea2c1da0ec6c7c4d03e44e3f`  
**Type:** Stash commit (WIP on main)  
**Date:** Before your merge attempt

## What to Do

### Option 1: Selective Recovery (Recommended)

This will restore ONLY your work files (flow-comment, project-member, team-role, flow-activity) and exclude unrelated files:

```bash
bash selective-recover-work.sh
```

This script will:
- Find files related to your work
- Exclude merge-related and documentation files
- Restore only your actual work files

### Option 2: Manual Check First

If you want to see what's in the commit first:

```bash
bash check-dangling-commit.sh
```

This will show you:
- All files in the commit
- Which ones are your work
- Summary of changes

### Option 3: Restore Specific Files Manually

If you know which files you want:

```bash
# See all files in the commit
git diff --name-only 3ef27b3f58b294ef14d02825b499b658a30f10b3 302d658dc2582ec8ea2c1da0ec6c7c4d03e44e3f

# Restore a specific file
git checkout 302d658dc2582ec8ea2c1da0ec6c7c4d03e44e3f -- path/to/your/file

# Or restore multiple files
git checkout 302d658dc2582ec8ea2c1da0ec6c7c4d03e44e3f -- \
  packages/server/api/src/app/flows/flow-comment/ \
  packages/shared/src/lib/flows/flow-comment.ts
```

## After Recovery

1. **Review what was restored:**
   ```bash
   git status
   git diff
   ```

2. **Commit your recovered work:**
   ```bash
   git add -A
   git commit -m "recovered: uncommitted work from before merge attempt"
   ```

## Important Notes

- The dangling commit might contain BOTH your work AND merge-related changes
- The selective recovery script tries to filter out merge-related files
- If you're unsure, check the files first before restoring
- You can always undo with `git reset --hard HEAD` if you restore the wrong thing

