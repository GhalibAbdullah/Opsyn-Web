#!/bin/bash
# Recovery script to restore your working version (before merge with main)

set -e

echo "=== Recovery: Restore your working version ==="
echo ""

CURRENT_BRANCH=$(git branch --show-current)
echo "Current branch: $CURRENT_BRANCH"

echo ""
echo "=== Option 1: Restore from commit 6621ba6f75 (your work commit) ==="
WORK_COMMIT="6621ba6f75"
if git cat-file -e "$WORK_COMMIT^{commit}" 2>/dev/null; then
    echo "✓ Found your work commit: $WORK_COMMIT"
    echo "  Message: $(git log -1 --format='%s' $WORK_COMMIT)"
    echo ""
    echo "This commit has: feat: add team roles, project members, and flow comments features"
    echo ""
    read -p "Restore to this commit? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Stashing any current changes..."
        git stash push -m "Before restoring work - $(date)" 2>/dev/null || true
        
        echo "Resetting to $WORK_COMMIT..."
        git reset --hard "$WORK_COMMIT"
        
        echo ""
        echo "✓ Success! Your branch has been restored to commit $WORK_COMMIT"
        echo "This is your working version BEFORE you merged with main"
        echo ""
        echo "If you had uncommitted changes, check: git stash list"
        exit 0
    fi
else
    echo "✗ Commit $WORK_COMMIT not found"
fi

echo ""
echo "=== Option 2: Check stashes for uncommitted work ==="
if git stash list | grep -q .; then
    echo "Found stashes:"
    git stash list
    echo ""
    read -p "Show contents of most recent stash? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git stash show -p stash@{0} | head -50
        echo ""
        read -p "Apply this stash? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            git stash pop
            echo "✓ Stash applied!"
        fi
    fi
else
    echo "No stashes found"
fi

echo ""
echo "=== Option 3: Manual recovery ==="
echo "If your work isn't in the commit or stash, check:"
echo "  1. git reflog --all -30  (to see all recent operations)"
echo "  2. git fsck --lost-found  (to find dangling commits)"
echo ""
echo "Or check if your work is in uncommitted files:"
echo "  git status"

