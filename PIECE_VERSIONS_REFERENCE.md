# Piece Versions Reference

## Overview

The post-processor (`post_processor.py`) automatically fixes piece versions for **all common pieces**, not just Google Sheets and Slack.

## Supported Pieces

The post-processor includes default versions for these pieces:

### Google Services
- `@activepieces/piece-google-sheets`: `~0.2.1`
- `@activepieces/piece-google-forms`: `~0.3.13`

### Communication
- `@activepieces/piece-slack`: `~0.10.18`
- `@activepieces/piece-gmail`: `~0.9.6`

### Scheduling
- `@activepieces/piece-schedule`: `~0.1.13`

### AI/ML
- `@activepieces/piece-ai`: `~0.0.2`
- `@activepieces/piece-openai`: `~0.6.0`

### CRM/Integration
- `@activepieces/piece-hubspot`: `~0.3.0`

### Web/HTTP
- `@activepieces/piece-webhook`: `~0.0.1`
- `@activepieces/piece-http`: `~0.3.0`

## How It Works

1. **Automatic Detection**: When processing a flow, the post-processor checks each piece's `pieceName`
2. **Version Replacement**: If the piece is in the `DEFAULT_VERSIONS` dictionary, it replaces the version with the correct one
3. **Fallback**: If a piece is not in the dictionary, it keeps the original version from the model output

## Adding New Pieces

To add support for a new piece:

1. Find the correct version from a working example flow
2. Add it to `DEFAULT_VERSIONS` in `post_processor.py`:
   ```python
   DEFAULT_VERSIONS = {
       # ... existing pieces ...
       "@activepieces/piece-new-piece": "~1.2.3",
   }
   ```

## Example

**Before (model output):**
```json
{
  "pieceName": "@activepieces/piece-google-sheets",
  "pieceVersion": "~0.1.1"  // ❌ Wrong version
}
```

**After (post-processed):**
```json
{
  "pieceName": "@activepieces/piece-google-sheets",
  "pieceVersion": "~0.2.1"  // ✅ Correct version
}
```

## Testing

The post-processor handles versions for **all pieces** automatically. You don't need to specify which pieces to fix - it works for any piece in the `DEFAULT_VERSIONS` dictionary.

