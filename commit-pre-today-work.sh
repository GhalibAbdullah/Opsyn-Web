#!/bin/bash
# Commit all the work from before today and discard today's stash
# This will discard today's modifications and commit the work from before today

set -e

echo "=== Step 1: Discarding today's work from stash ==="
if git stash list | grep -q "Today's changes"; then
    git stash drop stash@{0}
    echo "✓ Today's work discarded from stash"
else
    echo "⚠ No stash found, continuing..."
fi

echo ""
echo "=== Step 2: Resetting any modified tracked files to remove today's changes ==="
echo "This will remove today's modifications but keep untracked files (your work from before today)"
git checkout -- .

echo ""
echo "=== Step 3: Checking what needs to be committed (untracked files) ==="
git status --short | head -30

echo ""
echo "=== Step 4: Adding all untracked files (your work from before today) ==="
git add -A

echo ""
echo "=== Step 5: Committing all the work from before today ==="
git commit -m "feat: add team roles, project members, and flow comments features

- Add project-members entity and service
- Add project-roles controller and module  
- Add flow-comments feature (backend and frontend)
- Add related migrations and shared types
- All features working before merge attempt"

echo ""
echo "=== Done! ==="
echo "✓ Today's modifications discarded"
echo "✓ All your work from before today has been committed"
echo "Your branch should now be in a good state."

