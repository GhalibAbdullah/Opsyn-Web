# Test Prompts for Fine-tuned Qwen Coder 7B Model

## Overview

These 5 test prompts are designed to evaluate your fine-tuned model's ability to generate Activepieces flows. They cover different complexity levels and features.

---

## Test Prompt 1: Simple Trigger-Action (Easy)

**Prompt:**
```
When a new row is added to Google Sheets 'Customer Orders', send a Slack message to #orders channel with the customer name and order total.
```

**Expected Features:**
- ✅ Google Sheets trigger (`new_row`)
- ✅ Slack action (`send_channel_message`)
- ✅ Data access (`trigger.values.Name`, `trigger.values.OrderTotal`)
- ✅ Channel specification (`#orders`)

**What to Check:**
- Correct trigger name (`new_row`)
- Correct action name (`send_channel_message`)
- Uses `trigger.values` (not `trigger.body`)
- Has `displayName`, `schemaVersion`
- Complete structure

---

## Test Prompt 2: Conditional Logic (ROUTER) (Medium)

**Prompt:**
```
When a webhook is received, if the 'status' field equals 'urgent', send an email alert to support@company.com, otherwise add the payload to Google Sheets 'Webhook Logs'.
```

**Expected Features:**
- ✅ Webhook trigger
- ✅ ROUTER with conditional logic
- ✅ Email action (for urgent)
- ✅ Google Sheets action (for non-urgent)
- ✅ Condition checking (`status == 'urgent'`)

**What to Check:**
- Correct ROUTER structure (`type: "ROUTER"`)
- Correct branch logic (check if `status` equals `urgent`)
- Children array matches branches
- Email in first branch (urgent), Sheets in second (fallback)
- Has `displayName`, `schemaVersion`

---

## Test Prompt 3: Schedule Multi-step (Medium)

**Prompt:**
```
Every Monday at 9 AM, get all rows from Google Sheets 'Weekly Tasks', use AI to generate a summary, and post it to Slack #weekly-updates channel.
```

**Expected Features:**
- ✅ Schedule trigger (`every_week` with day specification)
- ✅ Google Sheets action (`get_values` or `get-many-rows`)
- ✅ AI/Code action for summarization
- ✅ Slack action
- ✅ Multi-step chain

**What to Check:**
- Correct schedule trigger (`every_week`)
- Correct action names (`get_values` or `get-many-rows`, not `get_rows`)
- Multi-step chain structure
- Data flow between steps (`{{steps.step_1.output}}`)
- Has `displayName`, `schemaVersion`

---

## Test Prompt 4: Form Submission with Enrichment (Hard)

**Prompt:**
```
When a new Google Form response is submitted, check if the email domain is a business email (not gmail.com or yahoo.com), and if it is, send a Slack message to #sales with the form data.
```

**Expected Features:**
- ✅ Google Forms trigger (`new_response`)
- ✅ CODE action for email validation
- ✅ ROUTER with conditional logic
- ✅ Slack action
- ✅ Data access from form response

**What to Check:**
- Correct Forms trigger (`new_response`)
- CODE action with proper logic (check email domain)
- ROUTER checks if business email (not gmail/yahoo)
- Slack message in correct branch
- Uses form response data (`{{steps.trigger.email}}` or similar)
- Has `displayName`, `schemaVersion`

---

## Test Prompt 5: Email Processing (Hard)

**Prompt:**
```
When a new email arrives in Gmail with subject containing 'Invoice', extract the sender email and invoice amount, then create a row in Google Sheets 'Invoices' with the sender email, amount, and current date.
```

**Expected Features:**
- ✅ Gmail trigger (`new_email` or `new_email_received`)
- ✅ CODE action for data extraction
- ✅ Google Sheets action (`insert_row`)
- ✅ Date handling
- ✅ Subject filtering (conditional logic)

**What to Check:**
- Correct Gmail trigger name (`new_email`)
- CODE action extracts email and amount
- Sheets action inserts row with proper data
- Uses current date (may need date helper or CODE)
- Has `displayName`, `schemaVersion`

---

## Evaluation Criteria

For each output, check:

### ✅ Schema Compatibility (Required)
- [ ] Has `displayName` (not `name`)
- [ ] Has `schemaVersion: "10"` (or at least present)
- [ ] Has `trigger` with required fields
- [ ] Has `nextAction` structure
- [ ] All actions have `settings` with required fields
- [ ] Valid JSON (no syntax errors)

### ✅ Correct Names (Important)
- [ ] Correct trigger names (`new_row`, `new_email`, `every_week`, etc.)
- [ ] Correct action names (`send_channel_message`, `insert_row`, etc.)
- [ ] Correct piece names (`@activepieces/piece-*`)

### ✅ Data Access (Important)
- [ ] Uses `trigger.values` for Google Sheets (not `trigger.body`)
- [ ] Uses `trigger.body` for webhooks (correct)
- [ ] Uses proper step references (`{{steps.step_1.output}}`)

### ⚠️ Logic Correctness (Optional - Users can fix)
- [ ] ROUTER logic is correct (checks right condition)
- [ ] Branch order is correct
- [ ] Data flow is logical

---

## Usage Instructions

### System Prompt:
```
You are an AI Workflow Builder for OPSYN (Activepieces-based). Return ONLY valid Activepieces flow JSON.
```

### Format:
```
User request: {test_prompt}

Assistant: {model_output}
```

### Running Tests:

1. **Using Python:**
```python
import json

with open('test_prompts.json', 'r') as f:
    tests = json.load(f)

for test in tests['test_prompts']:
    prompt = test['prompt']
    # Run inference with your model
    output = model.generate(prompt, system_prompt=...)
    # Evaluate output
```

2. **Using Command Line:**
```bash
# Modify test_model.sh with your inference command
chmod +x test_model.sh
./test_model.sh <your_model_path>
```

---

## Expected Improvements from Training

After fine-tuning with the augmented dataset (including your 10 example flows), the model should:

1. ✅ Use correct action/trigger names (`send_channel_message`, `new_row`)
2. ✅ Use correct data access patterns (`trigger.values` for Sheets)
3. ✅ Generate complete `propertySettings`
4. ✅ Include `schemaVersion: "10"`
5. ✅ Use `displayName` (not `name`)
6. ✅ Generate valid JSON (no syntax errors)
7. ✅ Create proper ROUTER structures when needed

---

## Success Metrics

**Good Output:**
- ✅ Schema compatible (can be imported)
- ✅ Correct names (minimal user fixes needed)
- ✅ Proper structure (all fields present)

**Excellent Output:**
- ✅ All of the above
- ✅ Logic is correct (users don't need to fix)
- ✅ Complete inputs (not empty objects)

---

**Good luck with testing!** 🚀

