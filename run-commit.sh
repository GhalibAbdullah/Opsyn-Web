#!/bin/bash
# Simple version - just run the commands directly

# Discard today's stash
git stash drop stash@{0} 2>/dev/null || echo "No stash to drop"

# Reset modified files to remove today's changes
git checkout -- .

# Add and commit untracked files (work from before today)
git add -A
git commit -m "feat: add team roles, project members, and flow comments features

- Add project-members entity and service
- Add project-roles controller and module  
- Add flow-comments feature (backend and frontend)
- Add related migrations and shared types
- All features working before merge attempt"

echo "Done! Your work from before today is now committed."

