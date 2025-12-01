# Quick Recovery Guide

## Your Work is Safe!

Your work commit exists: `6621ba6f75d2e835fa973d59571267fb87660d0e`

## Option 1: Restore Everything (Recommended)

This will restore your branch to the commit with all your work:

```bash
# First, save any current changes
git stash push -m "Current state before recovery - $(date)"

# Restore your work commit
git reset --hard 6621ba6f75d2e835fa973d59571267fb87660d0e
```

## Option 2: Create New Branch (Safer)

This keeps your current branch and creates a new one with your work:

```bash
# Create a new branch from your work commit
git branch recovered-work 6621ba6f75d2e835fa973d59571267fb87660d0e

# Switch to it
git checkout recovered-work
```

## Option 3: Cherry-pick Specific Files

If you only want some files from that commit:

```bash
# See what files are in that commit
git diff --name-only HEAD 6621ba6f75d2e835fa973d59571267fb87660d0e

# Restore specific files
git checkout 6621ba6f75d2e835fa973d59571267fb87660d0e -- path/to/file
```

## Check for Lost Uncommitted Files

If you had uncommitted files that weren't in that commit, check:

```bash
# Check reflog for any lost commits
git reflog --all -30

# Check for dangling commits (lost work)
git fsck --lost-found

# Check if there are any stashes
git stash list
```

## After Recovery

Once you've recovered your work, make sure to commit it properly:

```bash
# Check what's changed
git status

# Add all your work
git add -A

# Commit it
git commit -m "feat: recovered work - team roles, project members, flow comments"
```

