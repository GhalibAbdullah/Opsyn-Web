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
  
  // Types
  ImportFlowRequest,
  FlowTrigger,
  FlowAction,
  ImportPayload,
  ImportResult,
} from './flowPostProcessor';

