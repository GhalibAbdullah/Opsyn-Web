/**
 * Flow Post-Processor for Model Output
 * 
 * Handles malformed, truncated, or incorrectly structured model outputs
 * and converts them into valid Activepieces ImportFlowRequest payloads.
 */

import axios from 'axios';

// Environment configuration
const AP_BASE_URL = process.env.AP_BASE_URL || 'http://localhost:4200/api/v1';
const AP_API_KEY = process.env.AP_API_KEY || '';

// ============================================================================
// Types
// ============================================================================

export interface ImportFlowRequest {
  displayName: string;
  trigger: FlowTrigger;
  schemaVersion: string | null;
}

export interface FlowTrigger {
  name: string;
  type: 'EMPTY' | 'PIECE_TRIGGER';
  valid: boolean;
  displayName: string;
  settings: Record<string, unknown>;
  nextAction?: FlowAction;
}

export interface FlowAction {
  name: string;
  type: 'PIECE' | 'CODE' | 'LOOP_ON_ITEMS' | 'ROUTER';
  valid: boolean;
  displayName: string;
  settings: Record<string, unknown>;
  skip?: boolean;
  nextAction?: FlowAction;
  firstLoopAction?: FlowAction;
  children?: (FlowAction | null)[];
}

export interface ImportPayload {
  type: 'IMPORT_FLOW';
  request: ImportFlowRequest;
}

export interface ImportResult {
  flowId: string;
  displayName: string;
}

// ============================================================================
// JSON Extraction
// ============================================================================

/**
 * Extract the largest JSON object from raw text.
 * Handles:
 * - Leading/trailing non-JSON text
 * - Code fences (```json)
 * - Truncated output
 */
export function extractJsonCandidate(raw: string): unknown {
  if (!raw || typeof raw !== 'string') {
    throw new Error('Input must be a non-empty string');
  }

  let cleaned = raw.trim();

  // Remove markdown code fences
  cleaned = cleaned.replace(/```json\s*/gi, '');
  cleaned = cleaned.replace(/```\s*/g, '');

  // Find the first { and try to find matching }
  const firstBrace = cleaned.indexOf('{');
  if (firstBrace === -1) {
    throw new Error('No JSON object found in input (no opening brace)');
  }

  // Try to find the last valid closing brace
  let lastBrace = cleaned.lastIndexOf('}');
  
  // If no closing brace, the output is truncated
  if (lastBrace === -1 || lastBrace < firstBrace) {
    // Try to repair truncated JSON by adding closing braces
    const truncatedJson = cleaned.substring(firstBrace);
    const repaired = repairTruncatedJson(truncatedJson);
    if (repaired) {
      try {
        return JSON.parse(repaired);
      } catch {
        throw new Error('Output appears truncated and could not be repaired');
      }
    }
    throw new Error('Output is truncated (no closing brace found)');
  }

  // Extract the JSON substring
  const jsonStr = cleaned.substring(firstBrace, lastBrace + 1);

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    // Try progressively shorter substrings (in case of trailing garbage)
    for (let i = lastBrace; i > firstBrace; i--) {
      if (cleaned[i] === '}') {
        try {
          return JSON.parse(cleaned.substring(firstBrace, i + 1));
        } catch {
          continue;
        }
      }
    }
    
    // Try to repair common issues
    const repaired = repairTruncatedJson(jsonStr);
    if (repaired) {
      try {
        return JSON.parse(repaired);
      } catch {
        // Fall through to error
      }
    }

    throw new Error(`Invalid JSON: ${(e as Error).message}`);
  }
}

/**
 * Attempt to repair truncated JSON by balancing braces and brackets
 */
function repairTruncatedJson(json: string): string | null {
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escaped = false;

  for (const char of json) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === '{') openBraces++;
    if (char === '}') openBraces--;
    if (char === '[') openBrackets++;
    if (char === ']') openBrackets--;
  }

  // If we're in a string, close it
  let repaired = json;
  if (inString) {
    repaired += '"';
  }

  // Remove trailing comma if present
  repaired = repaired.replace(/,\s*$/, '');

  // Close open brackets and braces
  for (let i = 0; i < openBrackets; i++) {
    repaired += ']';
  }
  for (let i = 0; i < openBraces; i++) {
    repaired += '}';
  }

  return repaired;
}

