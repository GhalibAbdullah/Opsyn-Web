# Qwen Coder 7B Model Output Analysis

## Overview

**Status: ⚠️ PARTIALLY WORKING** - Model generates flows but has consistent schema issues

## Output-by-Output Analysis

### Output 1: Google Sheets → Slack
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

**Post-Processor Can Fix:** Missing `schemaVersion`, but NOT `name` → `displayName`

---

### Output 2: Webhook Conditional (ROUTER)
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

**Post-Processor Can Fix:** Missing `input`, missing `schemaVersion`, but NOT reversed logic

---

### Output 3: Schedule → Multi-step
**Request:** "Every day at 9am, read today's rows from Google Sheets 'Leads', summarize them, and post the summary to Slack #sales."

**Issues:**
- ❌ Uses `"name"` instead of `"displayName"` at root level
- ❌ Missing `"schemaVersion"` at root level
- ❌ **SYNTAX ERROR:** `"text":"Notification from Send Slack Message":"{{step_3.output.summary}}"` (double quotes issue)
- ⚠️ Has `"sampleData"` field (should be removed)
- ⚠️ Uses wrong action name `"get_rows"` (should be `"get_values"` or similar)
- ⚠️ Request says "today's rows" but flow gets "yesterday's rows" first

**Positives:**
- ✅ Has multi-step chain structure
- ✅ Has CODE action (correct type)
- ✅ Has `propertySettings`

**Post-Processor Can Fix:** Remove `sampleData`, add `schemaVersion`, but NOT syntax errors or wrong action names

---

### Output 4: Explicit Steps
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

**Post-Processor Can Fix:** Missing `schemaVersion`, but NOT wrong names or data access

---

### Output 5: Gmail → Notion
**Request:** "When a new email arrives in Gmail with subject containing 'Demo', create a Notion page..."

**Issues:**
- ❌ Uses `"name"` instead of `"displayName"` at root level
- ❌ Missing `"schemaVersion"` at root level
- ❌ Wrong trigger name: `"gmail_new_email_received"` should be `"new_email"` or `"new_email_received"`
- ⚠️ Missing filter for subject containing "Demo" (no conditional logic)
- ⚠️ Notion page input is empty (should have title and body fields)

**Positives:**
- ✅ Has basic structure
- ✅ Has `propertySettings`

**Post-Processor Can Fix:** Missing `schemaVersion`, but NOT missing filters or empty inputs

---

## Overall Assessment

### Critical Issues (Post-Processor CANNOT Fix)
1. **`"name"` vs `"displayName"`** - Appears in ALL 5 outputs (100%)
2. **Missing `"schemaVersion"`** - Appears in ALL 5 outputs (100%)
3. **Reversed conditional logic** - Output 2
4. **Wrong action/trigger names** - Outputs 4 & 5
5. **Wrong data access patterns** - Output 4 (`trigger.body` vs `trigger.values`)

### Issues Post-Processor CAN Fix
- ✅ Add missing `schemaVersion`
- ✅ Add missing `propertySettings`
- ✅ Remove `sampleData`
- ✅ Add missing `input: {}`

### Schema Compatibility
- **Direct Compatibility:** ~0% (all have `name` instead of `displayName`)
- **After Post-Processor:** ~60% (can fix `schemaVersion`, but NOT `name`)

---

## Will Adding Your 10 Workflows Help?

### ✅ YES - Will Help With:
1. **Correct action/trigger names** - Real workflows use correct names
2. **Correct data access patterns** - Real workflows show `trigger.values` vs `trigger.body`
3. **Real-world input structures** - Shows actual field names and structures
4. **Proper conditional logic** - Real workflows have correct ROUTER logic
5. **Complete workflows** - Shows all required fields populated

### ⚠️ BUT - Still Need To:
1. **Fix `name` vs `displayName`** - Your workflows likely use `displayName` (good!), but model needs more examples
2. **Ensure `schemaVersion`** - Make sure your workflows include this
3. **More conditional examples** - If your workflows have conditionals, they'll help

### Recommendation
**✅ YES, add your 10 workflows!** They'll provide:
- Real-world patterns the model is missing
- Correct naming conventions
- Proper data access
- Complete input structures

**However**, you may also want to:
- Add more examples that explicitly show `displayName` (not `name`)
- Ensure all examples have `schemaVersion`
- Consider fine-tuning on the corrected outputs

---

## Summary

**Current State:**
- Model understands flow structure ✅
- Model generates ROUTER conditionals ✅
- Model has consistent schema issues ❌
- Post-processor can fix ~60% of issues ⚠️

**With Your 10 Workflows:**
- Should improve action/trigger names ✅
- Should improve data access patterns ✅
- Should improve input structures ✅
- May still need more `displayName` examples ⚠️

**Verdict:** Model is **partially working** but needs more training data, especially your real workflows!

