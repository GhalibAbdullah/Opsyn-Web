/**
 * Unified Pipeline: Complete workflow generation pipeline
 * 
 * Combines all 3 steps:
 * 1. JSON validation and extraction
 * 2. Robust post-processing (fixes names, versions, schema)
 * 3. FlowTemplate conversion
 * 
 * Ready for backend integration.
 */

import { extractJsonCandidate } from './flowPostProcessor';
// Import from relative path - adjust based on where this is used
// If used from backend API: import { RobustFlowPostProcessor } from '../flows/flow-post-processor';
// If used from root: import { RobustFlowPostProcessor } from '../../packages/server/api/src/app/flows/flow-post-processor';
import { RobustFlowPostProcessor } from '../../packages/server/api/src/app/flows/flow-post-processor';

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
  // Step 0: Validate and extract JSON
  const validated = extractJsonCandidate(rawModelOutput);
  
  // Step 1: Robust post-processing
  const processor = new RobustFlowPostProcessor(targetSchemaVersion, useEmbeddings);
  const processed = await processor.process(validated);
  
  // Step 2: Convert to FlowTemplate format
  const template = convertToFlowTemplate(processed);
  
  return JSON.stringify(template, null, 2);
}

/**
 * Convert processed flow to FlowTemplate format
 */
function convertToFlowTemplate(processedFlow: any): any {
  // Handle both raw flow and FlowTemplate input
  const flow = 'template' in processedFlow ? processedFlow.template : processedFlow;
  
  // Extract pieces
  const pieces = new Set<string>();
  
  function extractPieces(obj: any) {
    if (!obj || typeof obj !== 'object') return;
    
    if (obj.settings?.pieceName) {
      pieces.add(obj.settings.pieceName);
    }
    
    if (obj.trigger) extractPieces(obj.trigger);
    if (obj.nextAction) extractPieces(obj.nextAction);
    if (obj.children) {
      obj.children.forEach((child: any) => extractPieces(child));
    }
    if (obj.firstLoopAction) extractPieces(obj.firstLoopAction);
  }
  
  extractPieces(flow);
  
  return {
    name: flow.displayName || 'Untitled Flow',
    description: 'Flow generated from AI model output',
    tags: [],
    pieces: Array.from(pieces),
    template: flow,
    blogUrl: '',
  };
}

/**
 * Process model output and return FlowTemplate object (not stringified)
 * Useful for direct API responses
 */
export async function processModelOutputToFlowTemplateObject(
  rawModelOutput: string,
  targetSchemaVersion: string = '10',
  useEmbeddings: boolean = true
): Promise<any> {
  const jsonString = await processModelOutputToFlowTemplate(
    rawModelOutput,
    targetSchemaVersion,
    useEmbeddings
  );
  return JSON.parse(jsonString);
}

