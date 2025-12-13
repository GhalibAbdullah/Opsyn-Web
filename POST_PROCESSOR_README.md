# Post-Processor for Activepieces Flow JSON

## Overview

A robust post-processor that fixes common issues in model-generated Activepieces flow JSON to ensure schema compatibility.

## Features

✅ **Fixes Schema Issues:**
- `schemaVersion: null` → `"10"`
- `name` → `displayName` (if needed)
- Adds missing `propertySettings: {}`
- Adds missing `input: {}`
- Removes `sampleData` (UI-only field)
- Removes `inputUiInfo`, `pieceType`, `packageType` (UI-only fields)

✅ **Fixes Structure Issues:**
- `CONDITION` type → `ROUTER` type
- Ensures all required fields are present
- Validates flow structure

✅ **Fixes JSON Syntax:**
- Double colon errors: `"text":"value":"{{...}}"` → `"text":"value{{...}}"`

## Usage

### Basic Usage

```python
from post_processor import post_process_flow

# Process a JSON string
flow_json_str = '{"displayName":"My Flow",...}'
processed = post_process_flow(flow_json_str)

# Process a dict
flow_dict = {"displayName": "My Flow", ...}
processed = post_process_flow(flow_dict)
```

### Command Line

```bash
# Process a flow file
python post_processor.py input_flow.json output_flow.json

# Process and validate
python post_processor.py input_flow.json
```

### Prepare for Activepieces API

```bash
# Prepare flow for API import
python prepare_for_activepieces.py processed_flow.json flow_for_import.json
```

This creates a file ready for the Activepieces `IMPORT_FLOW` API operation.

## Example

### Input (from model):
```json
{
  "name": "My Flow",
  "trigger": {...},
  "schemaVersion": null
}
```

### Output (after post-processing):
```json
{
  "displayName": "My Flow",
  "trigger": {...},
  "schemaVersion": "10"
}
```

## Testing

### Test with Example Flow

```bash
python test_with_example.py
```

This will:
1. Post-process an example model output
2. Validate the result
3. Prepare it for API import
4. Save two files:
   - `example_flow_processed.json` - Post-processed flow
   - `example_flow_for_import.json` - Ready for Activepieces API

### Test Post-Processor

```bash
python test_post_processor.py
```

Tests the post-processor with multiple example outputs.

## Files Created

- `post_processor.py` - Main post-processor class
- `prepare_for_activepieces.py` - Prepares flow for API import
- `test_post_processor.py` - Tests post-processor
- `test_with_example.py` - Complete test with example flow

## API Integration

### Import Flow into Activepieces

1. **Create Flow First:**
```bash
POST /flows
{
  "displayName": "My Flow",
  "projectId": "your-project-id"
}
```

2. **Import Flow Structure:**
```bash
POST /flows/:flowId
Content-Type: application/json

# Use the output from prepare_for_activepieces.py
{
  "type": "IMPORT_FLOW",
  "request": {
    "displayName": "My Flow",
    "trigger": {...},
    "schemaVersion": "10"
  }
}
```

### Using the Generated File

```bash
# After running prepare_for_activepieces.py
curl -X POST https://your-activepieces-instance.com/api/flows/:flowId \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d @example_flow_for_import.json
```

## Validation

The post-processor includes validation:

```python
from post_processor import FlowPostProcessor

processor = FlowPostProcessor()
is_valid, errors = processor.validate(processed_flow)

if is_valid:
    print("✅ Flow is valid!")
else:
    print("⚠️  Errors:")
    for error in errors:
        print(f"   - {error}")
```

## What Gets Fixed

### ✅ Automatically Fixed:
- `schemaVersion: null` → `"10"`
- `name` → `displayName`
- `CONDITION` → `ROUTER`
- Missing `propertySettings` → `{}`
- Missing `input` → `{}`
- JSON syntax errors
- UI-only fields removed

### ⚠️ Not Fixed (Users can fix in UI):
- Wrong action names (e.g., `compose_and_send_email` → `send_email`)
- Wrong piece types (e.g., `piece-codemash` → CODE type)
- Hardcoded text (should use `{{trigger.values}}`)
- Wrong trigger types

## Example Workflow

```python
# 1. Get model output
model_output = model.generate(prompt)

# 2. Post-process
from post_processor import post_process_flow
processed = post_process_flow(model_output)

# 3. Prepare for API
from prepare_for_activepieces import prepare_for_import
api_payload = prepare_for_import(processed)

# 4. Import to Activepieces
import requests
response = requests.post(
    f"{API_URL}/flows/{flow_id}",
    json=api_payload,
    headers={"Authorization": f"Bearer {token}"}
)
```

## Testing in Activepieces UI

1. Run `python test_with_example.py`
2. Open `example_flow_for_import.json`
3. Copy the `request` object content
4. In Activepieces UI:
   - Create a new flow
   - Use "Import Flow" feature
   - Paste the JSON
   - Verify it appears correctly

## Troubleshooting

### JSON Parse Errors
- The post-processor tries to fix common syntax errors
- If parsing still fails, check the original JSON structure

### Validation Errors
- Check that all required fields are present
- Ensure `trigger` has `settings` with `pieceName` and `triggerName`
- Verify `schemaVersion` is set to `"10"`

### API Import Errors
- Ensure you're using the correct API endpoint
- Check that the flow ID exists
- Verify authentication token is valid

## Next Steps

After testing:
1. ✅ Verify flow appears in Activepieces UI
2. ✅ Check trigger and actions are configured
3. ✅ Test flow execution (if possible)
4. ✅ Report any issues found

---

**Ready to test!** Run `python test_with_example.py` and import the generated file into Activepieces.

