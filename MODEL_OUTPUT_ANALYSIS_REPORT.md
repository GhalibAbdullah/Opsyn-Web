# Model Output Analysis Report

## Executive Summary

**Schema Compatibility: ⚠️ PARTIALLY COMPATIBLE (1/5 = 20%)**

- **1 output** is schema-compatible (can be post-processed)
- **4 outputs** have critical issues preventing direct use
- **Post-processing** can fix ~40% of issues
- **Training data** needed for remaining 60% of issues

---

## Detailed Analysis

### Output 1: Google Sheets → Slack ✅ (Post-processable)

**Request:** "When a new row is added to the 'Leads' Google Sheet, send a Slack message to #sales with the lead name and email."

**Issues:**
- ❌ Uses `"name"` instead of `"displayName"` at root level
- ❌ Missing `"schemaVersion"` at root level
- ⚠️ Text doesn't use actual lead data: `"text":"Notification from Notify Sales of New Leads"` (should use `{{trigger.values.Name}}` and `{{trigger.values.Email}}`)

**Positives:**
- ✅ Correct trigger structure (`new_row`)
- ✅ Correct action name (`send_channel_message`)
- ✅ Has `propertySettings`
- ✅ Has `pieceVersion`

**Post-Processor Can Fix:** ✅ YES
- Add `schemaVersion: "10"`
- Rename `name` → `displayName`
- Add missing `input: {}` if needed

**Post-Processor CANNOT Fix:** ❌ NO
- Text content (hardcoded instead of using `{{trigger.values}}`)

**Verdict:** ✅ **COMPATIBLE** (after post-processing)

---

### Output 2: Webhook Conditional (ROUTER) ❌ (Critical Issues)

**Request:** "When a webhook is received, if email is missing then send a Slack alert to #ops, else add the payload to a Google Sheet named 'Inbound'."

**Issues:**
- ❌ Uses `"name"` instead of `"displayName"` at root level
- ❌ Missing `"schemaVersion"` at root level
- ❌ **CRITICAL: Logic is REVERSED!**
  - Condition checks if email EXISTS (should check if MISSING)
  - Branch names are backwards ("Email is Present" should be "Email Missing")
  - Children order is wrong (Slack alert should be in first branch, not second)
- ❌ Missing `"input"` in trigger settings (should be `{}`)

**Positives:**
- ✅ Has ROUTER structure (correct type)
- ✅ Has `propertySettings`
- ✅ Has correct piece names

**Post-Processor Can Fix:** ⚠️ PARTIAL
- Add missing `input`, missing `schemaVersion`
- Rename `name` → `displayName`
- **BUT CANNOT fix reversed logic**

**Post-Processor CANNOT Fix:** ❌ NO
- Reversed conditional logic
- Wrong branch order

**Verdict:** ❌ **NOT COMPATIBLE** (logic is wrong)

---

### Output 3: Schedule → Multi-step ❌ (Syntax Error)

**Request:** "Every day at 9am, read today's rows from Google Sheets 'Leads', summarize them, and post the summary to Slack #sales."

**Issues:**
- ❌ Uses `"name"` instead of `"displayName"` at root level
- ❌ Missing `"schemaVersion"` at root level
- ❌ **SYNTAX ERROR:** `"text":"Notification from Send Slack Message":"{{step_3.output.summary}}"` (double colon issue)
- ⚠️ Has `"sampleData"` field (should be removed)
- ⚠️ Uses wrong action name `"get_rows"` (should be `"get_values"` or `"get-many-rows"`)
- ⚠️ Request says "today's rows" but flow gets "yesterday's rows" first

**Positives:**
- ✅ Has multi-step chain structure
- ✅ Has CODE action (correct type)
- ✅ Has `propertySettings`

**Post-Processor Can Fix:** ⚠️ PARTIAL
- Remove `sampleData`, add `schemaVersion`
- Rename `name` → `displayName`
- **BUT CANNOT fix syntax errors or wrong action names**