// ============================================================================
// Normalization
// ============================================================================

/**
 * Normalize various input formats into a valid ImportFlowRequest
 */
export function normalizeToImportFlowRequest(obj: unknown): ImportFlowRequest {
  if (!obj || typeof obj !== 'object') {
    throw new Error('Input must be an object');
  }

  const data = obj as Record<string, unknown>;

  // Case 1: Already in IMPORT_FLOW format
  if (data.type === 'IMPORT_FLOW' && data.request) {
    const request = data.request as Record<string, unknown>;
    return normalizeToImportFlowRequest(request);
  }

  // Case 2: Direct ImportFlowRequest format
  if (data.displayName && data.trigger && typeof data.trigger === 'object') {
    return {
      displayName: String(data.displayName),
      trigger: normalizeTrigger(data.trigger as Record<string, unknown>),
      schemaVersion: data.schemaVersion ? String(data.schemaVersion) : null,
    };
  }

  // Case 3: { flows: [...] } hallucination
  if (Array.isArray(data.flows)) {
    return normalizeFlowsArray(data.flows);
  }

  // Case 4: Array at root level
  if (Array.isArray(obj)) {
    return normalizeFlowsArray(obj);
  }

  // Case 5: Single flow object without proper structure
  if (data.trigger || data.type || data.displayName) {
    return buildFlowFromMalformedObject(data);
  }

  throw new Error(
    'Unable to normalize input: expected { displayName, trigger, schemaVersion } or { flows: [...] } or { type: "IMPORT_FLOW", request: {...} }'
  );
}

/**
 * Normalize a { flows: [...] } structure
 */
function normalizeFlowsArray(flows: unknown[]): ImportFlowRequest {
  if (flows.length === 0) {
    throw new Error('Empty flows array');
  }

  // Find the best candidate (prefer one with PIECE_TRIGGER type)
  let bestCandidate: Record<string, unknown> | null = null;
  let triggerCandidate: Record<string, unknown> | null = null;
  const actionCandidates: Record<string, unknown>[] = [];

  for (const flow of flows) {
    if (typeof flow !== 'object' || flow === null) continue;
    const f = flow as Record<string, unknown>;
    const flowType = String(f.type || '').toLowerCase();
    const displayName = String(f.displayName || '').toLowerCase();
    
    // Look for a trigger-like entry
    if (f.type === 'PIECE_TRIGGER' || f.type === 'EMPTY') {
      // Prefer the first PIECE_TRIGGER that looks like a real trigger (not asking for user input)
      if (!triggerCandidate && !displayName.includes('ask user')) {
        triggerCandidate = f;
      }
    }
    
    // Look for action-like entries (not triggers)
    const isActionLike = 
      f.type === 'PIECE' || 
      f.type === 'CODE' ||
      flowType.includes('slack') ||
      flowType.includes('sheets') ||
      flowType.includes('http') ||
      flowType.includes('gmail') ||
      flowType.includes('discord') ||
      displayName.includes('send') ||
      displayName.includes('post') ||
      displayName.includes('message');
    
    // Don't add as action if it's the trigger candidate
    if (isActionLike && f !== triggerCandidate && f.type !== 'PIECE_TRIGGER') {
      actionCandidates.push(f);
    }
    
    // Look for something with displayName
    if (f.displayName && !bestCandidate) {
      bestCandidate = f;
    }
  }

  // Build flow from trigger + actions
  const flowSource = triggerCandidate || bestCandidate || (flows[0] as Record<string, unknown>);
  const result = buildFlowFromMalformedObject(flowSource);

  // Try to attach action candidates as a chain (dedupe first)
  const uniqueActions = dedupeActionCandidates(actionCandidates);
  if (uniqueActions.length > 0 && !result.trigger.nextAction) {
    const actionChain = buildActionChainFromCandidates(uniqueActions);
    if (actionChain) {
      result.trigger.nextAction = actionChain;
    }
  }

  return result;
}

/**
 * Remove duplicate action candidates
 */
