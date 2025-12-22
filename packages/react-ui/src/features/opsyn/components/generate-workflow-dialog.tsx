/**
 * Generate Workflow Dialog
 * 
 * A dialog for generating workflows from natural language prompts.
 * Supports both direct flow creation and JSON download.
 */

import { useMutation, useQuery } from '@tanstack/react-query';
import { t } from 'i18next';
import { Sparkles, Download, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { flowsApi } from '@/features/flows/lib/flows-api';
import { authenticationSession } from '@/lib/authentication-session';
import { FlowOperationType, FlowTrigger } from '@activepieces/shared';

import { opsynApi, GenerateWorkflowResponse } from '../lib/opsyn-api';

interface GenerateWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (template: GenerateWorkflowResponse['template']) => void;
}

export const GenerateWorkflowDialog: React.FC<GenerateWorkflowDialogProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<GenerateWorkflowResponse | null>(null);
  const navigate = useNavigate();

  // Check model status
  const { data: modelStatus, isLoading: isCheckingModel } = useQuery({
    queryKey: ['opsyn-model-status'],
    queryFn: () => opsynApi.getModelStatus(),
    enabled: open,
    refetchOnWindowFocus: false,
  });

  // Generate workflow mutation - creates flow directly
  const { mutate: generateWorkflow, isPending: isGenerating } = useMutation({
    mutationFn: async () => {
      // Step 1: Generate workflow from AI
      const data = await opsynApi.generate({
        prompt,
        useExtendedPrompt: true,
      });

      if (!data.success || !data.template) {
        throw new Error(data.error || 'Failed to generate workflow');
      }

      // Step 2: Create empty flow
      const flow = await flowsApi.create({
        displayName: data.template.name || 'AI Generated Flow',
        projectId: authenticationSession.getProjectId()!,
      });

      // Step 3: Import template into the flow
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const templateData = data.template as any;
      
      await flowsApi.update(flow.id, {
        type: FlowOperationType.IMPORT_FLOW,
        request: {
          displayName: templateData.name,
          trigger: templateData.template.trigger as FlowTrigger,
          schemaVersion: templateData.template.schemaVersion || '1',
        },
      });

      return { data, flowId: flow.id };
    },
    onSuccess: ({ data, flowId }) => {
      setResult(data);
      toast({
        title: t('Workflow Created'),
        description: t('Your workflow has been created and is ready to edit.'),
      });
      // Navigate to the new flow
      navigate(`/flows/${flowId}`);
      onOpenChange(false);
      onSuccess?.(data.template);
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : t('An error occurred');
      setResult({ success: false, error: errorMessage });
      toast({
        title: t('Generation Failed'),
        description: errorMessage,
        variant: 'destructive',
      });
    },
  });

  // Download workflow mutation
  const { mutate: downloadWorkflow, isPending: isDownloading } = useMutation({
    mutationFn: async () => {
      const blob = await opsynApi.generateAndDownload({
        prompt,
        useExtendedPrompt: true,
        filename: `workflow-${Date.now()}.json`,
      });
      return blob;
    },
    onSuccess: (blob) => {
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `workflow-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: t('Download Started'),
        description: t('Your workflow file is being downloaded.'),
      });
    },
    onError: (error) => {
      toast({
        title: t('Download Failed'),
        description: error instanceof Error ? error.message : t('Failed to download workflow'),
        variant: 'destructive',
      });
    },
  });

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast({
        title: t('Prompt Required'),
        description: t('Please enter a prompt describing your workflow.'),
        variant: 'destructive',
      });
      return;
    }
    generateWorkflow();
  };

  const handleDownload = () => {
    if (!prompt.trim()) {
      toast({
        title: t('Prompt Required'),
        description: t('Please enter a prompt describing your workflow.'),
        variant: 'destructive',
      });
      return;
    }
    downloadWorkflow();
  };

  const handleClose = () => {
    setPrompt('');
    setResult(null);
    onOpenChange(false);
  };

  const isModelAvailable = modelStatus?.available ?? false;
  const isLoading = isGenerating || isDownloading;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t('Generate Workflow with AI')}
          </DialogTitle>
          <DialogDescription>
            {t('Describe the workflow you want to create in natural language.')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          {/* Model Status */}
          <div className="flex items-center gap-2 text-sm">
            {isCheckingModel ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-muted-foreground">{t('Checking model status...')}</span>
              </>
            ) : isModelAvailable ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-green-600">{t('Model is ready')}</span>
                <span className="text-muted-foreground text-xs">
                  ({modelStatus?.config.model})
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 text-amber-500" />
                <span className="text-amber-600">{t('Model not available')}</span>
              </>
            )}
          </div>

          {/* Prompt Input */}
          <div className="flex flex-col gap-2">
            <label htmlFor="prompt" className="text-sm font-medium">
              {t('Describe your workflow')}
            </label>
            <Textarea
              id="prompt"
              placeholder={t('e.g., When a new row is added to Google Sheets, send a Slack message to the #updates channel with the row data')}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              className="resize-none"
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              {t('Be specific about triggers, actions, and any conditions.')}
            </p>
          </div>

          {/* Result */}
          {result && result.success && result.template && (
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="font-medium">{t('Workflow Generated')}</span>
              </div>
              <div className="text-sm space-y-1">
                <p><strong>{t('Name')}:</strong> {result.template.name}</p>
                <p><strong>{t('Pieces')}:</strong> {result.template.pieces.join(', ') || 'None'}</p>
                {result.generationTimeMs && (
                  <p className="text-muted-foreground text-xs">
                    {t('Generated in')} {(result.generationTimeMs / 1000).toFixed(1)}s
                  </p>
                )}
              </div>
              {result.validationErrors && result.validationErrors.length > 0 && (
                <div className="mt-2 text-xs text-amber-600">
                  <strong>{t('Warnings')}:</strong>
                  <ul className="list-disc list-inside">
                    {result.validationErrors.map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {result && !result.success && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="font-medium text-destructive">{t('Generation Failed')}</span>
              </div>
              <p className="text-sm text-destructive mt-1">{result.error}</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            {t('Cancel')}
          </Button>
          <Button
            variant="outline"
            onClick={handleDownload}
            disabled={!prompt.trim() || isLoading || !isModelAvailable}
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            {t('Download JSON')}
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={!prompt.trim() || isLoading || !isModelAvailable}
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            {t('Generate')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GenerateWorkflowDialog;