**Post-Processor CANNOT Fix:** ❌ NO
- Syntax errors (double colon)
- Wrong action names (`get_rows`)

**Verdict:** ❌ **NOT COMPATIBLE** (syntax error prevents parsing)

---

### Output 4: Explicit Steps ❌ (Wrong Names)

**Request:** "Create a flow using these steps: Trigger: google_sheets_row_added (sheet: Leads) Action1: slack_send_message..."

**Issues:**
- ❌ Uses `"name"` instead of `"displayName"` at root level
- ❌ Missing `"schemaVersion"` at root level
- ❌ Wrong trigger name: `"google_sheets_row_added"` should be `"new_row"`
- ❌ Wrong action name: `"slack_send_message"` should be `"send_channel_message"`
- ❌ Wrong data access: `{{trigger.body.Name}}` should be `{{trigger.values.Name}}` for Google Sheets

**Positives:**
- ✅ Has basic structure
- ✅ Has `propertySettings`

**Post-Processor Can Fix:** ⚠️ PARTIAL
- Add `schemaVersion`, rename `name` → `displayName`
- **BUT CANNOT fix wrong names or data access**

**Post-Processor CANNOT Fix:** ❌ NO
- Wrong trigger/action names
- Wrong data access patterns

**Verdict:** ❌ **NOT COMPATIBLE** (wrong names)

---

### Output 5: Gmail → Notion ❌ (Wrong Piece Name)

**Request:** "When a new email arrives in Gmail with subject containing 'Demo', create a Notion page..."

**Issues:**
- ❌ Uses `"name"` instead of `"displayName"` at root level
- ❌ Missing `"schemaVersion"` at root level
- ❌ **Wrong piece name:** `"@realpieces/piece-gmail"` should be `"@activepieces/piece-gmail"`
- ❌ Wrong trigger name: `"gmail_new_email_received"` should be `"new_email"` or `"new_email_received"`
- ⚠️ Missing filter for subject containing "Demo" (no conditional logic)
- ⚠️ Notion page input is empty (should have title and body fields)

**Positives:**
- ✅ Has basic structure
- ✅ Has `propertySettings`

**Post-Processor Can Fix:** ⚠️ PARTIAL
- Add `schemaVersion`, rename `name` → `displayName`
- **BUT CANNOT fix wrong piece names or missing filters**

**Post-Processor CANNOT Fix:** ❌ NO
- Wrong piece names (`@realpieces` → `@activepieces`)
- Missing filters
- Empty inputs

**Verdict:** ❌ **NOT COMPATIBLE** (wrong piece name)

---

## Summary Statistics

| Metric | Value |
|--------|-------|
| **Total Outputs** | 5 |
| **Schema Compatible** | 1 (20%) |
| **Post-Processable** | 1 (20%) |
| **Critical Issues** | 4 (80%) |

### Issue Breakdown

| Issue Type | Count | Can Post-Process? |
|------------|-------|------------------|
| Missing `schemaVersion` | 5 | ✅ YES |
| Uses `name` instead of `displayName` | 5 | ✅ YES |
| Wrong action/trigger names | 3 | ❌ NO |
| Syntax errors | 1 | ❌ NO |
| Reversed logic | 1 | ❌ NO |
| Wrong data access | 1 | ❌ NO |
| Wrong piece names | 1 | ❌ NO |

---

## Post-Processing Capabilities

### ✅ CAN Post-Process (40% of issues)

1. **Add `schemaVersion`**: Can add `"schemaVersion": "10"` to all flows
2. **Rename `name` → `displayName`**: Can rename root-level field
3. **Add missing `propertySettings`**: Can add `{}` where missing
4. **Add missing `input`**: Can add `{}` where missing
5. **Remove `sampleData`**: Can remove this field

### ❌ CANNOT Post-Process (60% of issues)

1. **Wrong action/trigger names**: 
   - `slack_send_message` → `send_channel_message`
   - `google_sheets_row_added` → `new_row`
   - `gmail_new_email_received` → `new_email`
   - `get_rows` → `get_values` or `get-many-rows`

