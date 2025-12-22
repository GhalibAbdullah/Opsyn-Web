/**
 * OPSYN Unified Pipeline
 * 
 * Complete workflow generation pipeline:
 * 1. JSON extraction and validation
 * 2. Robust post-processing (fixes names, versions, schema)
 * 3. FlowTemplate conversion
 * 
 * This is the main entry point for processing AI model output.
 */

import { RobustFlowPostProcessor, Flow } from '../flows/flow-post-processor';

/**
 * System prompt for the AI model
 */
export const OPSYN_SYSTEM_PROMPT = (
  'You are an AI Workflow Builder for OPSYN (Activepieces-based). ' +
  'Return ONLY a valid JSON object with keys: displayName, trigger, schemaVersion. No extra text.'
);

/**
 * Extended system prompt with more guidance
 */
export const OPSYN_SYSTEM_PROMPT_EXTENDED = `You are an AI Workflow Builder for OPSYN (Activepieces-based).

CRITICAL RULES:
1. Return ONLY valid JSON with keys: displayName, trigger, schemaVersion
2. Include ALL steps mentioned in the instruction
3. For conditionals (if/then/else), use ROUTER action with branches
4. Always include: trigger.settings.pieceVersion, trigger.settings.propertySettings
5. Never include: inputUiInfo, pieceType, or other UI-only fields
6. triggerName goes INSIDE settings.triggerName, not at trigger level

Return ONLY the JSON object. No markdown, no extra text.`;

/**
 * FlowTemplate format for UI import
 */
export interface FlowTemplate {
  name: string;
  description: string;
  tags: string[];
  pieces: string[];
  template: Flow;
  blogUrl?: string;
}

/**
 * Extract JSON from raw text
 * Handles markdown code fences, truncated JSON, etc.
 */
function extractJsonFromRawText(raw: string): unknown {
  if (!raw || typeof raw !== 'string') {
    throw new Error('Input must be a non-empty string');
  }

  let cleaned = raw.trim();

  // Remove markdown code fences
  if (cleaned.includes('```json')) {
    const match = cleaned.match(/```json\s*([\s\S]*?)\s*```/);
    if (match) {
      cleaned = match[1].trim();
    }
  } else if (cleaned.includes('```')) {
    const match = cleaned.match(/```\s*([\s\S]*?)\s*```/);
    if (match) {
      cleaned = match[1].trim();
    }
  }

  // Find the first { and try to find matching }
  const firstBrace = cleaned.indexOf('{');
  if (firstBrace === -1) {
    throw new Error('No JSON object found in input (no opening brace)');
  }

  cleaned = cleaned.substring(firstBrace);

  // Try to find the last valid closing brace
  let lastBrace = cleaned.lastIndexOf('}');
  
  // If no closing brace, try to repair
  if (lastBrace === -1 || lastBrace < 0) {
    const repaired = repairTruncatedJson(cleaned);
    if (repaired) {
      try {
        return JSON.parse(repaired);
      } catch {
        throw new Error('Output appears truncated and could not be repaired');
      }
    }
    throw new Error('Output is truncated (no closing brace found)');
  }

  // Extract and parse
  const jsonStr = cleaned.substring(0, lastBrace + 1);

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    // Try progressively shorter substrings
    for (let i = lastBrace; i > 0; i--) {
      if (cleaned[i] === '}') {
        try {
          return JSON.parse(cleaned.substring(0, i + 1));
        } catch {
          continue;
        }
      }
    }
    
    // Try to repair
    const repaired = repairTruncatedJson(jsonStr);
    if (repaired) {
      try {
        return JSON.parse(repaired);
      } catch {
        // Fall through
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

/**
 * Extract all piece names from a flow
 */
function extractPieceNames(flow: Flow): string[] {
  const pieces = new Set<string>();

  function extract(obj: any) {
    if (!obj || typeof obj !== 'object') return;

    if (obj.settings?.pieceName) {
      pieces.add(obj.settings.pieceName);
    }

    if (obj.trigger) extract(obj.trigger);
    if (obj.nextAction) extract(obj.nextAction);
    if (obj.children) {
      obj.children.forEach((child: any) => extract(child));
    }
    if (obj.firstLoopAction) extract(obj.firstLoopAction);
  }

  extract(flow);
  return Array.from(pieces);
}

/**
 * Convert processed flow to FlowTemplate format
 */
function convertToFlowTemplate(processedFlow: Flow | { template: Flow }): FlowTemplate {
  const flow = 'template' in processedFlow ? processedFlow.template : processedFlow;

  return {
    name: flow.displayName || 'Untitled Flow',
    description: 'Flow generated from AI model output',
    tags: [],
    pieces: extractPieceNames(flow),
    template: flow,
    blogUrl: '',
  };
}

/**
 * Process raw AI model output into FlowTemplate JSON ready for UI import
 * 
 * @param rawModelOutput - Raw text output from AI model (may contain markdown, truncated JSON, etc.)
 * @param targetSchemaVersion - Target schema version (default: '10')
 * @param useEmbeddings - Whether to use embedding-based matching (default: true)
 * @returns FlowTemplate JSON string ready for file download
 */
export async function processModelOutputToFlowTemplate(
  rawModelOutput: string,
  targetSchemaVersion: string = '10',
  useEmbeddings: boolean = true
): Promise<string> {
  // Step 0: Extract and validate JSON
  const validated = extractJsonFromRawText(rawModelOutput);

  // Step 1: Robust post-processing
  const processor = new RobustFlowPostProcessor(targetSchemaVersion, useEmbeddings);
  const processed = await processor.process(validated as Flow);

  // Step 2: Convert to FlowTemplate format
  const template = convertToFlowTemplate(processed);

  return JSON.stringify(template, null, 2);
}

/**
 * Process model output and return FlowTemplate object (not stringified)
 * Useful for direct API responses
 */
export async function processModelOutputToFlowTemplateObject(
  rawModelOutput: string,
  targetSchemaVersion: string = '10',
  useEmbeddings: boolean = true
): Promise<FlowTemplate> {
  const jsonString = await processModelOutputToFlowTemplate(
    rawModelOutput,
    targetSchemaVersion,
    useEmbeddings
  );
  return JSON.parse(jsonString);
}

/**
 * Validate a FlowTemplate
 */
export function validateFlowTemplate(template: FlowTemplate): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!template.name) {
    errors.push("Missing 'name'");
  }

  if (!template.template) {
    errors.push("Missing 'template'");
  } else {
    const processor = new RobustFlowPostProcessor();
    const result = processor.validate(template.template);
    errors.push(...result.errors);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Generate the full prompt with system prompt
 */
export function generateFullPrompt(userPrompt: string, useExtendedPrompt: boolean = false): string {
  const systemPrompt = useExtendedPrompt ? OPSYN_SYSTEM_PROMPT_EXTENDED : OPSYN_SYSTEM_PROMPT;
  return `${systemPrompt}\n\nUser Request: ${userPrompt}`;
}