function dedupeActionCandidates(candidates: Record<string, unknown>[]): Record<string, unknown>[] {
  const seen = new Set<string>();
  return candidates.filter(c => {
    // Create a key from displayName + type
    const key = `${c.displayName || ''}-${c.type || ''}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Build an action chain from multiple candidate objects
 */
function buildActionChainFromCandidates(candidates: Record<string, unknown>[]): FlowAction | undefined {
  if (candidates.length === 0) return undefined;

  const actions: FlowAction[] = [];
  for (let i = 0; i < candidates.length; i++) {
    const action = normalizeAction(candidates[i], `step_${i + 1}`);
    actions.push(action);
  }

  // Chain them together
  for (let i = 0; i < actions.length - 1; i++) {
    actions[i].nextAction = actions[i + 1];
  }

  return actions[0];
}

/**
 * Build a valid flow from a malformed object
 */
function buildFlowFromMalformedObject(obj: Record<string, unknown>): ImportFlowRequest {
  // Extract display name
  const displayName = extractDisplayName(obj);

  // Build trigger
  const trigger = buildTriggerFromObject(obj);

  return {
    displayName,
    trigger,
    schemaVersion: null,
  };
}

/**
 * Extract a display name from various possible fields
 */
/**
 * Extract display name from object, always returns a non-empty string
 * REQUIRED: All triggers and actions must have a displayName
 */
function extractDisplayName(obj: Record<string, unknown>): string {
  if (typeof obj.displayName === 'string' && obj.displayName.trim()) {
    return obj.displayName.trim();
  }
  if (typeof obj.name === 'string' && obj.name.trim()) {
    return obj.name.trim();
  }
  if (typeof obj.title === 'string' && obj.title.trim()) {
    return obj.title.trim();
  }
  // Always return a non-empty fallback
  return 'Generated Flow';
}

/**
 * Build a trigger from a potentially malformed object
 */
function buildTriggerFromObject(obj: Record<string, unknown>): FlowTrigger {
  // If it looks like a proper trigger already
  if (obj.type === 'PIECE_TRIGGER' || obj.type === 'EMPTY') {
    return normalizeTrigger(obj);
  }

  // Check for nested trigger
  if (obj.trigger && typeof obj.trigger === 'object') {
    return normalizeTrigger(obj.trigger as Record<string, unknown>);
  }

  // Try to infer trigger from 'property' or 'input' fields (common hallucination)
  const settings = extractSettings(obj);
  const pieceName = inferPieceName(obj, settings);

  // Merge input from multiple possible sources
  const inputFromSettings = (settings.input as Record<string, unknown>) || {};
  const inputFromProperty = (obj.property as Record<string, unknown>) || {};
  const inputFromObj = (obj.input as Record<string, unknown>) || {};
  
  // The 'property' field in hallucinated outputs often contains what should be 'input'
  // Filter out non-input keys from property
  const propertyAsInput: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(inputFromProperty)) {
    // Skip meta fields that aren't actual inputs
    if (!['trigger_type', 'type', 'displayName', 'name'].includes(key)) {
      propertyAsInput[key] = value;
    }
  }
  
  // Combine inputs, preferring more specific sources
  const combinedInput = {
    ...propertyAsInput,
    ...inputFromObj,
    ...inputFromSettings,
  };

  // Build a minimal trigger - ensure all required fields are set
  const triggerDisplayName = extractDisplayName(obj) || 'Trigger';
  
  const trigger: FlowTrigger = {
    name: 'trigger',
    type: pieceName ? 'PIECE_TRIGGER' : 'EMPTY',
    valid: false, // REQUIRED: Always set valid (false if unknown)
    displayName: triggerDisplayName, // REQUIRED: Always set displayName
    settings: pieceName
      ? {
          pieceName, // REQUIRED
          pieceVersion: '~1.0.0', // REQUIRED: Always set pieceVersion
          triggerName: inferTriggerName(obj),
          input: combinedInput,
          propertySettings: {}, // REQUIRED: Always set propertySettings (even if empty)
        }
      : {},
  };

  // Try to build action chain from various fields
  const nextAction = buildActionChain(obj);
  if (nextAction) {
    trigger.nextAction = nextAction;
  }

  return trigger;
}

/**
 * Extract settings from various possible field names
 */
function extractSettings(obj: Record<string, unknown>): Record<string, unknown> {
  if (obj.settings && typeof obj.settings === 'object') {
    return obj.settings as Record<string, unknown>;
  }
  if (obj.property && typeof obj.property === 'object') {
    return obj.property as Record<string, unknown>;
  }
  if (obj.input && typeof obj.input === 'object') {
    return { input: obj.input };
  }
  return {};
}

/**
 * Infer piece name from object structure
 */
function inferPieceName(obj: Record<string, unknown>, settings: Record<string, unknown>): string | null {
  // Direct pieceName
  if (typeof obj.pieceName === 'string') return obj.pieceName;
  if (typeof settings.pieceName === 'string') return settings.pieceName;

  const input = (settings.input as Record<string, unknown>) || {};

  // Infer from type field
  const type = String(obj.type || '').toLowerCase();
  if (type.includes('google-sheets') || type.includes('sheets') || type.includes('spreadsheet')) {
    return '@activepieces/piece-google-sheets';
  }
  if (type.includes('slack') || type.includes('channel')) {
    return '@activepieces/piece-slack';
  }
  if (type.includes('gmail') || type.includes('email') || type.includes('mail')) {
    return '@activepieces/piece-gmail';
  }
  if (type.includes('schedule') || type.includes('cron') || type.includes('timer')) {
    return '@activepieces/piece-schedule';
  }
  if (type.includes('webhook') || type.includes('http-trigger')) {
    return '@activepieces/piece-webhook';
  }
  if (type.includes('http') || type.includes('api') || type.includes('request')) {
    return '@activepieces/piece-http';
  }
  if (type.includes('discord')) {
    return '@activepieces/piece-discord';
  }
  if (type.includes('openai') || type.includes('gpt') || type.includes('chatgpt')) {
    return '@activepieces/piece-openai';
  }

  // Check for spreadsheetId in settings (Google Sheets indicator)
  if (settings.spreadsheetId || input.spreadsheetId || settings.sheetId || input.sheetId) {
    return '@activepieces/piece-google-sheets';
  }

  // Check for channel in settings (Slack indicator)
  if (settings.channel || input.channel || settings.channel_id || input.channel_id) {
    return '@activepieces/piece-slack';
  }

  // Check displayName for hints
  const displayName = String(obj.displayName || '').toLowerCase();
  if (displayName.includes('slack') || displayName.includes('channel')) {
    return '@activepieces/piece-slack';
  }
  if (displayName.includes('sheet') || displayName.includes('spreadsheet') || displayName.includes('google')) {
    return '@activepieces/piece-google-sheets';
  }

  return null;
}

/**
 * Infer trigger name from object
 */
function inferTriggerName(obj: Record<string, unknown>): string {
  if (typeof obj.triggerName === 'string') return obj.triggerName;
  
  const settings = extractSettings(obj);
  if (typeof settings.triggerName === 'string') return settings.triggerName;
  if (typeof settings.trigger_type === 'string') {
    // Map common trigger types
    if (settings.trigger_type === 'add') return 'new_row';
    if (settings.trigger_type === 'update') return 'updated_row';
    if (settings.trigger_type === 'delete') return 'deleted_row';
  }

  // Default based on inferred piece
  const pieceName = inferPieceName(obj, settings);
  if (pieceName?.includes('google-sheets')) return 'new_row';
  if (pieceName?.includes('schedule')) return 'every_day';
  if (pieceName?.includes('webhook')) return 'webhook';
  if (pieceName?.includes('gmail')) return 'new_email';
  if (pieceName?.includes('slack')) return 'new_message';

  return 'trigger';
}

/**
 * Infer action name from object
 */
function inferActionName(obj: Record<string, unknown>): string {
  if (typeof obj.actionName === 'string') return obj.actionName;
  
  const settings = extractSettings(obj);
  if (typeof settings.actionName === 'string') return settings.actionName;

  // Default based on inferred piece
  const pieceName = inferPieceName(obj, settings);
  
  // Check displayName for hints
  const displayName = String(obj.displayName || '').toLowerCase();
  
  if (pieceName?.includes('slack')) {
    if (displayName.includes('send') || displayName.includes('post') || displayName.includes('message')) {
      return 'send_channel_message';
    }
    return 'send_channel_message';
  }
  if (pieceName?.includes('google-sheets')) {
    if (displayName.includes('read') || displayName.includes('get')) return 'read_rows';
    if (displayName.includes('write') || displayName.includes('insert') || displayName.includes('add')) return 'insert_row';
    if (displayName.includes('update')) return 'update_row';
    return 'read_rows';
  }
  if (pieceName?.includes('gmail')) {
    if (displayName.includes('send')) return 'send_email';
    return 'send_email';
  }
  if (pieceName?.includes('http')) {
    return 'send_request';
  }
  if (pieceName?.includes('discord')) {
    return 'send_channel_message';
  }

  return 'action';
}

/**
 * Try to build an action chain from various fields
 */
function buildActionChain(obj: Record<string, unknown>): FlowAction | undefined {
  // Check for nextAction field
  if (obj.nextAction && typeof obj.nextAction === 'object') {
    return normalizeAction(obj.nextAction as Record<string, unknown>, 'step_1');
  }

  // Check for firstAction field (hallucination)
  if (obj.firstAction && typeof obj.firstAction === 'object') {
    return normalizeAction(obj.firstAction as Record<string, unknown>, 'step_1');
  }

  // Check for branches array
  if (Array.isArray(obj.branches)) {
    const actions: FlowAction[] = [];
    for (const branch of obj.branches) {
      if (typeof branch === 'object' && branch !== null) {
        const action = normalizeAction(branch as Record<string, unknown>, `step_${actions.length + 1}`);
        if (action) actions.push(action);
      }
    }
    if (actions.length > 0) {
      // Chain them together
      for (let i = 0; i < actions.length - 1; i++) {
        actions[i].nextAction = actions[i + 1];
      }
      return actions[0];
    }
  }

  return undefined;
}

/**
 * Normalize a trigger object
 */
function normalizeTrigger(obj: Record<string, unknown>): FlowTrigger {
  const settings = obj.settings as Record<string, unknown> || extractSettings(obj);
  const triggerType = obj.type === 'EMPTY' ? 'EMPTY' : 'PIECE_TRIGGER';

  // Extract input from multiple possible sources (property is a common hallucination)
  const inputFromSettings = (settings.input as Record<string, unknown>) || {};
  const inputFromProperty = (obj.property as Record<string, unknown>) || {};
  const inputFromObj = (obj.input as Record<string, unknown>) || {};
  
  // The 'property' field in hallucinated outputs often contains what should be 'input'
  const propertyAsInput: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(inputFromProperty)) {
    // Skip meta fields that aren't actual inputs
    if (!['trigger_type', 'type', 'displayName', 'name'].includes(key)) {
      propertyAsInput[key] = value;
    }
  }
  
  const combinedInput = {
    ...propertyAsInput,
    ...inputFromObj,
    ...inputFromSettings,
  };

  const pieceName = settings.pieceName || inferPieceName(obj, settings) || '@activepieces/piece-webhook';

  // Ensure all required fields are always set
  const triggerDisplayName = extractDisplayName(obj) || 'Trigger';
  const triggerValid = typeof obj.valid === 'boolean' ? obj.valid : false;
  
  const trigger: FlowTrigger = {
    name: typeof obj.name === 'string' ? obj.name : 'trigger',
    type: triggerType,
    valid: triggerValid,
    displayName: triggerDisplayName,
    settings: triggerType === 'PIECE_TRIGGER'
      ? {
          pieceName,
          pieceVersion: settings.pieceVersion || '~1.0.0',
          triggerName: settings.triggerName || inferTriggerName(obj),
          input: Object.keys(combinedInput).length > 0 ? combinedInput : {},
          propertySettings: {}, // REQUIRED: Always set propertySettings (even if empty)
        }
      : {},
  };

  // Handle nextAction
  if (obj.nextAction && typeof obj.nextAction === 'object') {
    trigger.nextAction = normalizeAction(obj.nextAction as Record<string, unknown>, 'step_1');
  } else {
    const chain = buildActionChain(obj);
    if (chain) trigger.nextAction = chain;
  }

  return trigger;
}

/**
 * Normalize an action object
 */
function normalizeAction(obj: Record<string, unknown>, defaultName: string): FlowAction {
  const settings = obj.settings as Record<string, unknown> || extractSettings(obj);
  
  // Determine action type
  let actionType: FlowAction['type'] = 'PIECE';
  if (obj.type === 'CODE') actionType = 'CODE';
  else if (obj.type === 'LOOP_ON_ITEMS') actionType = 'LOOP_ON_ITEMS';
  else if (obj.type === 'ROUTER') actionType = 'ROUTER';

  const pieceName = settings.pieceName || inferPieceName(obj, settings) || '@activepieces/piece-http';
  const actionName = settings.actionName || inferActionName(obj);

  const action: FlowAction = {
    name: typeof obj.name === 'string' ? obj.name : defaultName,
    type: actionType,
    valid: typeof obj.valid === 'boolean' ? obj.valid : false,
    displayName: extractDisplayName(obj) || defaultName,
    settings: actionType === 'PIECE'
      ? {
          pieceName,
          pieceVersion: settings.pieceVersion || '~1.0.0',
          actionName,
          input: settings.input || obj.input || {},
          propertySettings: {},
        }
      : settings,
  };

  if (obj.skip !== undefined) {
    action.skip = Boolean(obj.skip);
  }

  // Handle nextAction recursively
  if (obj.nextAction && typeof obj.nextAction === 'object') {
    const nextNum = parseInt(defaultName.replace('step_', '')) + 1;
    action.nextAction = normalizeAction(obj.nextAction as Record<string, unknown>, `step_${nextNum}`);
  }

  // Handle loop action
  if (obj.firstLoopAction && typeof obj.firstLoopAction === 'object') {
    action.firstLoopAction = normalizeAction(obj.firstLoopAction as Record<string, unknown>, 'loop_step_1');
  }

  // Handle router children
  if (Array.isArray(obj.children)) {
    action.children = obj.children.map((child, i) =>
      child ? normalizeAction(child as Record<string, unknown>, `branch_${i}_step_1`) : null
    );
  }

  return action;
}

// ============================================================================
// Sanitization
// ============================================================================

/**
 * Sanitize the import request by removing secrets and hallucinated values
 */
export function sanitizeImportRequest(req: ImportFlowRequest): ImportFlowRequest {
  return JSON.parse(JSON.stringify(req, (key, value) => {
    // Remove UI-only keys
    const uiKeys = ['inputUiInfo', 'sampleDataUiInfo', 'propertySettingsInfo', 'propertySettings', 'sampleData'];
    if (uiKeys.includes(key)) {
      return key === 'propertySettings' ? {} : undefined;
    }

    // Handle string values
    if (typeof value === 'string') {
      return sanitizeStringValue(key, value);
    }

    return value;
  }));
}

/**
 * Sanitize a string value based on its key and content
 */
function sanitizeStringValue(key: string, value: string): string {
  const lowerKey = key.toLowerCase();

  // Check for sensitive key names
  const sensitiveKeys = ['auth', 'token', 'apikey', 'api_key', 'secret', 'password', 'credential', 'bearer'];
  if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
    return '__TODO_CONNECTION__';
  }

  // Check for connection references
  if (/\{\{connections\[['"]?[^'"}\]]+['"]?\]\}\}/.test(value)) {
    return '__TODO_CONNECTION__';
  }

  // Check for Slack tokens (xoxb-, xoxp-, xoxa-)
  if (/xox[bpa]-[\w-]+/.test(value)) {
    return '__TODO_CONNECTION__';
  }

  // Check for Slack channel IDs (but allow #channel names)
  if (/^C[A-Z0-9]{8,}$/.test(value) && !value.startsWith('#')) {
    return '__TODO_CHANNEL_ID__';
  }

  // Check for Google Sheets IDs (long alphanumeric strings that look like IDs)
  if (lowerKey.includes('spreadsheet') && /^[a-zA-Z0-9_-]{20,}$/.test(value)) {
    return '__TODO_SPREADSHEET_ID__';
  }
  if (lowerKey.includes('sheet') && lowerKey.includes('id') && /^[0-9]{5,}$/.test(value)) {
    return '__TODO_SHEET_ID__';
  }

  return value;
}

// ============================================================================
// Payload Building
// ============================================================================

/**
 * Build the final import payload
 */
export function buildImportPayload(req: ImportFlowRequest): ImportPayload {
  // Ensure schemaVersion is null (use latest)
  const sanitized = sanitizeImportRequest({
    ...req,
    schemaVersion: null,
  });

  return {
    type: 'IMPORT_FLOW',
    request: sanitized,
  };
}

// ============================================================================
// API Integration
// ============================================================================

/**
 * Create axios instance for API calls
 */
function createApiClient() {
  return axios.create({
    baseURL: AP_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AP_API_KEY}`,
    },
  });
}

