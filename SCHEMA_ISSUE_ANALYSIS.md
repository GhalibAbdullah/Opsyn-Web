# Schema Issue Analysis: Trigger/Action Name Mismatches

## The Problem

**Current Issue:**
- Model output: `triggerName: "new_email_received"`
- Correct name: `triggerName: "gmail_new_email_received"`
- **Result:** Trigger doesn't register in UI (orange exclamation mark)

## Why This Happens

The model generates many variations of trigger/action names that don't match the actual piece source code:

| Model Output | Correct Name | Status |
|--------------|--------------|--------|
| `new_email_received` | `gmail_new_email_received` | ❌ Not fixed |
| `new_email` | `gmail_new_email_received` | ✅ Fixed |
| `new_row` | `googlesheets_new_row_added` | ✅ Fixed |
| `every_hour` | `every_hour` | ✅ Correct |
| `summarize_text` | `summarizeText` | ✅ Fixed |

## Why Post-Processor Can't Fix It (Current Implementation)

The post-processor uses a **hardcoded fix list** that only covers common variations:

```python
TRIGGER_FIXES = {
    "@activepieces/piece-gmail": {
        "new_email": "gmail_new_email_received",  # ✅ Covers this
        "newEmail": "gmail_new_email_received",   # ✅ Covers this
        "new-email": "gmail_new_email_received",  # ✅ Covers this
        # ❌ Missing: "new_email_received"
    }
}
```

**Problem:** The model generates **too many variations** to hardcode them all.

## Solution: Use Piece Registry for Automatic Lookup

Instead of hardcoded fixes, we should:

1. **Load piece registry** (already have `piece_registry.json`)
2. **For each trigger/action**, look up the piece's actual trigger/action names
3. **Use fuzzy matching** to find the closest match
4. **Auto-fix** if confidence is high

### Example Implementation

```python
def fix_trigger_name_using_registry(piece_name: str, trigger_name: str) -> str:
    """Use piece registry to find correct trigger name."""
    if piece_name not in registry:
        return trigger_name
    
    piece_data = registry[piece_name]
    available_triggers = [t["name"] for t in piece_data["triggers"]]
    
    # Exact match
    if trigger_name in available_triggers:
        return trigger_name
    
    # Fuzzy match (find closest)
    best_match = find_closest_match(trigger_name, available_triggers)
    if best_match and similarity(trigger_name, best_match) > 0.8:
        return best_match
    
    return trigger_name
```

## What You Should Do

### Option 1: Expand Fix List (Quick Fix)
Add more variations to `TRIGGER_FIXES` and `ACTION_FIXES` in `robust_post_processor.py`:

```python
"@activepieces/piece-gmail": {
    "new_email": "gmail_new_email_received",
    "newEmail": "gmail_new_email_received",
    "new-email": "gmail_new_email_received",
    "new_email_received": "gmail_new_email_received",  # ADD THIS
    "newEmailReceived": "gmail_new_email_received",     # ADD THIS
    "new-email-received": "gmail_new_email_received",  # ADD THIS
}
```

**Pros:** Quick, works immediately
**Cons:** Need to manually add each variation as you find them

### Option 2: Use Registry-Based Auto-Fix (Better Solution)
Modify `robust_post_processor.py` to:
1. Load `piece_registry.json`
2. For each piece, look up available triggers/actions
3. Use pattern matching or fuzzy matching to auto-fix

**Pros:** Handles all variations automatically
**Cons:** Requires implementation

### Option 3: Improve Training Data (Long-term)
Fix the training data so the model learns correct trigger/action names from the start.

**Pros:** Prevents the issue at the source
**Cons:** Requires retraining

## Recommendation

**Immediate:** Add common variations to the fix list (Option 1)
**Long-term:** Implement registry-based auto-fix (Option 2)

## Current Status

This is **IN SCOPE** for the post-processor - it's a schema issue (wrong trigger name), not a logic issue. The post-processor just needs better trigger/action name fixing.

