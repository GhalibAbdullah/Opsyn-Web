/**
 * Flow Post-Processor: TypeScript port of robust_post_processor.py
 * 
 * This module provides robust post-processing for AI-generated Activepieces flow JSON.
 * It fixes schema issues, normalizes names, and ensures compatibility.
 */

export { EmbeddingMatcher, getEmbeddingMatcher } from './embedding-matcher';
export { NameMatcher } from './name-matcher';
export { RobustFlowPostProcessor, Flow, Trigger, Action, Settings } from './robust-flow-post-processor';

