/**
 * OPSYN Controller
 * 
 * API endpoints for workflow generation.
 */

import { FastifyPluginAsyncTypebox, Type } from '@fastify/type-provider-typebox';
import { StatusCodes } from 'http-status-codes';
import { PrincipalType } from '@activepieces/shared';
import { opsynService } from './opsyn.service';

/**
 * OPSYN API Controller
 */
export const opsynController: FastifyPluginAsyncTypebox = async (app) => {
  /**
   * Process raw model output and return FlowTemplate JSON as downloadable file
   */
  app.post('/process', ProcessRawOutputRequest, async (request, reply) => {
    const { rawOutput, filename } = request.body;
    
    const result = await opsynService(request.log).processRawOutput(rawOutput);
    
    if (!result.success) {
      return reply.status(StatusCodes.BAD_REQUEST).send({
        success: false,
        error: result.error,
      });
    }

    const downloadFilename = filename || `workflow-${Date.now()}.json`;
    
    return reply
      .header('Content-Disposition', `attachment; filename="${downloadFilename}"`)
      .type('application/json')
      .status(StatusCodes.OK)
      .send(result.templateJson);
  });

  /**
   * Process raw model output and return FlowTemplate as JSON response (not download)
   */
  app.post('/process-json', ProcessRawOutputRequest, async (request, reply) => {
    const { rawOutput } = request.body;
    
    const result = await opsynService(request.log).processRawOutput(rawOutput);
    
    if (!result.success) {
      return reply.status(StatusCodes.BAD_REQUEST).send({
        success: false,
        error: result.error,
      });
    }

    return reply.status(StatusCodes.OK).send({
      success: true,
      template: result.template,
      validationErrors: result.validationErrors,
    });
  });

  /**
   * Get the system prompt
   */
  app.get('/system-prompt', SystemPromptRequest, async (request, reply) => {
    const extended = request.query.extended === 'true';
    const systemPrompt = opsynService(request.log).getSystemPrompt(extended);
    
    return reply.status(StatusCodes.OK).send({
      systemPrompt,
      extended,
    });
  });

  /**
   * Generate full prompt (system + user)
   */
  app.post('/generate-prompt', GeneratePromptRequest, async (request, reply) => {
    const { userPrompt, extended } = request.body;
    const fullPrompt = opsynService(request.log).generatePrompt(userPrompt, extended);
    
    return reply.status(StatusCodes.OK).send({
      fullPrompt,
    });
  });

  /**
   * Generate workflow from prompt using AI model
   */
  app.post('/generate', GenerateWorkflowRequest, async (request, reply) => {
    const result = await opsynService(request.log).generateFromPrompt({
      prompt: request.body.prompt,
      useExtendedPrompt: request.body.useExtendedPrompt,
      maxTokens: request.body.maxTokens,
      temperature: request.body.temperature,
    });
    
    if (!result.success) {
      return reply.status(StatusCodes.BAD_REQUEST).send({
        success: false,
        error: result.error,
      });
    }

    // If download requested, return as file
    if (request.body.download) {
      const downloadFilename = request.body.filename || `workflow-${Date.now()}.json`;
      
      return reply
        .header('Content-Disposition', `attachment; filename="${downloadFilename}"`)
        .type('application/json')
        .status(StatusCodes.OK)
        .send(result.templateJson);
    }

    // Otherwise return JSON response
    return reply.status(StatusCodes.OK).send({
      success: true,
      template: result.template,
      validationErrors: result.validationErrors,
      modelUsed: result.modelUsed,
      generationTimeMs: result.generationTimeMs,
    });
  });

  /**
   * Check model service status
   */
  app.get('/model-status', ModelStatusRequest, async (request, reply) => {
    const service = opsynService(request.log);
    const available = await service.isModelAvailable();
    const config = service.getModelConfig();
    
    return reply.status(StatusCodes.OK).send({
      available,
      config: {
        backend: config.backend,
        url: config.url,
        model: config.model,
      },
    });
  });
};

// Request schemas
const ProcessRawOutputRequest = {
  config: {
    allowedPrincipals: [PrincipalType.USER, PrincipalType.SERVICE] as const,
  },
  schema: {
    tags: ['opsyn'],
    description: 'Process raw AI model output and return FlowTemplate JSON',
    body: Type.Object({
      rawOutput: Type.String({
        description: 'Raw output from AI model (JSON or text containing JSON)',
      }),
      filename: Type.Optional(Type.String({
        description: 'Filename for the download (default: workflow-{timestamp}.json)',
      })),
    }),
  },
};

const SystemPromptRequest = {
  config: {
    allowedPrincipals: [PrincipalType.USER, PrincipalType.SERVICE] as const,
  },
  schema: {
    tags: ['opsyn'],
    description: 'Get the system prompt for the AI model',
    querystring: Type.Object({
      extended: Type.Optional(Type.String({
        description: 'Whether to use extended system prompt',
      })),
    }),
  },
};

const GeneratePromptRequest = {
  config: {
    allowedPrincipals: [PrincipalType.USER, PrincipalType.SERVICE] as const,
  },
  schema: {
    tags: ['opsyn'],
    description: 'Generate full prompt (system + user)',
    body: Type.Object({
      userPrompt: Type.String({
        description: 'User prompt describing the workflow to create',
      }),
      extended: Type.Optional(Type.Boolean({
        description: 'Whether to use extended system prompt',
      })),
    }),
  },
};

const GenerateWorkflowRequest = {
  config: {
    allowedPrincipals: [PrincipalType.USER, PrincipalType.SERVICE] as const,
  },
  schema: {
    tags: ['opsyn'],
    description: 'Generate workflow from natural language prompt using AI model',
    body: Type.Object({
      prompt: Type.String({
        description: 'Natural language prompt describing the workflow',
      }),
      useExtendedPrompt: Type.Optional(Type.Boolean({
        description: 'Whether to use extended system prompt',
      })),
      maxTokens: Type.Optional(Type.Number({
        description: 'Maximum tokens to generate (default: 2048)',
      })),
      temperature: Type.Optional(Type.Number({
        description: 'Temperature for generation (default: 0.7)',
      })),
      download: Type.Optional(Type.Boolean({
        description: 'Whether to return as downloadable file',
      })),
      filename: Type.Optional(Type.String({
        description: 'Filename for the download',
      })),
    }),
  },
};

const ModelStatusRequest = {
  config: {
    allowedPrincipals: [PrincipalType.USER, PrincipalType.SERVICE] as const,
  },
  schema: {
    tags: ['opsyn'],
    description: 'Check AI model service status',
  },
};

