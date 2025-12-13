# Activepieces Flow Post-Processing Pipeline

## Overview

Three-step pipeline to convert raw AI model output into Activepieces-compatible flow JSON:

1. **JSON Validation** - Clean and validate raw JSON
2. **Robust Post-Processing** - Fix schema issues with pattern matching
3. **FlowTemplate Conversion** - Convert to UI import format

## Pipeline Steps

### Step 1: JSON Validation (`validate_json.py`)

**Input:** Raw model output (may have JSON syntax errors, markdown fences, extra data)

**Output:** Valid JSON file

**What it does:**
- Removes markdown code fences (```json ... ```)
- Strips extra data after JSON
- Validates JSON syntax
- Handles common syntax errors

**Usage:**
```bash
python3 validate_json.py raw_output.json validated.json
```

### Step 2: Robust Post-Processing (`robust_post_processor.py`)

**Input:** Valid JSON flow

**Output:** Schema-corrected flow JSON

**What it does:**
- ✅ **Robust pattern matching** for trigger/action names (NEW!)
  - Handles 37+ variations automatically
  - Uses semantic synonyms (`add` ≈ `insert`, `catch` ≈ `receive`)
  - 7 matching strategies (exact, normalized, token overlap, Levenshtein, etc.)
- ✅ Fixes `schemaVersion` (sets to "10")
- ✅ Fixes `displayName` (renames `name` → `displayName`)
- ✅ Fixes piece versions from registry
- ✅ Fixes trigger/action names using pattern matching
- ✅ Fixes field names (camelCase ↔ snake_case)
- ✅ Adds missing `propertySettings`
- ✅ Converts `CONDITION` → `ROUTER`
- ✅ Removes UI-only fields

**Usage:**
```bash
python3 robust_post_processor.py validated.json processed.json
```

**Pattern Matching Examples:**
- `new_email_received` → `gmail_new_email_received` ✅
- `addRow` → `insert_row` ✅
- `postMessage` → `send_channel_message` ✅
- `incomingWebhook` → `catch_webhook` ✅

### Step 3: FlowTemplate Conversion (`flow_template_converter.py`)

**Input:** Processed flow JSON

**Output:** FlowTemplate format for UI import

**What it does:**
- Wraps flow in `FlowTemplate` structure
- Adds metadata (`name`, `description`, `tags`, `pieces`)
- Nests flow in `template` field

**Usage:**
```bash
python3 flow_template_converter.py processed.json template.json
```

## Complete Pipeline Example

```bash
# Step 1: Validate JSON
python3 validate_json.py raw_model_output.json step0_validated.json

# Step 2: Robust post-processing (with pattern matching)
python3 robust_post_processor.py step0_validated.json step1_processed.json

# Step 3: Convert to FlowTemplate
python3 flow_template_converter.py step1_processed.json final_template.json

# Result: final_template.json is ready for UI import!
```

## Quick Test

```bash
# Test with Gmail flow
python3 validate_json.py gmail_step0.json step0.json
python3 robust_post_processor.py step0.json step1.json
python3 flow_template_converter.py step1.json final.json

# Check results
grep -E 'triggerName|actionName' final.json
```

## What Gets Fixed

### Schema Issues (In Scope) ✅
- Wrong trigger/action names → **Pattern matching fixes automatically**
- Wrong piece versions → Registry lookup fixes
- Wrong field names → Registry-based conversion
- Missing `propertySettings` → Auto-populated
- Wrong `schemaVersion` → Set to "10"
- `CONDITION` type → Converted to `ROUTER`

### Logic Issues (Out of Scope) ❌
- Wrong piece for the task
- Invalid trigger/action combinations
- Business logic errors
- Data access patterns (e.g., `{{trigger.body}}` vs `{{trigger.values}}`)

## Files

- `validate_json.py` - Step 1: JSON validation
- `robust_post_processor.py` - Step 2: Schema fixing with pattern matching
- `flow_template_converter.py` - Step 3: FlowTemplate conversion
- `piece_registry.json` - Source of truth for piece metadata
- `test_pattern_matching.py` - Test suite for pattern matching (37 tests)

## Recent Updates

✅ **Added robust pattern matching** (NameMatcher class)
- 7 matching strategies
- Semantic synonyms support
- 37/37 test cases pass
- Handles almost all model variations automatically

## Next Steps

The pipeline is production-ready! Just run all three steps in sequence for any model output.

