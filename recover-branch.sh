#!/bin/bash
# Recovery script to go back to before the merge

set -e

echo "=== Stashing today's changes ==="
git stash push -m "Today's changes - not ready to commit"

echo ""
echo "=== Checking current branch ==="
CURRENT_BRANCH=$(git branch --show-current)
echo "Current branch: $CURRENT_BRANCH"

echo ""
echo "=== Finding commit before merge ==="
# The commit before the merge that ruined things
BEFORE_MERGE="c186b4a185f350571559d3441c831d0832a8525f"
echo "Target commit: $BEFORE_MERGE"

echo ""
echo "=== Verifying commit exists ==="
if git cat-file -e "$BEFORE_MERGE^{commit}" 2>/dev/null; then
    echo "✓ Commit exists"
else
    echo "✗ Commit not found!"
    exit 1
fi

echo ""
echo "=== Resetting branch to before merge ==="
echo "This will reset $CURRENT_BRANCH to $BEFORE_MERGE"
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

git reset --hard "$BEFORE_MERGE"

echo ""
echo "=== Success! ==="
echo "Branch $CURRENT_BRANCH has been reset to commit $BEFORE_MERGE"
echo ""
echo "Your stashed changes:"
git stash list
echo ""
echo "To restore today's changes later: git stash pop"