/**
 * Import a flow to a project from raw model output
 */
export async function importFlowToProject(
  projectId: string,
  rawModelOutput: string
): Promise<ImportResult> {
  const api = createApiClient();

  console.log('[flowPostProcessor] Extracting JSON from raw output...');
  const jsonCandidate = extractJsonCandidate(rawModelOutput);
  console.log('[flowPostProcessor] JSON extracted successfully');

  console.log('[flowPostProcessor] Normalizing to ImportFlowRequest...');
  const normalized = normalizeToImportFlowRequest(jsonCandidate);
  console.log(`[flowPostProcessor] Normalized: displayName="${normalized.displayName}"`);

  console.log('[flowPostProcessor] Building import payload...');
  const payload = buildImportPayload(normalized);
  console.log('[flowPostProcessor] Payload built successfully');

  // Step 1: Create empty flow
  console.log(`[flowPostProcessor] Creating empty flow in project ${projectId}...`);
  const createResponse = await api.post('/flows', {
    displayName: payload.request.displayName,
    projectId,
  });
  const flowId = createResponse.data.id;
  console.log(`[flowPostProcessor] Empty flow created: ${flowId}`);

  // Step 2: Import flow structure
  console.log('[flowPostProcessor] Importing flow structure...');
  await api.post(`/flows/${flowId}`, payload);
  console.log('[flowPostProcessor] Flow structure imported successfully');

  return {
    flowId,
    displayName: payload.request.displayName,
  };
}

