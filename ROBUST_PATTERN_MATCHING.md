# Robust Pattern Matching for Trigger/Action Names

## The Problem

Model generates trigger/action names that don't match the actual piece source code:
- Model: `triggerName: "new_email_received"`
- Correct: `triggerName: "gmail_new_email_received"`
- Result: Trigger doesn't register (orange exclamation mark in UI)

## Solution: NameMatcher Class

The `NameMatcher` class in `robust_post_processor.py` uses **7 matching strategies**:

### Matching Strategies

| Strategy | Example | Score |
|----------|---------|-------|
| Exact match | `insert_row` = `insert_row` | 1.0 |
| Normalized match | `insertRow` = `insert_row` | 0.98 |
| Prefix stripping | `gmail_new_email` → `new_email` | 0.95 |
| Substring match | `new_email` in `gmail_new_email_received` | 0.90 |
| Token overlap | `["send", "message"]` ∩ `["send", "channel", "message"]` | 0.6-0.8 |
| Levenshtein distance | `catch_request` ~ `catch_webhook` | 0.5-0.7 |
| Semantic synonyms | `addRow` → `insert_row` via `add ≈ insert` | 0.7+ |

### Semantic Synonyms

The matcher knows these words are equivalent:

**Verbs:**
- `add` ≈ `insert` ≈ `create` ≈ `append`
- `get` ≈ `fetch` ≈ `retrieve` ≈ `find` ≈ `list`
- `delete` ≈ `remove` ≈ `trash` ≈ `destroy`
- `send` ≈ `post` ≈ `submit` ≈ `publish`
- `catch` ≈ `receive` ≈ `incoming` ≈ `handle`
- `update` ≈ `edit` ≈ `modify` ≈ `patch`

**Nouns:**
- `webhook` ≈ `trigger` ≈ `hook` ≈ `request`
- `message` ≈ `msg` ≈ `notification` ≈ `alert`
- `row` ≈ `record` ≈ `entry` ≈ `item`
- `email` ≈ `mail` ≈ `message`
- `channel` ≈ `room` ≈ `chat`

## Test Results

**37/37 test cases pass:**

```
✅ 'new_email_received' → 'gmail_new_email_received' (score: 0.95)
✅ 'addRow' → 'insert_row' (score: 0.75)
✅ 'postMessage' → 'send_channel_message' (score: 0.51)
✅ 'incomingWebhook' → 'catch_webhook' (score: 0.73)
✅ 'retrieveRows' → 'find_rows' (score: 0.70)
✅ 'fetchRows' → 'find_rows' (score: 0.73)
✅ 'removeRow' → 'delete_row' (score: 0.80)
✅ 'catchWebhook' → 'catch_webhook' (score: 0.98)
... and 29 more
```

## Usage

```python
from robust_post_processor import NameMatcher

# Find best match for a model-generated name
match = NameMatcher.find_best_match(
    "new_email_received",
    ["gmail_new_email_received", "new_labeled_email"],
    threshold=0.45
)
# Result: ("gmail_new_email_received", 0.95)

# Get similarity score between two names
score = NameMatcher.similarity_score("addRow", "insert_row")
# Result: 0.75
```

## Configuration

### Threshold
Default threshold is **0.45** (45% similarity required). Adjust if needed:
- Lower (0.3): Catches more variations but may have false positives
- Higher (0.6): More conservative, fewer false positives

### Adding New Synonyms
Edit the `SYNONYMS` dict in `NameMatcher`:

```python
SYNONYMS = {
    "add": ["insert", "create", "new", "append"],
    # Add your synonym here:
    "myverb": ["synonym1", "synonym2"],
}
```

### Default Preferences
When two candidates have similar scores, preferences resolve ambiguity:

```python
DEFAULT_PREFERENCES = {
    ("send", "message"): "channel",  # Prefer channel over direct
}
```

## Files

- `robust_post_processor.py` - Contains `NameMatcher` class
- `piece_registry.json` - List of valid trigger/action names per piece
- `test_pattern_matching.py` - Test suite (37 test cases)

## How It Integrates

The post-processor automatically uses pattern matching:

1. First checks hardcoded fixes (fastest)
2. Then loads `piece_registry.json` for available names
3. Uses `NameMatcher.find_best_match()` to find the best candidate
4. Returns the match if score ≥ threshold

