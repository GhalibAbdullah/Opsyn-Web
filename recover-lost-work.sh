#!/bin/bash
# Comprehensive recovery script for lost uncommitted work

set -e

echo "=== RECOVERING LOST WORK ==="
echo ""

# The commit with your work
WORK_COMMIT="6621ba6f75d2e835fa973d59571267fb87660d0e"

echo "Step 1: Checking if work commit exists..."
if git cat-file -e "$WORK_COMMIT^{commit}" 2>/dev/null; then
    echo "✓ Found your work commit: $WORK_COMMIT"
    echo "  Message: $(git log -1 --format='%s' $WORK_COMMIT)"
    echo ""
    
    echo "Step 2: Listing files in that commit..."
    echo "Files changed in that commit:"
    git diff --name-only HEAD $WORK_COMMIT | head -30
    echo ""
    
    echo "Step 3: Checking for stashes..."
    if git stash list | grep -q .; then
        echo "✓ Found stashes:"
        git stash list
        echo ""
        echo "Most recent stash contents:"
        git stash show --name-only stash@{0} | head -20
    else
        echo "✗ No stashes found"
    fi
    echo ""
    
    echo "Step 4: Checking reflog for lost commits..."
    echo "Recent operations that might have your work:"
    git reflog --all -20 | grep -E "(commit|reset|stash)" | head -10
    echo ""
    
    echo "Step 5: Checking for dangling commits (lost work)..."
    DANGLING=$(git fsck --lost-found 2>&1 | grep "dangling commit" | head -5)
    if [ -n "$DANGLING" ]; then
        echo "Found dangling commits (possibly lost work):"
        echo "$DANGLING"
    else
        echo "No dangling commits found"
    fi
    echo ""
    
    echo "=== RECOVERY OPTIONS ==="
    echo ""
    echo "Option A: Restore the work commit (6621ba6f75)"
    echo "  This will reset your branch to that commit"
    echo "  Command: git reset --hard $WORK_COMMIT"
    echo ""
    echo "Option B: Cherry-pick files from that commit"
    echo "  This will add files from that commit without resetting"
    echo "  Command: git checkout $WORK_COMMIT -- <file>"
    echo ""
    echo "Option C: Create a new branch from that commit"
    echo "  This preserves your current branch"
    echo "  Command: git branch recovered-work $WORK_COMMIT"
    echo ""
    
    read -p "Choose option (A/B/C) or 'q' to quit: " -n 1 -r
    echo
    case $REPLY in
        [Aa])
            echo "Stashing current changes..."
            git stash push -m "Before restoring work - $(date)" 2>/dev/null || true
            echo "Resetting to $WORK_COMMIT..."
            git reset --hard "$WORK_COMMIT"
            echo "✓ Restored to work commit!"
            echo "Check: git stash list (for any stashed changes)"
            ;;
        [Bb])
            echo "Files in that commit:"
            git diff --name-only HEAD $WORK_COMMIT
            echo ""
            read -p "Enter file path to restore (or 'all' for all files): " FILE_PATH
            if [ "$FILE_PATH" = "all" ]; then
                git checkout $WORK_COMMIT -- .
                echo "✓ All files restored!"
            else
                git checkout $WORK_COMMIT -- "$FILE_PATH"
                echo "✓ File restored: $FILE_PATH"
            fi
            ;;
        [Cc])
            BRANCH_NAME="recovered-work-$(date +%s)"
            git branch "$BRANCH_NAME" "$WORK_COMMIT"
            echo "✓ Created branch: $BRANCH_NAME"
            echo "Switch to it: git checkout $BRANCH_NAME"
            ;;
        *)
            echo "Quitting..."
            ;;
    esac
else
    echo "✗ Work commit not found: $WORK_COMMIT"
    echo ""
    echo "Trying to find it in reflog..."
    git reflog --all | grep "$WORK_COMMIT" | head -5
fi

echo ""
echo "=== DONE ==="

