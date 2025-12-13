#!/usr/bin/env npx ts-node
/**
 * Demo: Show how the post-processor handles the malformed model output
 */

import {
  extractJsonCandidate,
  normalizeToImportFlowRequest,
  buildImportPayload,
} from './flowPostProcessor';

// This is the exact malformed output from the model
const MALFORMED_OUTPUT = `{

  "flows": [

    {

      "start": "step_1",

      "branches": [

        {

          "continue": "step_2",

          "branch": "step_3"

        },

        {

          "displayName": "Run Google Sheets",

          "type": "google-sheets",

          "firstRowHeaders": true,

          "skipEmptyRows": false,

          "input": {

            "auth": "{{connections['J62V0T6iQ43MxqQ3Za07i']}}",

            "sheetId": 0,

            "spreadsheetId": "__TODO_SPREADSHEET_ID__",

            "includeTeamDrives": false,

            "sheetName": "Leads",

            "throwErrorOnInvalidId": false,

            "useHeaderRow": true

          },

          "nextAction": "step_1",

          "displayName": "Run Google Sheets"

        }

      ],

      "displayName": "New Row Triggered",

      "type": "PIECE_TRIGGER",

      "property": {

        "auth": "{{connections['J62V0T6iQ43MxqQ3Za07i']}}",

        "sheetId": 0,

        "spreadsheetId": "__TODO_SPREADSHEET_ID__",

        "trigger_type": "add",

        "includeTeamDrives": false,

        "firstRowHeaders": true,

        "sheetName": "Leads",

        "throwErrorOnInvalidId": false,

        "useHeaderRow": true

      },

      "firstAction": {

        "continue": "step_3",

        "branch": "step_2"

      },

      "displayName": "New Row Triggered"

    },

    {

      "displayName": "Run Google Sheets",

      "type": "google-sheets",

      "firstRowHeaders": true,

      "skipEmptyRows": false,

      "input": {

        "auth": "{{connections['J62V0T6iQ43MxqQ3Za07i']}}",

        "sheetId": 0,

        "spreadsheetId": "__TODO_SPREADSHEET_ID__",

        "includeTeamDrives": false,

        "sheetName": "Leads",

        "throwErrorOnInvalidId": false,

        "useHeaderRow": true

      },

      "nextAction": "step_3",

      "displayName": "Run Google Sheets"

    },

    {

      "displayName": "Ask User for Slack Channel ID",

      "type": "PIECE_TRIGGER",

      "firstRowHeaders": false,

      "skipEmptyRows": false,

      "input": {

        "prompt": "Please provide the Slack channel ID"

      },

      "nextAction": "step_4",

      "displayName": "Ask User for Slack Channel ID"

    },

    {

`;  // Note: truncated here

console.log('='.repeat(70));
console.log('DEMO: Processing Malformed Model Output');
console.log('='.repeat(70));
console.log('');

console.log('ISSUES WITH INPUT:');
console.log('  1. Truncated (ends without closing braces)');
console.log('  2. Uses { flows: [...] } instead of proper ImportFlowRequest');
console.log('  3. Wrong schema (uses "start", "branches", "property", "firstAction")');
console.log('  4. Contains hallucinated connections: {{connections[\'J62V0T6iQ43MxqQ3Za07i\']}}');
console.log('  5. Uses "type": "google-sheets" instead of proper piece name');
console.log('');

try {
  console.log('STEP 1: Extract JSON (repair truncation)');
  console.log('-'.repeat(50));
  const jsonCandidate = extractJsonCandidate(MALFORMED_OUTPUT);
  console.log(`  ✓ Extracted JSON with keys: ${Object.keys(jsonCandidate as object).join(', ')}`);
  console.log('');

  console.log('STEP 2: Normalize to ImportFlowRequest');
  console.log('-'.repeat(50));
  const normalized = normalizeToImportFlowRequest(jsonCandidate);
  console.log(`  ✓ Display Name: ${normalized.displayName}`);
  console.log(`  ✓ Trigger Type: ${normalized.trigger.type}`);
  console.log(`  ✓ Trigger Name: ${normalized.trigger.name}`);
  console.log(`  ✓ Piece Name: ${(normalized.trigger.settings as Record<string, unknown>).pieceName}`);
  console.log('');

  console.log('STEP 3: Build & Sanitize Import Payload');
  console.log('-'.repeat(50));
  const payload = buildImportPayload(normalized);
  console.log(`  ✓ Payload type: ${payload.type}`);
  console.log(`  ✓ Schema version: ${payload.request.schemaVersion || '(null - use latest)'}`);
  
  // Check sanitization
  const settings = payload.request.trigger.settings as Record<string, unknown>;
  const input = settings.input as Record<string, unknown>;
  console.log(`  ✓ Auth sanitized: ${input?.auth === '__TODO_CONNECTION__' ? 'YES' : 'NO'}`);
  console.log('');

  console.log('FINAL PAYLOAD:');
  console.log('-'.repeat(50));
  console.log(JSON.stringify(payload, null, 2));
  console.log('');

  console.log('='.repeat(70));
  console.log('SUCCESS: Malformed output converted to valid import payload!');
  console.log('='.repeat(70));

} catch (error) {
  console.error('');
  console.error('ERROR:', (error as Error).message);
  process.exit(1);
}

