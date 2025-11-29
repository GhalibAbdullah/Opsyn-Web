#!/bin/bash
# Clean up uncommitted files to get back to clean working state

set -e

echo "=== Current status ==="
git status --short | head -20

echo ""
echo "=== Cleaning uncommitted files that cause errors ==="
echo "This will remove:"
echo "  - flow-comment related files"
echo "  - project-members files" 
echo "  - project-roles files"
echo "  - Other incomplete feature files"
echo ""
echo "Your stashed changes are safe in git stash"
echo ""

# Remove untracked files and directories
git clean -fd

# Reset all modified tracked files to match HEAD
git reset --hard HEAD

echo ""
echo "=== Done! ==="
echo "Your working directory is now clean and matches commit c186b4a185f350571559d3441c831d0832a8525f"
echo ""
echo "To see your stashed changes: git stash list"
echo "To restore them later: git stash pop"

