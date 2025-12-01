#!/bin/bash
# Selectively recover only YOUR work files from the dangling commit
# This excludes merge-related and unrelated files

set -e

DANGLING_COMMIT="302d658dc2582ec8ea2c1da0ec6c7c4d03e44e3f"
BEFORE_MERGE="3ef27b3f58b294ef14d02825b499b658a30f10b3"

echo "=== SELECTIVE RECOVERY OF YOUR WORK ==="
echo ""
echo "Checking dangling commit: $DANGLING_COMMIT"
echo ""

# Get all files changed in the commit
ALL_FILES=$(git diff --name-only $BEFORE_MERGE $DANGLING_COMMIT)

# Filter for files that look like YOUR work (not merge-related)
YOUR_WORK_FILES=$(echo "$ALL_FILES" | grep -E "(flow-comment|project-member|team-role|flow-activity|project-role|permission|collaboration)" | grep -v -E "(\.md$|\.sh$|\.py$|docs/|LICENSE|\.husky/)")

echo "=== Files that look like YOUR work (to restore) ==="
if [ -z "$YOUR_WORK_FILES" ]; then
    echo "✗ No work-related files found in this commit"
    echo ""
    echo "Checking all files to see what's there:"
    echo "$ALL_FILES" | head -30
    exit 1
else
    echo "$YOUR_WORK_FILES"
    echo ""
    echo "Total: $(echo "$YOUR_WORK_FILES" | wc -l) files"
fi

echo ""
echo "=== Files that will be EXCLUDED (not your work) ==="
EXCLUDED=$(echo "$ALL_FILES" | grep -v -E "(flow-comment|project-member|team-role|flow-activity|project-role|permission|collaboration)" | grep -E "(\.md$|\.sh$|\.py$|docs/|LICENSE|\.husky/)" | head -10)
if [ -n "$EXCLUDED" ]; then
    echo "$EXCLUDED"
    echo "... and others"
else
    echo "None (all files look relevant)"
fi

echo ""
read -p "Restore these work files? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

echo ""
echo "=== Restoring your work files ==="

# Restore each file
RESTORED=0
FAILED=0

while IFS= read -r file; do
    if [ -n "$file" ]; then
        echo -n "Restoring: $file ... "
        if git checkout $DANGLING_COMMIT -- "$file" 2>/dev/null; then
            echo "✓"
            ((RESTORED++))
        else
            echo "✗ FAILED"
            ((FAILED++))
        fi
    fi
done <<< "$YOUR_WORK_FILES"

echo ""
echo "=== DONE ==="
echo "Restored: $RESTORED files"
echo "Failed: $FAILED files"
echo ""
echo "Next steps:"
echo "  1. Review: git status"
echo "  2. Check: git diff to see what was restored"
echo "  3. Commit: git add -A && git commit -m 'recovered: uncommitted work from before merge'"

