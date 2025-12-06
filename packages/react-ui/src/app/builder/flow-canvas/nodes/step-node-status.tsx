import { t } from 'i18next';
import { RouteOff } from 'lucide-react';
import { useMemo } from 'react';

import { InvalidStepIcon } from '@/components/custom/alert-icon';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { StepStatusIcon } from '@/features/flow-runs/components/step-status-icon';
import { projectHooks } from '@/hooks/project-hooks';
import { FlowActionType, FlowTriggerType, PiecesFilterType, flowStructureUtil } from '@activepieces/shared';

import { useBuilderStateContext } from '../../builder-hooks';
import { flowCanvasUtils } from '../utils/flow-canvas-utils';

const ApStepNodeStatus = ({ stepName }: { stepName: string }) => {
  const [run, loopIndexes, flowVersion, step] = useBuilderStateContext(
    (state) => [
      state.run,
      state.loopsIndexes,
      state.flowVersion,
      flowStructureUtil.getStep(stepName, state.flowVersion.trigger),
    ],
  );
  const { project } = projectHooks.useCurrentProject();

  const stepStatusInRun = useMemo(() => {
    return flowCanvasUtils.getStepStatus(
      stepName,
      run,
      loopIndexes,
      flowVersion,
    );
  }, [stepName, run, loopIndexes, flowVersion]);
  const isSkipped = flowCanvasUtils.isSkipped(stepName, flowVersion.trigger);

  // Check if the piece is disabled
  const isPieceDisabled = useMemo(() => {
    if (!step || !project?.plan) return false;
    
    const isPieceStep = step.type === FlowActionType.PIECE || step.type === FlowTriggerType.PIECE;
    if (!isPieceStep) return false;

    const pieceName = 'pieceName' in step.settings ? step.settings.pieceName : undefined;
    if (!pieceName) return false;

    // If filter type is ALLOWED, check if piece is in the allowed list
    if (project.plan.piecesFilterType === PiecesFilterType.ALLOWED) {
      return !project.plan.pieces.includes(pieceName);
    }
    
    // If filter type is NONE, all pieces are enabled
    return false;
  }, [step, project?.plan]);

  const errorMessage = isPieceDisabled
    ? t('This piece has been disabled. Please enable it in Project Settings > Pieces or replace this step.')
    : t('Incomplete settings');

  return (
    <div className="w-4 flex mt-0.5 items-center justify-center h-[20px]">
      {stepStatusInRun && (
        <StepStatusIcon
          status={stepStatusInRun}
          size="4"
          runStatus={run?.status}
        ></StepStatusIcon>
      )}
      {isSkipped && (
        <Tooltip>
          <TooltipTrigger asChild>
            <RouteOff className="w-4 h-4"> </RouteOff>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t('Skipped')}</TooltipContent>
        </Tooltip>
      )}
      {(!step?.valid || isPieceDisabled) && !isSkipped && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="mr-3" title={errorMessage}>
              <InvalidStepIcon
                size={16}
                viewBox="0 0 16 15"
                className="stroke-0 animate-fade w-4 h-4"
              ></InvalidStepIcon>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {errorMessage}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
};
ApStepNodeStatus.displayName = 'ApStepNodeStatus';

export { ApStepNodeStatus };
