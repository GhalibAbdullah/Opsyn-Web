# Training Recommendations for Flow Generation Model

## Assessment Summary

**Current Model Status:** ⚠️ **Partially Working** - Outputs are salvageable but need improvement

### ✅ What's Working
- Basic structure is correct (has `displayName`, `trigger`, `nextAction`)
- Correct piece names (`@activepieces/piece-slack`, etc.)
- Nested `nextAction` structure is correct
- Post-processor can fix most schema issues

### ❌ Critical Problems
1. **Missing conditional logic** - No ROUTER actions when requested
2. **Missing steps** - Incomplete workflows (missing Slack, Sheets, etc.)
3. **Schema issues** - `triggerName` at wrong level, missing `propertySettings`/`pieceVersion`
4. **UI-only fields** - Includes `inputUiInfo`, `pieceType` (should be removed)

## Recommendations

### 1. ✅ YES - Augment Training Set

**Priority 1: Add Conditional Logic Examples**

The model completely fails at generating ROUTER actions for conditionals. Add examples like:

- "If X then Y else Z" patterns
- "When X, if condition then A else B" patterns
- Multiple condition examples (AND/OR logic)

**Priority 2: Add Complete Workflow Examples**

The model often generates incomplete workflows. Add examples that:
- Show ALL steps mentioned in the instruction
- Include proper step chaining
- Show multi-step workflows (3+ steps)

**Priority 3: Fix Schema Examples**

Add examples that show:
- Correct placement of `triggerName` (inside `settings.triggerName`)
- Always include `propertySettings: {}`
- Always include `pieceVersion`
- Never include `inputUiInfo` or `pieceType`

### 2. ✅ YES - Post-Processor Can Fix Most Issues

The post-processor already handles:
- ✅ Adding missing `propertySettings: {}`
- ✅ Adding missing `pieceVersion`
- ✅ Removing `inputUiInfo` and `pieceType`
- ✅ Moving `triggerName` to correct location
- ✅ Sanitizing secrets

**But it CANNOT:**
- ❌ Add missing steps (Slack, Sheets, etc.)
- ❌ Add conditional logic (ROUTER)

### 3. 📊 Training Set Augmentation Strategy

#### A. Add Conditional Examples (High Priority)

Use the generated examples in `conditional_training_examples.json` which include:
- Webhook with email check → Slack or Sheets
- Google Sheets with score check → Email or Slack
- Complete multi-step workflows

#### B. Review Existing Training Set

Check `opsyn_alpaca_merged_v5_system.json` for:
- How many examples have ROUTER actions?
- How many examples are incomplete?
- How many have schema issues?

#### C. Add Schema Validation Examples

Create examples that explicitly show:
```json
{
  "displayName": "...",
  "trigger": {
    "name": "trigger",
    "type": "PIECE_TRIGGER",
    "valid": true,
    "displayName": "...",
    "settings": {
      "pieceName": "@activepieces/piece-xxx",
      "pieceVersion": "~1.0.0",  // ← Always include
      "triggerName": "xxx",       // ← Inside settings
      "input": {...},
      "propertySettings": {}      // ← Always include
    }
  },
  "schemaVersion": null
}
```

### 4. 🎯 Specific Issues to Address

#### Issue 1: Missing Conditional Logic

**Problem:** Model doesn't generate ROUTER actions when conditionals are requested.

**Solution:** Add 20-30 examples with ROUTER actions showing:
- Simple if/else patterns
- Multiple conditions
- Nested conditionals

#### Issue 2: Incomplete Workflows

**Problem:** Model generates partial workflows, missing steps.

**Solution:** 
- Add examples where instruction explicitly lists all steps
- Show step-by-step breakdown in examples
- Emphasize "complete all steps mentioned"

#### Issue 3: Schema Structure

**Problem:** `triggerName` at wrong level, missing required fields.

**Solution:**
- Add examples with correct schema structure
- Show what NOT to include (UI fields)
- Emphasize required fields in system prompt

### 5. 📝 Updated System Prompt Recommendation

Current system prompt:
```
"You are an AI Workflow Builder for OPSYN (Activepieces-based). Return ONLY a valid JSON object with keys: displayName, trigger, schemaVersion. No extra text."
```

**Enhanced system prompt:**
```
"You are an AI Workflow Builder for OPSYN (Activepieces-based). 

CRITICAL RULES:
1. Return ONLY valid JSON with keys: displayName, trigger, schemaVersion
2. Include ALL steps mentioned in the instruction
3. For conditionals (if/then/else), use ROUTER action with branches
4. Always include: trigger.settings.pieceVersion, trigger.settings.propertySettings
5. Never include: inputUiInfo, pieceType, or other UI-only fields
6. triggerName goes INSIDE settings.triggerName, not at trigger level

Return ONLY the JSON object. No markdown, no extra text."
```

### 6. ✅ Action Items

- [ ] Add conditional logic examples to training set
- [ ] Add complete workflow examples (all steps)
- [ ] Add schema validation examples
- [ ] Update system prompt with explicit rules
- [ ] Test post-processor on new examples
- [ ] Retrain model with augmented dataset

## Conclusion

**The outputs ARE salvageable** with the post-processor, but the model needs better training on:
1. Conditional logic (ROUTER actions) - **CRITICAL**
2. Complete workflows (all steps) - **HIGH PRIORITY**
3. Correct schema structure - **MEDIUM PRIORITY** (post-processor can fix most)

**Recommendation:** Augment training set with conditional examples and retrain. The post-processor will handle the rest.

