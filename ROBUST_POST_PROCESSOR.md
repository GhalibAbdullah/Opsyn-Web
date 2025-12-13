# Robust Post-Processor for Activepieces Flows

A generalized, data-driven solution for fixing AI-generated flow JSON to be compatible with Activepieces.

## Overview

This post-processor was built by:
1. **Analyzing training data** (767 entries) to find the most commonly used pieces
2. **Scanning source code** to extract correct trigger/action names and field names
3. **Building a comprehensive registry** that automatically fixes issues

## Features

### 1. Automatic Version Fixing
- Uses actual versions from `package.json` files
- Covers 20+ most-used pieces

### 2. Trigger/Action Name Normalization
- Fixes common name variations:
  - `new_row` → `googlesheets_new_row_added`
  - `sendEmail` → `send_email`
  - `ask_ai` → `askAi`

### 3. Field Name Conversion
- Handles different naming conventions per piece:
  - Google Sheets: snake_case → camelCase (`spreadsheet_id` → `spreadsheetId`)
  - Schedule: camelCase → snake_case (`hourOfTheDay` → `hour_of_the_day`)
  - Gmail: camelCase → snake_case (`bodyType` → `body_type`)

### 4. Schema Fixes
- Sets `schemaVersion` to "10" if null
- Converts `CONDITION` → `ROUTER` with proper structure
- Adds missing `propertySettings` for all input fields

### 5. FlowTemplate Generation
- Converts raw flows to UI-importable FlowTemplate format

## Supported Pieces (20+)

Based on training data frequency:

| Piece | Count | Version |
|-------|-------|---------|
| google-sheets | 450 | ~0.12.20 |
| text-ai | 322 | ~0.4.8 |
| gmail | 303 | ~0.9.6 |
| slack | 235 | ~0.10.16 |
| schedule | 185 | ~0.1.13 |
| utility-ai | 142 | ~0.5.9 |
| google-drive | 134 | ~0.5.52 |
| hubspot | 122 | ~0.7.19 |
| date-helper | 116 | ~0.1.19 |
| forms | 114 | ~0.4.10 |
| webhook | 102 | ~0.1.25 |
| telegram-bot | 98 | ~0.3.21 |
| store | 97 | ~0.6.10 |
| http | 87 | ~0.9.5 |
| notion | 71 | ~0.4.13 |
| tables | 60 | ~0.2.8 |
| openai | 56 | ~0.6.7 |
| salesforce | 51 | ~0.2.1 |
| pipedrive | 47 | ~0.7.7 |
| data-mapper | 39 | ~0.3.11 |

## Usage

### Three-Step Pipeline

**Step 0: Validate JSON** (clean/extract valid JSON from raw output)
```bash
python validate_json.py raw_output.txt validated.json
```

**Step 1: Robust Post-Processing** (fixes schema issues)
```bash
python robust_post_processor.py validated.json processed.json
```

**Step 2: Convert to FlowTemplate** (for UI import)
```bash
python flow_template_converter.py processed.json template.json
```

### One-liner
```bash
python validate_json.py raw.txt v.json && python robust_post_processor.py v.json p.json && python flow_template_converter.py p.json template.json
```

### Programmatic

```python
from validate_json import extract_json
from robust_post_processor import RobustFlowPostProcessor
from flow_template_converter import convert_to_flow_template

# Step 0: Validate JSON
json_str, msg = extract_json(raw_model_output)

# Step 1: Robust post-processing
processor = RobustFlowPostProcessor()
processed = processor.process_string(json_str)

# Step 2: Convert to FlowTemplate for UI import
template = convert_to_flow_template(processed)
```

## Scope

**What the pipeline DOES fix:**
- JSON syntax issues (truncated, extra chars, markdown blocks)
- Piece versions (from registry)
- Trigger/action names (common variations)
- Field names (camelCase/snake_case conversions)
- Schema version (null → "10")
- PropertySettings (auto-populate)
- CONDITION → ROUTER conversion

**What the pipeline does NOT fix:**
- Semantic/logic errors (wrong piece for the task)
- Invalid trigger/action combinations
- Business logic issues

End users are responsible for fixing logic issues after import.

## Files

### Core Pipeline
- `validate_json.py` - Step 0: Validates/cleans JSON
- `robust_post_processor.py` - Step 1: Fixes schema issues
- `flow_template_converter.py` - Step 2: Converts to FlowTemplate

### Analysis & Registry
- `analyze_training_pieces.py` - Analyzes training data for common pieces
- `build_piece_registry.py` - Builds registry from source code
- `piece_registry.json` - Generated piece metadata
- `training_piece_analysis.json` - Training data analysis results

### Testing
- `test_all_model_outputs.py` - Test suite

## Extending

### Adding a New Piece

1. Add version to `PieceRegistry.VERSIONS`:
```python
"@activepieces/piece-new-piece": "~1.0.0",
```

2. Add trigger name fixes (if needed):
```python
"@activepieces/piece-new-piece": {
    "wrong_name": "correct_name",
},
```

3. Add action name fixes (if needed):
```python
"@activepieces/piece-new-piece": {
    "wrongName": "correct_name",
},
```

4. Add field conversions (if needed):
```python
"@activepieces/piece-new-piece": {
    "wrong_field": "correctField",
},
```

### Regenerating Registry

```bash
# Re-analyze training data
python analyze_training_pieces.py

# Re-scan source code
python build_piece_registry.py
```

## Test Results

All 4 test cases pass:
- ✅ Google Sheets + Slack (version, trigger name, field names)
- ✅ Schedule + Gmail (version, field names, action names)
- ✅ Webhook + CONDITION→ROUTER conversion
- ✅ Text AI (version, action names)