// ============================================================================
// Testing Utilities
// ============================================================================

/**
 * Run basic sanity tests
 */
export function runSanityTests(): void {
  console.log('Running sanity tests...\n');

  // Test 1: JSON Extraction
  console.log('Test 1: JSON Extraction');
  try {
    const raw1 = 'Some text before {"key": "value"} and after';
    const result1 = extractJsonCandidate(raw1);
    console.assert(JSON.stringify(result1) === '{"key":"value"}', 'Basic extraction failed');
    console.log('  ✓ Basic extraction');

    const raw2 = '```json\n{"test": true}\n```';
    const result2 = extractJsonCandidate(raw2);
    console.assert((result2 as Record<string, unknown>).test === true, 'Code fence extraction failed');
    console.log('  ✓ Code fence extraction');

    const raw3 = '{"incomplete": "json';
    const result3 = extractJsonCandidate(raw3);
    console.assert((result3 as Record<string, unknown>).incomplete === 'json', 'Truncation repair failed');
    console.log('  ✓ Truncation repair');
  } catch (e) {
    console.log('  ✗ Extraction test failed:', (e as Error).message);
  }

  // Test 2: Sanitization
  console.log('\nTest 2: Sanitization');
  try {
    const testReq: ImportFlowRequest = {
      displayName: 'Test',
      trigger: {
        name: 'trigger',
        type: 'PIECE_TRIGGER',
        valid: true,
        displayName: 'Test Trigger',
        settings: {
          pieceName: '@activepieces/piece-slack',
          pieceVersion: '~1.0.0',
          input: {
            auth: "{{connections['abc123']}}",
            channel: 'C0123456789',
            token: 'xoxb-secret-token',
          },
          inputUiInfo: { customizedInputs: {} },
        },
      },
      schemaVersion: '6',
    };

    const sanitized = sanitizeImportRequest(testReq);
    const settings = sanitized.trigger.settings as Record<string, unknown>;
    const input = settings.input as Record<string, unknown>;

    console.assert(input.auth === '__TODO_CONNECTION__', 'Connection not sanitized');
    console.log('  ✓ Connection sanitization');

    console.assert(input.channel === '__TODO_CHANNEL_ID__', 'Channel ID not sanitized');
    console.log('  ✓ Channel ID sanitization');

    console.assert(input.token === '__TODO_CONNECTION__', 'Token not sanitized');
    console.log('  ✓ Token sanitization');

    console.assert(!('inputUiInfo' in settings), 'UI fields not removed');
    console.log('  ✓ UI field removal');

    console.assert(sanitized.schemaVersion === '6', 'Schema version changed unexpectedly');
    console.log('  ✓ Schema version preserved');
  } catch (e) {
    console.log('  ✗ Sanitization test failed:', (e as Error).message);
  }

  // Test 3: Normalization
  console.log('\nTest 3: Normalization');
  try {
    // Test flows array
    const flowsObj = {
      flows: [
        {
          displayName: 'Test Flow',
          type: 'PIECE_TRIGGER',
          property: {
            spreadsheetId: 'abc123',
          },
        },
      ],
    };
    const normalized = normalizeToImportFlowRequest(flowsObj);
    console.assert(normalized.displayName === 'Test Flow', 'Display name not extracted');
    console.log('  ✓ Flows array normalization');

    // Test IMPORT_FLOW wrapper
    const wrapped = {
      type: 'IMPORT_FLOW',
      request: {
        displayName: 'Wrapped Flow',
        trigger: {
          name: 'trigger',
          type: 'PIECE_TRIGGER',
          valid: true,
          displayName: 'Trigger',
          settings: {},
        },
        schemaVersion: null,
      },
    };
    const unwrapped = normalizeToImportFlowRequest(wrapped);
    console.assert(unwrapped.displayName === 'Wrapped Flow', 'IMPORT_FLOW unwrapping failed');
    console.log('  ✓ IMPORT_FLOW unwrapping');
  } catch (e) {
    console.log('  ✗ Normalization test failed:', (e as Error).message);
  }

  console.log('\nSanity tests completed.');
}

