import { useMutation } from '@tanstack/react-query';
import { t } from 'i18next';
import { Compass, Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Type } from '@sinclair/typebox';
import { typeboxResolver } from '@hookform/resolvers/typebox';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { SelectFlowTemplateDialog } from '@/features/flows/components/select-flow-template-dialog';
import { flowsApi } from '@/features/flows/lib/flows-api';
import { authenticationSession } from '@/lib/authentication-session';
import { projectApi } from '@/lib/project-api';
import { NEW_FLOW_QUERY_PARAM } from '@/lib/utils';
import { PopulatedFlow, UncategorizedFolderId } from '@activepieces/shared';

export const ONBOARDING_STORAGE_KEY = 'ap_onboarding_seen';

const ONBOARDING_COMPLETED = 'completed';
const ONBOARDING_DISMISSED = 'dismissed';

type WizardStep = 'welcome' | 'project-name' | 'flow-name' | 'complete';

type ProjectFormData = {
  projectName: string;
};

export type OnboardingDialogProps = {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
  onSkip: () => void;
  onDontShowAgain: () => void;
};

export const OnboardingDialog = ({
  open,
  onClose,
  onComplete,
  onSkip,
  onDontShowAgain,
}: OnboardingDialogProps) => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<WizardStep>('welcome');
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);
  const [createdFlowId, setCreatedFlowId] = useState<string | null>(null);
  const [flowName, setFlowName] = useState<string>('');
  const [flowNameError, setFlowNameError] = useState<string | null>(null);

  const projectForm = useForm<ProjectFormData>({
    resolver: typeboxResolver(
      Type.Object({
        projectName: Type.String({
          minLength: 1,
          errorMessage: t('Project name is required'),
        }),
      }),
    ),
    defaultValues: {
      projectName: '',
    },
  });

  const { mutateAsync: createProject, isPending: isCreatingProject } =
    useMutation({
      mutationFn: async (projectName: string) => {
        const newProject = await projectApi.create({
          displayName: projectName,
        });
        await authenticationSession.switchToProject(newProject.id);
        return newProject;
      },
      onSuccess: async (project) => {
        setCreatedProjectId(project.id);
        // Move to flow step; flow name state starts empty
        setFlowName('');
        setFlowNameError(null);
        setCurrentStep('flow-name');
      },
    });

  const { mutateAsync: createFlow, isPending: isCreatingFlow } = useMutation({
    mutationFn: async (name: string) => {
      if (!createdProjectId) {
        throw new Error('No project created yet');
      }
      return flowsApi.create({
        projectId: createdProjectId,
        displayName: name,
      });
    },
    onSuccess: (flow) => {
      setCreatedFlowId(flow.id);
      setCurrentStep('complete');
    },
  });

  // Reset wizard state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setCurrentStep('welcome');
      setCreatedProjectId(null);
      setCreatedFlowId(null);
       setFlowName('');
       setFlowNameError(null);
      projectForm.reset({ projectName: '' });
    }
  }, [open]);

  const handleProjectSubmit = projectForm.handleSubmit((data) => {
    createProject(data.projectName);
  });

  const handleFlowSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = flowName.trim();
    if (!trimmed) {
      setFlowNameError(t('Flow name is required'));
      return;
    }
    setFlowNameError(null);
    await createFlow(trimmed);
  };

  const handleGoToBuilder = () => {
    if (createdFlowId && createdProjectId) {
      onComplete();
      navigate(
        authenticationSession.appendProjectRoutePrefix(
          `/flows/${createdFlowId}?${NEW_FLOW_QUERY_PARAM}=true&onboarding=wizard`,
        ),
      );
    }
  };

  const handleTemplateClick = () => {
    onComplete();
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'welcome':
        return (
          <div className="flex flex-col gap-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {t(
                  "Let's get you started! We'll guide you through creating your first project and flow.",
                )}
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Button
                size="lg"
                className="justify-start gap-2"
                onClick={() => setCurrentStep('project-name')}
              >
                <Sparkles className="h-4 w-4" />
                {t('Start Guided Setup')}
                <ArrowRight className="h-4 w-4 ml-auto" />
              </Button>
              <SelectFlowTemplateDialog folderId={UncategorizedFolderId}>
                <Button
                  size="lg"
                  variant="outline"
                  className="justify-start gap-2"
                  onClick={handleTemplateClick}
                >
                  <Compass className="h-4 w-4" />
                  {t('Browse Templates Instead')}
                </Button>
              </SelectFlowTemplateDialog>
            </div>
          </div>
        );

      case 'project-name':
        return (
          <div className="flex flex-col gap-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {t(
                  'First, let\'s create a project. Projects help you organize your flows.',
                )}
              </p>
            </div>
            <Form {...projectForm}>
              <form onSubmit={handleProjectSubmit} className="space-y-4">
                <FormField
                  name="projectName"
                  render={({ field }) => (
                    <FormItem>
                      <Label htmlFor="projectName">{t('Project Name')}</Label>
                      <Input
                        {...field}
                        id="projectName"
                        placeholder={t('e.g., My First Project')}
                        disabled={isCreatingProject}
                        autoFocus
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setCurrentStep('welcome')}
                    disabled={isCreatingProject}
                  >
                    {t('Back')}
                  </Button>
                  <Button
                    type="submit"
                    loading={isCreatingProject}
                    disabled={isCreatingProject}
                  >
                    {t('Create Project')}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        );

      case 'flow-name':
        return (
          <div className="flex flex-col gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                {t('Project created successfully!')}
              </div>
              <p className="text-sm text-muted-foreground">
                {t(
                  "Now let's create your first flow. A flow is an automated workflow that connects different apps and services.",
                )}
              </p>
            </div>
            <form onSubmit={handleFlowSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="flowName">{t('Flow Name')}</Label>
                <Input
                  id="flowName"
                  placeholder={t('e.g., My First Flow')}
                  disabled={isCreatingFlow}
                  autoFocus
                  autoComplete="off"
                  value={flowName}
                  onChange={(e) => {
                    setFlowName(e.target.value);
                    if (flowNameError && e.target.value.trim()) {
                      setFlowNameError(null);
                    }
                  }}
                />
                {flowNameError && (
                  <p className="text-sm font-medium text-destructive break-words">
                    {flowNameError}
                  </p>
                )}
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setCurrentStep('project-name')}
                  disabled={isCreatingFlow}
                >
                  {t('Back')}
                </Button>
                <Button type="submit" loading={isCreatingFlow} disabled={isCreatingFlow}>
                  {t('Create Flow')}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </form>
          </div>
        );

      case 'complete':
        return (
          <div className="flex flex-col gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                {t('Flow created successfully!')}
              </div>
              <p className="text-sm text-muted-foreground">
                {t(
                  "Great! You're all set. Now let's open the flow builder where you can add triggers and actions to automate your workflow.",
                )}
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={onSkip}>
                {t('Skip for now')}
              </Button>
              <Button onClick={handleGoToBuilder} size="lg">
                {t('Open Flow Builder')}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 'welcome':
        return t('Welcome to Activepieces');
      case 'project-name':
        return t('Create Your Project');
      case 'flow-name':
        return t('Create Your First Flow');
      case 'complete':
        return t('You\'re All Set!');
      default:
        return t('Welcome to Activepieces');
    }
  };

  const getStepDescription = () => {
    switch (currentStep) {
      case 'welcome':
        return t('Get started with a guided setup or browse templates.');
      case 'project-name':
        return t('Step 1 of 3: Name your project');
      case 'flow-name':
        return t('Step 2 of 3: Name your flow');
      case 'complete':
        return t('Step 3 of 3: Ready to build!');
      default:
        return '';
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && currentStep === 'welcome') {
          onSkip();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {getStepTitle()}
            {currentStep !== 'welcome' && (
              <Badge variant="outline">{t('Wizard')}</Badge>
            )}
          </DialogTitle>
          <DialogDescription>{getStepDescription()}</DialogDescription>
        </DialogHeader>

        {renderStepContent()}

        {currentStep === 'welcome' && (
          <div className="flex gap-2 pt-2 border-t">
            <Button variant="ghost" onClick={onSkip} className="flex-1">
              {t('Skip for now')}
            </Button>
            <Button variant="ghost" onClick={onDontShowAgain} className="flex-1">
              {t("Don't show again")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