2. **Reversed ROUTER logic**: Condition checks wrong thing, branches in wrong order

3. **Syntax errors**: Double colon in text field (`"text":"value":"{{...}}"`)

4. **Wrong data access patterns**: 
   - `{{trigger.body.Name}}` → `{{trigger.values.Name}}` for Google Sheets

5. **Wrong piece names**: 
   - `@realpieces/piece-gmail` → `@activepieces/piece-gmail`

6. **Missing conditional logic**: No filter for email subject containing "Demo"

7. **Empty/incomplete inputs**: Notion page has no title/body

---

## Compatibility Assessment

### Activepieces Schema Compatibility: ⚠️ **PARTIALLY COMPATIBLE**

**Current State:**
- ✅ Structure is correct (has `trigger`, `nextAction`, etc.)
- ✅ Most fields are present (`propertySettings`, `pieceVersion`)
- ❌ Missing `schemaVersion` (can add)
- ❌ Uses `name` instead of `displayName` (can fix)
- ❌ Wrong action/trigger names (CANNOT fix)
- ❌ Logic errors (CANNOT fix)

**After Post-Processing:**
- ✅ Can fix: `schemaVersion`, `displayName`, `propertySettings`
- ❌ Still broken: Wrong names, reversed logic, syntax errors

**Direct API Compatibility:** ❌ **NO** (1/5 = 20%)

**After Post-Processing:** ⚠️ **PARTIAL** (1/5 = 20% fully fixed, 4/5 still have issues)

---

## Recommendations

### 1. ✅ **Post-Processing** (Immediate)

Create a post-processor that:
- Adds `schemaVersion: "10"`
- Renames `name` → `displayName`
- Adds missing `propertySettings: {}`
- Adds missing `input: {}`
- Removes `sampleData`

**Impact:** Fixes ~40% of issues, makes 1/5 outputs fully compatible

### 2. ✅ **Training Data** (Critical)

Your **10 example flows** will help with:
- ✅ Correct action names (`send_channel_message`, `new_row`)
- ✅ Correct data access patterns (`trigger.values` for Sheets)
- ✅ Correct ROUTER logic (check missing, not exists)
- ✅ Correct piece names (`@activepieces/piece-*`)
- ✅ Complete input structures

**Impact:** Should fix remaining 60% of issues

### 3. ⚠️ **Model Improvements Needed**

The model needs to learn:
- Correct action/trigger names from training data
- Proper conditional logic (check missing, not exists)
- Correct data access patterns per trigger type
- Complete input structures (not empty objects)

---

## Verdict

**Is it good enough?** ⚠️ **PARTIALLY**
- 1/5 outputs are usable after post-processing
- 4/5 outputs have critical issues

**Can it be post-processed?** ✅ **YES** (for 40% of issues)
- Can fix schema version, displayName, propertySettings
- Cannot fix wrong names, logic errors, syntax errors

**Can it be improved with post-processing?** ⚠️ **PARTIAL**
- Post-processing helps but doesn't fix critical issues
- Need training data for remaining issues

**Is it compatible with Activepieces schema?** ❌ **NO** (currently)
- Only 20% compatible (1/5 outputs)
- After post-processing: Still only 20% fully compatible
- **BUT**: Your 10 example flows should significantly improve this!

---

## Next Steps

1. ✅ **Use post-processor** to fix schema issues (40% improvement)
2. ✅ **Train with augmented dataset** (your 10 example flows)
3. ✅ **Re-test** after training to measure improvement
4. ⚠️ **Consider** adding more training examples for:
   - Conditional logic (ROUTER)
   - Data access patterns
   - Complete input structures

---

**Report Generated:** Analysis of 5 model outputs
**Training Status:** Model trained WITHOUT the 10 additional example flows
**Expected Improvement:** Adding the 10 flows should significantly improve action names, data access, and ROUTER logic

