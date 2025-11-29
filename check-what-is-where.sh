#!/bin/bash
# Check what's in stash vs what's uncommitted

echo "=== Files in STASH (Today's work) ==="
git stash show --name-only stash@{0}

echo ""
echo "=== Currently UNCOMMITTED files (causing errors) ==="
git status --short

echo ""
echo "=== Summary ==="
echo "STASH contains: Today's changes you worked on"
echo "UNCOMMITTED files: These are the incomplete features (flow-comments, project-members) causing errors"
echo ""
echo "The uncommitted files are NOT today's work - they're leftover incomplete features."

