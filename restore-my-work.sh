#!/bin/bash
# Simple script to restore your work commit

set -e

WORK_COMMIT="6621ba6f75d2e835fa973d59571267fb87660d0e"
CURRENT_BRANCH=$(git branch --show-current)

echo "=== RESTORING YOUR WORK ==="
echo ""
echo "Current branch: $CURRENT_BRANCH"
echo "Current commit: $(git rev-parse HEAD)"
echo "Work commit: $WORK_COMMIT"
echo ""

# Verify commit exists
if ! git cat-file -e "$WORK_COMMIT^{commit}" 2>/dev/null; then
    echo "✗ ERROR: Work commit not found!"
    exit 1
fi

echo "✓ Work commit found!"
echo "  Message: $(git log -1 --format='%s' $WORK_COMMIT)"
echo ""

# Show what will be restored
echo "Files in that commit:"
git diff --name-only HEAD $WORK_COMMIT | head -20
echo ""

# Save current state
echo "Saving current state to stash..."
git stash push -m "Before restoring work - $(date)" 2>/dev/null || echo "No changes to stash"

# Restore the work
echo ""
echo "Restoring your work..."
git reset --hard "$WORK_COMMIT"

echo ""
echo "=== SUCCESS! ==="
echo "Your branch has been restored to commit $WORK_COMMIT"
echo ""
echo "Your work includes:"
echo "  - Team roles and permissions"
echo "  - Project members"
echo "  - Flow comments"
echo "  - Flow activity"
echo ""
echo "Next steps:"
echo "  1. Review your work: git status"
echo "  2. If you had uncommitted files, check: git stash list"
echo "  3. Commit any additional changes: git add -A && git commit -m 'your message'"

