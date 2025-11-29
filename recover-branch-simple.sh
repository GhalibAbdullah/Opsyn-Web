#!/bin/bash
# Simple recovery script - resets branch to before the merge

set -e

echo "Stashing today's changes..."
git stash push -m "Today's changes - not ready to commit"

echo "Resetting branch to before merge..."
git reset --hard c186b4a185f350571559d3441c831d0832a8525f

echo "Done! Your branch is now at the commit before the merge."
echo "Your stashed changes are saved. View with: git stash list"
echo "To restore today's changes later: git stash pop"

