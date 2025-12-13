# Field Name Reference Guide

## Overview

Different Activepieces pieces use different naming conventions. This guide helps ensure correct field names.

## Naming Conventions by Piece

### Snake_case (underscore_separated)

**Google Sheets:**
- ✅ `spreadsheet_id` (not `spreadsheetId`)
- ✅ `sheet_id` (not `sheetId`)
- ✅ `row_id` (not `rowId`)
- ✅ `value_column_A` (not `valueColumnA`)
- ✅ `first_row_headers` (not `firstRowHeaders`)
- ⚠️ `includeTeamDrives` (mixed case - stays as-is)

**Schedule:**
- ✅ `timezone`
- ✅ `hour_of_the_day` (not `hourOfTheDay`)
- ✅ `run_on_weekends` (not `runOnWeekends`)

**Google Forms:**
- ✅ `form_id` (not `formId`)
- ✅ `include_team_drives` (not `includeTeamDrives`)

### CamelCase

**Slack:**
- ✅ `channel`
- ✅ `text`
- ✅ `blocks`
- ✅ `unfurlLinks`
- ✅ `replyBroadcast`
- ✅ `mentionOriginFlow`

**Gmail:**
- ✅ `cc`
- ✅ `bcc`
- ✅ `body`
- ✅ `subject`
- ✅ `receiver`
- ✅ `body_type` (snake_case!)
- ✅ `reply_to` (snake_case!)

## Common Mistakes

### ❌ Wrong → ✅ Correct

**Google Sheets:**
- `spreadsheetId` → `spreadsheet_id`
- `sheetId` → `sheet_id`
- `rowId` → `row_id`

**Schedule:**
- `hourOfTheDay` → `hour_of_the_day`
- `runOnWeekends` → `run_on_weekends`

**Google Forms:**
- `formId` → `form_id`

## Post-Processor Fixes

The post-processor (`post_processor.py`) automatically fixes these field names:

1. **Google Sheets**: Converts camelCase to snake_case
2. **Schedule**: Converts camelCase to snake_case
3. **Google Forms**: Converts camelCase to snake_case
4. **PropertySettings**: Ensures all input fields have corresponding propertySettings entries

## How to Verify

1. Check working examples in `example_flows/` directory
2. Compare field names with piece documentation
3. Test import in Activepieces UI

## Adding New Mappings

To add new field name mappings, update `FIELD_NAME_MAPPINGS` in:
- `fix_all_field_names.py`
- `post_processor.py` (in `_fix_settings` method)

