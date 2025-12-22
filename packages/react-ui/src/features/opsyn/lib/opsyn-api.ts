/**
 * OPSYN API Client
 * 
 * Handles communication with the OPSYN backend for workflow generation.
 */

import { api } from '@/lib/api';

export interface GenerateWorkflowRequest {
  prompt: string;
  useExtendedPrompt?: boolean;
  maxTokens?: number;
  temperature?: number;
  download?: boolean;
  filename?: string;
}

export interface GenerateWorkflowResponse {
  success: boolean;
  template?: {
    name: string;
    description: string;
    tags: string[];
    pieces: string[];
    template: unknown;
  };
  validationErrors?: string[];
  modelUsed?: string;
  generationTimeMs?: number;
  error?: string;
}

export interface ProcessRawOutputRequest {
  rawOutput: string;
  filename?: string;
}

export interface ModelStatusResponse {
  available: boolean;
  config: {
    backend: string;
    url: string;
    model: string;
  };
}

export interface SystemPromptResponse {
  systemPrompt: string;
  extended: boolean;
}

export const opsynApi = {
  /**
   * Generate workflow from natural language prompt
   */
  async generate(request: GenerateWorkflowRequest): Promise<GenerateWorkflowResponse> {
    return api.post<GenerateWorkflowResponse>('/v1/opsyn/generate', request);
  },

  /**
   * Generate workflow and download as file
   */
  async generateAndDownload(request: GenerateWorkflowRequest): Promise<Blob> {
    const response = await fetch(`${window.location.origin}/api/v1/opsyn/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({
        ...request,
        download: true,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate workflow');
    }

    return response.blob();
  },

  /**
   * Process raw model output
   */
  async processRawOutput(request: ProcessRawOutputRequest): Promise<GenerateWorkflowResponse> {
    return api.post<GenerateWorkflowResponse>('/v1/opsyn/process-json', request);
  },

  /**
   * Process raw model output and download as file
   */
  async processAndDownload(request: ProcessRawOutputRequest): Promise<Blob> {
    const response = await fetch(`${window.location.origin}/api/v1/opsyn/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to process output');
    }

    return response.blob();
  },

  /**
   * Check model service status
   */
  async getModelStatus(): Promise<ModelStatusResponse> {
    return api.get<ModelStatusResponse>('/v1/opsyn/model-status');
  },

  /**
   * Get system prompt
   */
  async getSystemPrompt(extended: boolean = false): Promise<SystemPromptResponse> {
    return api.get<SystemPromptResponse>('/v1/opsyn/system-prompt', {
      extended: extended ? 'true' : 'false',
    });
  },
};

