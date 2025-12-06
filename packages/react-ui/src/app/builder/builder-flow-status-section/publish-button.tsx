import { t } from 'i18next';
import { useMemo } from 'react';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { flowsHooks } from '@/features/flows/lib/flows-hooks';
import { useAuthorization } from '@/hooks/authorization-hooks';
import { projectHooks } from '@/hooks/project-hooks';
import { FlowActionType, FlowTriggerType, FlowVersionState, PiecesFilterType, Permission, flowStructureUtil } from '@activepieces/shared';

import { useBuilderStateContext } from '../builder-hooks';

const PublishButton = () => {
  const { checkAccess } = useAuthorization();
  const [
    flowVersion,
    flow,
    setFlow,
    setVersion,
    isSaving,
    readonly,
    setIsPublishing,
    isPublishing,
  ] = useBuilderStateContext((state) => [
    state.flowVersion,
    state.flow,
    state.setFlow,
    state.setVersion,
    state.saving,
    state.readonly,
    state.setIsPublishing,
    state.isPublishing,
  ]);
  const { project } = projectHooks.useCurrentProject();
  const isViewingDraft =
    flowVersion.state === FlowVersionState.DRAFT ||
    flowVersion.id === flow.publishedVersionId;
  const permissionToEditFlow = checkAccess(Permission.WRITE_FLOW);
  const isPublishedVersion = flowVersion.id === flow.publishedVersionId;
  const { mutate: publish } = flowsHooks.usePublishFlow({
    flowId: flow.id,
    setFlow,
    setVersion,
    setIsPublishing,
  });

  // Check if any steps use disabled pieces
  const hasDisabledPieces = useMemo(() => {
    if (!project?.plan) return false;
    
    const allSteps = flowStructureUtil.getAllSteps(flowVersion.trigger);
    return allSteps.some((step) => {
      const isPieceStep = step.type === FlowActionType.PIECE || step.type === FlowTriggerType.PIECE;
      if (!isPieceStep) return false;

      const pieceName = 'pieceName' in step.settings ? step.settings.pieceName : undefined;
      if (!pieceName) return false;

      // If filter type is ALLOWED, check if piece is NOT in the allowed list (disabled)
      if (project.plan.piecesFilterType === PiecesFilterType.ALLOWED) {
        return !project.plan.pieces.includes(pieceName);
      }
      
      // If filter type is NONE, all pieces are enabled
      return false;
    });
  }, [flowVersion.trigger, project?.plan]);

  const isPublishDisabled = isPublishedVersion || !flowVersion.valid || hasDisabledPieces;

  if (!permissionToEditFlow || !isViewingDraft || (readonly && !isPublishing)) {
    return null;
  }
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild className="disabled:pointer-events-auto">
          <Button
            size={'sm'}
            loading={isSaving || isPublishing}
            disabled={isPublishDisabled}
            onClick={() => publish()}
          >
            {t('Publish')}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {isPublishedVersion
            ? t('Latest version is published')
            : hasDisabledPieces
            ? t('Your flow contains disabled pieces. Please enable them in Project Settings > Pieces or replace those steps.')
            : !flowVersion.valid
            ? t('Your flow has incomplete steps')
            : t('Publish')}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

PublishButton.displayName = 'PublishButton';
export { PublishButton };
