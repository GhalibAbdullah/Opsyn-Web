# OPSYN Flow Post-Processor

A robust post-processor for handling malformed AI model outputs and converting them into valid Activepieces flow import payloads.

## Overview

When training AI models to generate Activepieces flows, the model output often has issues:
- **Truncated JSON** (model ran out of tokens)
- **Wrong structure** (e.g., `{ flows: [...] }` instead of proper `ImportFlowRequest`)
- **Wrong schema** (uses non-existent fields like `start`, `branches`, `property`)
- **Hallucinated credentials** (fake connection IDs, tokens)
- **Missing required fields**

This module handles all these cases and produces valid import payloads.

## Installation

The module requires:
- Node.js 18+
- TypeScript
- axios

```bash
npm install axios
```

## Usage

### Option 1: Generate FlowTemplate for UI Import (No API Key Needed!)

**This is the recommended approach if you don't have API access:**

```bash
# Generate FlowTemplate JSON file
npx ts-node scripts/import_from_model_output.ts --generate-template model_output.txt flow_template.json
```

Then import in the Activepieces UI:
1. Open Activepieces UI
2. Click **"New Flow"** → **"From local file"**
3. Select the generated `flow_template.json` file
4. Click **"Import"**

The UI will create the flow and you can configure it there!

### Option 2: Import via API (Requires API Key)

```bash
# Run sanity tests
npx ts-node scripts/import_from_model_output.ts --test

# Dry run (parse without importing)
npx ts-node scripts/import_from_model_output.ts --dry-run model_output.txt

# Import a flow to a project
AP_API_KEY=sk_xxx npx ts-node scripts/import_from_model_output.ts <projectId> model_output.txt

# With custom API URL
AP_BASE_URL=https://app.activepieces.com/api/v1 AP_API_KEY=sk_xxx \
  npx ts-node scripts/import_from_model_output.ts <projectId> model_output.txt
```

### Programmatic Usage

```typescript
import {
  extractJsonCandidate,
  normalizeToImportFlowRequest,
  buildImportPayload,
  importFlowToProject,
} from './src/opsyn';

// Full pipeline
const result = await importFlowToProject('projectId', rawModelOutput);
console.log(`Created flow: ${result.flowId}`);

// Step-by-step
const json = extractJsonCandidate(rawModelOutput);
const normalized = normalizeToImportFlowRequest(json);
const payload = buildImportPayload(normalized);
```

## Features

### 1. JSON Extraction (`extractJsonCandidate`)

Handles:
- Leading/trailing non-JSON text
- Markdown code fences (```json)
- **Truncated output** - repairs incomplete JSON by balancing braces

```typescript
// Truncated input
const raw = '{"key": "value", "nested": {"a": 1';
const result = extractJsonCandidate(raw);
// Result: { key: "value", nested: { a: 1 } }
```

### 2. Normalization (`normalizeToImportFlowRequest`)

Handles multiple input formats:

```typescript
// Direct ImportFlowRequest
{ displayName, trigger, schemaVersion }

// IMPORT_FLOW wrapper
{ type: "IMPORT_FLOW", request: { displayName, trigger, schemaVersion } }

// Hallucinated flows array
{ flows: [...] }

// Malformed objects with 'property' instead of 'settings'
{ type: "PIECE_TRIGGER", property: {...} }
```

Infers piece names from context:
- `spreadsheetId` in settings → `@activepieces/piece-google-sheets`
- `channel` in settings → `@activepieces/piece-slack`
- `type: "slack"` → `@activepieces/piece-slack`

### 3. Sanitization (`sanitizeImportRequest`)

**Removes secrets:**
- Connection references: `{{connections['...']}}` → `__TODO_CONNECTION__`
- Slack tokens: `xoxb-*`, `xoxp-*`, `xoxa-*` → `__TODO_CONNECTION__`
- Any field named `auth`, `token`, `apiKey`, `secret`, `password`

**Sanitizes IDs:**
- Slack channel IDs: `C0123456789` → `__TODO_CHANNEL_ID__` (unless it's `#channel`)
- Spreadsheet IDs: Long alphanumeric strings → `__TODO_SPREADSHEET_ID__`

**Removes UI-only fields:**
- `inputUiInfo`
- `sampleDataUiInfo`
- `propertySettingsInfo`
- `sampleData`

**Sets schema version to null** (uses latest)

### 4. Import (`importFlowToProject`)

1. Creates empty flow via `POST /flows`
2. Imports structure via `POST /flows/:id` with `IMPORT_FLOW` operation
3. Returns `{ flowId, displayName }`

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AP_BASE_URL` | Activepieces API URL | `http://localhost:4200/api/v1` |
| `AP_API_KEY` | API key for authentication | Required |

## Example: Handling Malformed Model Output

Given this malformed model output:

```json
{
  "flows": [
    {
      "displayName": "New Row Triggered",
      "type": "PIECE_TRIGGER",
      "property": {
        "auth": "{{connections['J62V0T6iQ43MxqQ3Za07i']}}",
        "spreadsheetId": "__TODO_SPREADSHEET_ID__",
        "sheetName": "Leads"
      }
    }
  ]
}
```

The post-processor produces:

```json
{
  "type": "IMPORT_FLOW",
  "request": {
    "displayName": "New Row Triggered",
    "trigger": {
      "name": "trigger",
      "type": "PIECE_TRIGGER",
      "valid": false,
      "displayName": "New Row Triggered",
      "settings": {
        "pieceName": "@activepieces/piece-google-sheets",
        "pieceVersion": "~1.0.0",
        "triggerName": "new_row",
        "input": {
          "auth": "__TODO_CONNECTION__",
          "spreadsheetId": "__TODO_SPREADSHEET_ID__",
          "sheetName": "Leads"
        },
        "propertySettings": {}
      }
    },
    "schemaVersion": null
  }
}
```

## Testing

```bash
# Run sanity tests (built-in)
npx ts-node scripts/import_from_model_output.ts --test

# Run demo
npx ts-node src/opsyn/demo.ts
```

## Files

```
src/opsyn/
├── flowPostProcessor.ts    # Main module
├── flowPostProcessor.test.ts # Unit tests
├── demo.ts                 # Demo script
├── index.ts                # Exports
├── tsconfig.json           # TypeScript config
└── README.md               # This file

scripts/
└── import_from_model_output.ts  # CLI script
```

## Error Handling

The module throws descriptive errors:
- `"No JSON object found in input"`
- `"Output is truncated (no closing brace found)"`
- `"Empty flows array"`
- `"Unable to normalize input: expected {...}"`

## Notes

- The post-processor prioritizes **robustness over perfection**
- When piece names can't be inferred, it defaults to `@activepieces/piece-http`
- The `valid` field is set to `false` since the flow needs user configuration
- After import, users should configure connections and verify the flow structure in the UI

