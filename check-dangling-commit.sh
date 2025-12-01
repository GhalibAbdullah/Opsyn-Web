#!/bin/bash
# Check what's in the dangling commit to see if it's the lost work

DANGLING_COMMIT="302d658dc2582ec8ea2c1da0ec6c7c4d03e44e3f"
BEFORE_MERGE="3ef27b3f58b294ef14d02825b499b658a30f10b3"

echo "=== CHECKING DANGLING COMMIT ==="
echo ""

echo "Commit: $DANGLING_COMMIT"
echo "Message: $(git log -1 --format='%s' $DANGLING_COMMIT)"
echo "Date: $(git log -1 --format='%ad' --date=iso $DANGLING_COMMIT $DANGLING_COMMIT)"
echo ""

echo "=== Files changed in this commit ==="
git diff --name-only $BEFORE_MERGE $DANGLING_COMMIT | head -50
echo ""

echo "=== Summary of changes ==="
git diff --stat $BEFORE_MERGE $DANGLING_COMMIT | head -30
echo ""

echo "=== Checking if this looks like your work (not merge-related) ==="
echo ""
echo "Files that might be your work:"
git diff --name-only $BEFORE_MERGE $DANGLING_COMMIT | grep -E "(flow-comment|project-member|team-role|flow-activity)" | head -20
echo ""

echo "=== To see full diff of a specific file ==="
echo "git show $DANGLING_COMMIT:path/to/file"
echo ""
echo "=== To restore specific files only ==="
echo "git checkout $DANGLING_COMMIT -- path/to/file1 path/to/file2"
echo ""

