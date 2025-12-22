/**
 * OPSYN Model Inference Service
 * 
 * Handles communication with the Qwen model for workflow generation.
 * The Python model server handles:
 * - Model inference
 * - JSON validation
 * - Robust post-processing
 * - FlowTemplate conversion
 */

import axios, { AxiosInstance } from 'axios';
import { FastifyBaseLogger } from 'fastify';

// Environment configuration - URL is hardcoded for the hosted service
const OPSYN_MODEL_URL = process.env.OPSYN_MODEL_URL || 'https://zohhazhar13--opsyn-model-server-v2-fastapi-app.modal.run';
const OPSYN_MODEL_NAME = process.env.OPSYN_MODEL_NAME || 'opsyn-qwen';

export interface ModelInferenceRequest {
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ModelInferenceResult {
  success: boolean;
  template?: Record<string, unknown>;
  templateJson?: string;
  error?: string;
  modelUsed?: string;
  generationTimeMs?: number;
  postProcessingTimeMs?: number;
}

/**
 * Model Inference Service Factory
 * 
 * Calls the Python model server which handles:
 * - Model inference with system prompt
 * - JSON validation and extraction
 * - Robust post-processing (fix versions, names, fields)
 * - FlowTemplate conversion
 */
export const modelInferenceService = (log: FastifyBaseLogger) => {
  const client: AxiosInstance = axios.create({
    timeout: 180000, // 3 minutes timeout for model inference + post-processing
    baseURL: OPSYN_MODEL_URL,
  });

  return {
    /**
     * Check if model service is available
     * Note: We skip the actual health check to avoid unnecessary Modal cold starts
     * The model will be checked when actually generating a workflow
     */
    async isAvailable(): Promise<boolean> {
      // Always return true - actual availability will be checked during generation
      // This avoids costly health check requests that spin up Modal containers
      return true;
    },

    /**
     * Get model configuration
     */
    getConfig() {
      return {
        backend: 'local',
        url: OPSYN_MODEL_URL,
        model: OPSYN_MODEL_NAME,
      };
    },

    /**
     * Generate workflow from user prompt
     * 
     * Calls the Python server's /generate-workflow endpoint which:
     * 1. Generates raw JSON from model with system prompt
     * 2. Validates and extracts JSON
     * 3. Post-processes (fixes versions, names, fields)
     * 4. Converts to FlowTemplate
     */
    async generateWorkflow(request: ModelInferenceRequest): Promise<ModelInferenceResult> {
      try {
        log.info({ prompt: request.userPrompt.substring(0, 100) }, '[model] Generating workflow');

        const response = await client.post('/generate-workflow', {
          prompt: request.userPrompt,
          max_tokens: request.maxTokens || 2048,
          temperature: request.temperature || 0.7,
        });

        const data = response.data;

        if (!data.success) {
          log.error({ error: data.error }, '[model] Generation failed');
          return {
            success: false,
            error: data.error,
          };
        }

        log.info({
          generationTimeMs: data.generation_time_ms,
          postProcessingTimeMs: data.post_processing_time_ms,
        }, '[model] Workflow generated successfully');

        return {
          success: true,
          template: data.template,
          templateJson: data.template_json,
          modelUsed: data.model,
          generationTimeMs: data.generation_time_ms,
          postProcessingTimeMs: data.post_processing_time_ms,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log.error({ error: errorMessage }, '[model] Generation failed');
        
        return {
          success: false,
          error: errorMessage,
        };
      }
    },

    /**
     * Post-process raw model output (for external generation)
     */
    async processRawOutput(rawOutput: string): Promise<ModelInferenceResult> {
      try {
        const response = await client.post('/process', rawOutput, {
          headers: { 'Content-Type': 'text/plain' },
        });

        const data = response.data;

        if (!data.success) {
          return {
            success: false,
            error: data.error,
          };
        }

        return {
          success: true,
          template: data.template,
          templateJson: data.template_json,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          error: errorMessage,
        };
      }
    },
  };
};

export type ModelInferenceService = ReturnType<typeof modelInferenceService>;

