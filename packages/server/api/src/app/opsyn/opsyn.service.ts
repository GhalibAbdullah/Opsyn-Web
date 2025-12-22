/**
 * OPSYN Service
 * 
 * Handles workflow generation from natural language prompts.
 */

import { FastifyBaseLogger } from 'fastify';
import {
  processModelOutputToFlowTemplate,
  FlowTemplate,
  OPSYN_SYSTEM_PROMPT,
  OPSYN_SYSTEM_PROMPT_EXTENDED,
  generateFullPrompt,
  validateFlowTemplate,
} from './opsyn-pipeline';
import { modelInferenceService } from './model-inference.service';

export interface GenerateWorkflowRequest {
  prompt: string;
  useExtendedPrompt?: boolean;
  maxTokens?: number;
  temperature?: number;
}

export interface GenerateWorkflowResult {
  success: boolean;
  template?: FlowTemplate;
  templateJson?: string;
  error?: string;
  validationErrors?: string[];
  modelUsed?: string;
  generationTimeMs?: number;
}

/**
 * OPSYN Service factory
 */
export const opsynService = (log: FastifyBaseLogger) => {
  const modelService = modelInferenceService(log);

  return {
    /**
     * Process raw model output through the pipeline
     * 
     * @param rawModelOutput - Raw output from AI model
     * @returns FlowTemplate ready for UI import
     */
    async processRawOutput(rawModelOutput: string): Promise<GenerateWorkflowResult> {
      try {
        log.info('[opsyn] Processing raw model output');

        // Process through pipeline
        const templateJson = await processModelOutputToFlowTemplate(rawModelOutput);
        const template = JSON.parse(templateJson) as FlowTemplate;

        // Validate
        const validation = validateFlowTemplate(template);
        
        if (!validation.isValid) {
          log.warn({ errors: validation.errors }, '[opsyn] Flow has validation warnings');
        }

        log.info({ 
          flowName: template.name, 
          pieces: template.pieces 
        }, '[opsyn] Successfully processed flow');

        return {
          success: true,
          template,
          templateJson,
          validationErrors: validation.errors.length > 0 ? validation.errors : undefined,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log.error({ error: errorMessage }, '[opsyn] Failed to process model output');
        
        return {
          success: false,
          error: errorMessage,
        };
      }
    },

    /**
     * Get the system prompt for the AI model
     */
    getSystemPrompt(extended: boolean = false): string {
      return extended ? OPSYN_SYSTEM_PROMPT_EXTENDED : OPSYN_SYSTEM_PROMPT;
    },

    /**
     * Generate the full prompt (system + user)
     */
    generatePrompt(userPrompt: string, extended: boolean = false): string {
      return generateFullPrompt(userPrompt, extended);
    },

    /**
     * Check if model service is available
     */
    async isModelAvailable(): Promise<boolean> {
      return modelService.isAvailable();
    },

    /**
     * Get model configuration
     */
    getModelConfig() {
      return modelService.getConfig();
    },

    /**
     * Generate workflow from prompt using the AI model
     * 
     * The Python model server handles the complete pipeline:
     * 1. Model inference with system prompt
     * 2. JSON validation and extraction
     * 3. Robust post-processing (fix versions, names, fields)
     * 4. FlowTemplate conversion
     */
    async generateFromPrompt(request: GenerateWorkflowRequest): Promise<GenerateWorkflowResult> {
      try {
        log.info({ prompt: request.prompt.substring(0, 100) }, '[opsyn] Generating workflow from prompt');

        // Check if model is available
        const available = await modelService.isAvailable();
        if (!available) {
          return {
            success: false,
            error: 'Model service is not available. Please check OPSYN_MODEL_URL and ensure the model server is running.',
          };
        }

        // Generate workflow (Python server handles everything including post-processing)
        const result = await modelService.generateWorkflow({
          userPrompt: request.prompt,
          maxTokens: request.maxTokens,
          temperature: request.temperature,
        });

        if (!result.success || !result.template) {
          return {
            success: false,
            error: result.error || 'Model generation failed',
          };
        }

        // Cast template from Record<string, unknown> to FlowTemplate
        const template = result.template as unknown as FlowTemplate;
        
        log.info({ 
          generationTimeMs: result.generationTimeMs,
          postProcessingTimeMs: result.postProcessingTimeMs,
          flowName: template?.name,
        }, '[opsyn] Workflow generated successfully');

        return {
          success: true,
          template: template,
          templateJson: result.templateJson,
          modelUsed: result.modelUsed,
          generationTimeMs: result.generationTimeMs,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log.error({ error: errorMessage }, '[opsyn] Failed to generate from prompt');
        
        return {
          success: false,
          error: errorMessage,
        };
      }
    },
  };
};

export type OpsynService = ReturnType<typeof opsynService>;

