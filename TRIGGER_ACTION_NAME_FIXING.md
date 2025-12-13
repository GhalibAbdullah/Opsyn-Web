# Trigger/Action Name Fixing Strategy

## The Problem

**Almost all flows have this issue:** Model generates trigger/action names that don't match the actual piece source code.

### Example
- Model: `triggerName: "new_email_received"`
- Correct: `triggerName: "gmail_new_email_received"`
- Result: Trigger doesn't register (orange exclamation mark in UI)

## Why This Happens

The model generates **many variations** that are semantically correct but don't match exact piece names:
- `new_email_received` vs `gmail_new_email_received`
- `new_row` vs `googlesheets_new_row_added`
- `sendEmail` vs `send_email`
- `summarize_text` vs `summarizeText`

## Current Solution (Two-Layer Approach)

### Layer 1: Hardcoded Common Fixes
Fast lookup for most common variations:
```python
TRIGGER_FIXES = {
    "@activepieces/piece-gmail": {
        "new_email": "gmail_new_email_received",
        "new_email_received": "gmail_new_email_received",  # Added
        # ... more variations
    }
}
```

### Layer 2: Registry-Based Auto-Fix
For variations not in the hardcoded list:
1. Load `piece_registry.json` (scanned from source code)
2. Look up available triggers/actions for the piece
3. Use pattern matching to find closest match
4. Auto-fix if similarity is high

## Implementation

The `_fix_trigger_name()` and `_fix_action_name()` methods now:
1. Check hardcoded fixes first (fast)
2. If not found, load piece registry
3. Try exact match
4. Try pattern matching (removes underscores/dashes, checks substrings)
5. Return original if no match found

## What's In Scope

✅ **Schema fixes** (this is one):
- Wrong trigger/action names
- Wrong versions
- Wrong field names
- Missing propertySettings

❌ **Logic fixes** (out of scope):
- Wrong piece for the task
- Invalid trigger/action combinations
- Business logic errors

## Adding New Variations

### Quick Fix (Immediate)
Add to `TRIGGER_FIXES` or `ACTION_FIXES` in `robust_post_processor.py`:

```python
"@activepieces/piece-gmail": {
    "new_email_received": "gmail_new_email_received",  # Add new variation
}
```

### Long-term Fix
The registry-based auto-fix should catch most variations automatically. If it doesn't:
1. Check `piece_registry.json` has the correct name
2. Improve pattern matching logic
3. Add to hardcoded list as fallback

## Testing

After adding fixes, test with:
```bash
python3 robust_post_processor.py model_output.json processed.json
python3 flow_template_converter.py processed.json template.json
```

Check the trigger/action names in the output match the piece registry.

