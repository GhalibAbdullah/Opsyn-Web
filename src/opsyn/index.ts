/**
 * OPSYN Flow Post-Processor Module
 * 
 * Handles conversion of malformed model outputs into valid Activepieces flows.
 */

export {
  // Main functions
  extractJsonCandidate,
  normalizeToImportFlowRequest,
  sanitizeImportRequest,
  buildImportPayload,
  importFlowToProject,
  runSanityTests,
  generateFlowTemplateFile,
  
  // Types
  ImportFlowRequest,
  FlowTrigger,
  FlowAction,
  ImportPayload,
  ImportResult,
} from './flowPostProcessor';

// Unified pipeline (for backend integration)
export {
  processModelOutputToFlowTemplate,
  processModelOutputToFlowTemplateObject,
} from './unifiedPipeline';