/**
 * Convert ImportFlowRequest to FlowTemplate format for UI import
 * 
 * The Activepieces UI accepts FlowTemplate JSON files for import.
 * This function converts our ImportFlowRequest to that format.
 */
export function convertToFlowTemplate(req: ImportFlowRequest): Record<string, unknown> {
  return {
    name: req.displayName,
    description: '',
    tags: [],
    pieces: extractPieceNames(req.trigger),
    template: {
      displayName: req.displayName,
      trigger: req.trigger,
      valid: req.trigger.valid,
      schemaVersion: req.schemaVersion,
      connectionIds: [],
      agentIds: [],
    },
    schemaVersion: req.schemaVersion,
  };
}

/**
 * Extract all piece names from a flow (trigger + actions)
 */
function extractPieceNames(trigger: FlowTrigger): string[] {
  const pieces = new Set<string>();
  
  if (trigger.type === 'PIECE_TRIGGER') {
    const pieceName = (trigger.settings as Record<string, unknown>).pieceName;
    if (typeof pieceName === 'string') {
      pieces.add(pieceName);
    }
  }
  
  // Recursively extract from actions
  const extractFromAction = (action: FlowAction | undefined) => {
    if (!action) return;
    
    if (action.type === 'PIECE') {
      const pieceName = (action.settings as Record<string, unknown>).pieceName;
      if (typeof pieceName === 'string') {
        pieces.add(pieceName);
      }
    }
    
    if (action.nextAction) extractFromAction(action.nextAction);
    if (action.firstLoopAction) extractFromAction(action.firstLoopAction);
    if (action.children) {
      action.children.forEach(child => {
        if (child) extractFromAction(child);
      });
    }
  };
  
  extractFromAction(trigger.nextAction);
  
  return Array.from(pieces);
}

/**
 * Generate a FlowTemplate JSON file content from raw model output
 * This can be saved to a .json file and imported via the UI
 */
export function generateFlowTemplateFile(rawModelOutput: string): string {
  const jsonCandidate = extractJsonCandidate(rawModelOutput);
  const normalized = normalizeToImportFlowRequest(jsonCandidate);
  const sanitized = sanitizeImportRequest(normalized);
  const template = convertToFlowTemplate(sanitized);
  
  return JSON.stringify(template, null, 2);
}

// Export for testing
export const __testing = {
  repairTruncatedJson,
  sanitizeStringValue,
  extractSettings,
  inferPieceName,
  inferTriggerName,
  extractPieceNames,
};

