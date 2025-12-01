#!/bin/bash
# Recover uncommitted work that existed BEFORE the merge attempt

set -e

echo "=== RECOVERING UNCOMMITTED WORK FROM BEFORE MERGE ==="
echo ""

# The commit before the merge/reset
BEFORE_RESET="3ef27b3f58b294ef14d02825b499b658a30f10b3"
# The commit after reset (where work was committed)
AFTER_RESET_COMMIT="6621ba6f75d2e835fa973d59571267fb87660d0e"
# The reset point
RESET_POINT="c186b4a185f350571559d3441c831d0832a8525f"

echo "Timeline:"
echo "  Before merge: $BEFORE_RESET"
echo "  Reset to: $RESET_POINT (this discarded uncommitted work)"
echo "  Then committed: $AFTER_RESET_COMMIT"
echo ""

echo "Step 1: Checking for stashes..."
if git stash list | grep -q .; then
    echo "✓ Found stashes:"
    git stash list
    echo ""
    echo "Most recent stash (might contain pre-merge work):"
    git stash show -p stash@{0} | head -100
    echo ""
    read -p "Apply this stash? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git stash pop
        echo "✓ Stash applied!"
        exit 0
    fi
else
    echo "✗ No stashes found"
fi

echo ""
echo "Step 2: Checking what files were in the commit vs what might have been uncommitted..."
echo ""
echo "Files in commit $AFTER_RESET_COMMIT:"
git diff --name-only $RESET_POINT $AFTER_RESET_COMMIT | head -30
echo ""

echo "Step 3: Checking for dangling commits (lost work)..."
DANGLING=$(git fsck --lost-found 2>&1 | grep "dangling commit" | head -10)
if [ -n "$DANGLING" ]; then
    echo "Found dangling commits (possibly lost uncommitted work):"
    echo "$DANGLING"
    echo ""
    echo "Checking first dangling commit..."
    FIRST_DANGLING=$(echo "$DANGLING" | head -1 | awk '{print $3}')
    if [ -n "$FIRST_DANGLING" ]; then
        echo "Commit: $FIRST_DANGLING"
        echo "Message: $(git log -1 --format='%s' $FIRST_DANGLING 2>/dev/null || echo 'N/A')"
        echo "Files:"
        git diff --name-only $RESET_POINT $FIRST_DANGLING 2>/dev/null | head -20 || echo "Could not diff"
        echo ""
        read -p "Restore this commit? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            git cherry-pick $FIRST_DANGLING || echo "Cherry-pick failed, trying checkout..."
            git checkout $FIRST_DANGLING -- . || echo "Checkout failed"
        fi
    fi
else
    echo "No dangling commits found"
fi

echo ""
echo "Step 4: Checking reflog for lost operations..."
echo "Recent operations around merge time:"
git reflog --all | grep -E "(176404|176405)" | head -10
echo ""

echo "Step 5: Comparing working directory state..."
echo "Current uncommitted files:"
git status --short | head -20
echo ""

echo "=== RECOVERY OPTIONS ==="
echo ""
echo "If your uncommitted work was:"
echo "  1. In a stash → Check: git stash list and git stash show"
echo "  2. Lost during reset → Check dangling commits above"
echo "  3. Still in working directory → Check: git status"
echo ""
echo "To see what files might have been lost, compare:"
echo "  git diff $BEFORE_RESET $AFTER_RESET_COMMIT"
echo ""

echo "=== MANUAL RECOVERY ==="
echo "If the above didn't find your work, try:"
echo "  1. git reflog --all -50  (look for commits around merge time)"
echo "  2. Check if files exist but are untracked: git status"
echo "  3. Check if work is in a different branch"
echo "  4. Look for backup files in your editor/IDE"

