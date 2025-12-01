#!/bin/bash
# Script to find and recover your working version before the merge

set -e

echo "=== Searching for your work ==="
echo ""

echo "=== 1. Checking git stash (uncommitted work) ==="
if git stash list | grep -q .; then
    echo "Found stashes:"
    git stash list
    echo ""
    echo "To see what's in the most recent stash:"
    echo "  git stash show -p stash@{0}"
    echo ""
else
    echo "No stashes found"
fi

echo ""
echo "=== 2. Checking recent commits that might have your work ==="
echo "Recent commits:"
git log --oneline --all -20 | head -20

echo ""
echo "=== 3. Looking for your work commit ==="
WORK_COMMIT="6621ba6f75"
if git cat-file -e "$WORK_COMMIT^{commit}" 2>/dev/null; then
    echo "✓ Found commit $WORK_COMMIT"
    echo "  Message: $(git log -1 --format='%s' $WORK_COMMIT)"
    echo "  Date: $(git log -1 --format='%cd' $WORK_COMMIT)"
    echo ""
    echo "This might be your working version!"
    echo "To see what changed: git show --stat $WORK_COMMIT"
    echo "To restore to this commit: git reset --hard $WORK_COMMIT"
else
    echo "✗ Commit $WORK_COMMIT not found"
fi

echo ""
echo "=== 4. Checking reflog for lost commits ==="
echo "Recent reflog entries (showing last 15):"
git reflog --date=relative -15

echo ""
echo "=== 5. Current branch state ==="
echo "Current branch: $(git branch --show-current)"
echo "Current HEAD: $(git rev-parse --short HEAD)"
echo "Working directory status:"
git status --short | head -10

echo ""
echo "=== Next steps ==="
echo "If you found your work in a stash, restore it with: git stash pop"
echo "If your work is in commit $WORK_COMMIT, restore with: git reset --hard $WORK_COMMIT"
echo "If your work is uncommitted, check: git status"

