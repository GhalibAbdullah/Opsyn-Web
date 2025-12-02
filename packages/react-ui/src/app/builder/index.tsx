import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { ImperativePanelHandle } from 'react-resizable-panels';

import {
  LeftSideBarType,
  RightSideBarType,
  useBuilderStateContext,
  useShowBuilderIsSavingWarningBeforeLeaving,
  useSwitchToDraft,
} from '@/app/builder/builder-hooks';
import { DataSelector } from '@/app/builder/data-selector';
import { CanvasControls } from '@/app/builder/flow-canvas/canvas-controls';
import { StepSettingsProvider } from '@/app/builder/step-settings/step-settings-context';
import { ChatDrawer } from '@/app/routes/chat/chat-drawer';
import { ShowPoweredBy } from '@/components/show-powered-by';
import { useSocket } from '@/components/socket-provider';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable-panel';
import { RunDetailsBar } from '@/features/flow-runs/components/run-details-bar';
import { flowRunsApi } from '@/features/flow-runs/lib/flow-runs-api';
import { piecesHooks } from '@/features/pieces/lib/pieces-hooks';
import { platformHooks } from '@/hooks/platform-hooks';
import {
  FlowActionType,
  FlowTriggerType,
  FlowVersionState,
  PieceTrigger,
  WebsocketClientEvent,
  flowStructureUtil,
  isNil,
} from '@activepieces/shared';

import { cn, useElementSize } from '../../lib/utils';

import { BuilderHeader } from './builder-header/builder-header';
import { FlowCanvas } from './flow-canvas';
import { LEFT_SIDEBAR_ID } from './flow-canvas/utils/consts';
import { FlowVersionsList } from './flow-versions';
import { FlowRunDetails } from './run-details';
import { RunsList } from './run-list';
import { StepSettingsContainer } from './step-settings';
import { FlowCommentsList } from './flow-comments';
import { FlowActivityList } from './flow-activity';

const minWidthOfSidebar = 'min-w-[max(20vw,400px)]';
const animateResizeClassName = `transition-all duration-200`;

const useAnimateSidebar = (
  sidebarValue: LeftSideBarType | RightSideBarType,
) => {
  const handleRef = useRef<ImperativePanelHandle>(null);
  const sidebarClosed = [LeftSideBarType.NONE, RightSideBarType.NONE].includes(
    sidebarValue,
  );
  useEffect(() => {
    const sidebarSize = handleRef.current?.getSize() ?? 0;
    if (sidebarClosed) {
      handleRef.current?.resize(0);
    } else if (sidebarSize === 0) {
      handleRef.current?.resize(25);
    }
  }, [handleRef, sidebarValue, sidebarClosed]);
  return handleRef;
};

const constructContainerKey = ({
  flowId,
  stepName,
  lastRerenderPieceSettingsTimeStamp,
  triggerOrActionName,
}: {
  flowId: string;
  stepName: string;
  lastRerenderPieceSettingsTimeStamp: number | null;
  triggerOrActionName?: string;
}) => {
  return (
    flowId +
    stepName +
    (triggerOrActionName ?? '') +
    (lastRerenderPieceSettingsTimeStamp ?? '')
  );
};
const BuilderPage = () => {
  const { platform } = platformHooks.useCurrentPlatform();
  const [setRun, flowVersion, leftSidebar, rightSidebar, run, selectedStep, readonly] =
    useBuilderStateContext((state) => [
      state.setRun,
      state.flowVersion,
      state.leftSidebar,
      state.rightSidebar,
      state.run,
      state.selectedStep,
      state.readonly,
    ]);

  // Only show warning if not readonly
  useShowBuilderIsSavingWarningBeforeLeaving();

  const { memorizedSelectedStep, containerKey } = useBuilderStateContext(
    (state) => {
      const flowVersion = state.flowVersion;
      if (isNil(state.selectedStep) || isNil(flowVersion)) {
        return {
          memorizedSelectedStep: undefined,
          containerKey: undefined,
        };
      }
      const step = flowStructureUtil.getStep(
        state.selectedStep,
        flowVersion.trigger,
      );
      const triggerOrActionName =
        step?.type === FlowTriggerType.PIECE
          ? (step as PieceTrigger).settings.triggerName
          : step?.settings.actionName;
      return {
        memorizedSelectedStep: step,
        containerKey: constructContainerKey({
          flowId: state.flow.id,
          stepName: state.selectedStep,
          triggerOrActionName,
          lastRerenderPieceSettingsTimeStamp:
            state.lastRerenderPieceSettingsTimeStamp,
        }),
      };
    },
  );
  const middlePanelRef = useRef<HTMLDivElement>(null);
  const middlePanelSize = useElementSize(middlePanelRef);
  const [isDraggingHandle, setIsDraggingHandle] = useState(false);
  const rightHandleRef = useAnimateSidebar(rightSidebar);
  const leftHandleRef = useAnimateSidebar(leftSidebar);
  const rightSidePanelRef = useRef<HTMLDivElement>(null);

  const { pieceModel, refetch: refetchPiece } =
    piecesHooks.usePieceModelForStepSettings({
      name: memorizedSelectedStep?.settings.pieceName,
      version: memorizedSelectedStep?.settings.pieceVersion,
      enabled:
        memorizedSelectedStep?.type === FlowActionType.PIECE ||
        memorizedSelectedStep?.type === FlowTriggerType.PIECE,
      getExactVersion: flowVersion.state === FlowVersionState.LOCKED,
    });

  const socket = useSocket();

  const { mutate: fetchAndUpdateRun } = useMutation({
    mutationFn: flowRunsApi.getPopulated,
  });
  useEffect(() => {
    socket.on(WebsocketClientEvent.REFRESH_PIECE, () => {
      refetchPiece();
    });
    socket.on(WebsocketClientEvent.FLOW_RUN_PROGRESS, (data) => {
      const runId = data?.runId;
      if (run && run?.id === runId) {
        fetchAndUpdateRun(runId, {
          onSuccess: (run) => {
            setRun(run, flowVersion);
          },
        });
      }
    });
    return () => {
      socket.removeAllListeners(WebsocketClientEvent.REFRESH_PIECE);
      socket.removeAllListeners(WebsocketClientEvent.FLOW_RUN_PROGRESS);
    };
  }, [socket.id, run?.id]);

  const { switchToDraft, isSwitchingToDraftPending } = useSwitchToDraft();
  const [hasCanvasBeenInitialised, setHasCanvasBeenInitialised] =
    useState(false);

  // Block all interactions in readonly mode using event capture
  useEffect(() => {
    if (!readonly) return;

    const middlePanelElement = middlePanelRef.current;
    if (!middlePanelElement) return;

    const blockEvent = (e: Event) => {
      const target = e.target as HTMLElement;
      // Allow events from header (outside builder content)
      if (target.closest('[class*="builder-header"]') || target.closest('header')) {
        return;
      }
      // Allow scroll events
      if (e.type === 'wheel' || e.type === 'scroll') {
        return;
      }
      // Check if event is within builder content
      if (middlePanelElement.contains(target)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
      }
    };

    const events = [
      'mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu',
      'dragstart', 'drag', 'dragend', 'drop',
      'touchstart', 'touchend', 'touchmove',
      'keydown', 'keyup', 'keypress'
    ];
    
    events.forEach(eventType => {
      document.addEventListener(eventType, blockEvent, { capture: true, passive: false });
    });

    return () => {
      events.forEach(eventType => {
        document.removeEventListener(eventType, blockEvent, { capture: true });
      });
    };
  }, [readonly]);

  return (
    <div className="flex h-full w-full flex-col relative">
      <div className="z-50">
        <BuilderHeader />
      </div>
      <div className={cn("relative flex-1 overflow-hidden")}>
        {readonly && (
          <div 
            className="absolute inset-0 z-[9999] bg-transparent cursor-not-allowed"
            style={{ pointerEvents: 'auto' }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
            }}
            onMouseUp={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
            }}
            onDoubleClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
            }}
            onDragStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
            }}
            onWheel={(e) => {
              // Allow scrolling but prevent other interactions
              e.stopPropagation();
            }}
          />
        )}
        <ResizablePanelGroup direction="horizontal" className={readonly ? "pointer-events-none" : ""}>
        <ResizablePanel
          id="left-sidebar"
          defaultSize={0}
          minSize={0}
          maxSize={39}
          order={1}
          ref={leftHandleRef}
          className={cn('min-w-0 bg-background z-20 ', {
            [minWidthOfSidebar]: leftSidebar !== LeftSideBarType.NONE,
            [animateResizeClassName]: !isDraggingHandle,
          })}
        >
          <div id={LEFT_SIDEBAR_ID} className="w-full h-full">
            {leftSidebar === LeftSideBarType.RUNS && <RunsList />}
            {leftSidebar === LeftSideBarType.RUN_DETAILS && <FlowRunDetails />}
            {leftSidebar === LeftSideBarType.VERSIONS && <FlowVersionsList />}
            {leftSidebar === LeftSideBarType.COMMENTS && <FlowCommentsList />}
            {leftSidebar === LeftSideBarType.ACTIVITY && <FlowActivityList />}
          </div>
        </ResizablePanel>

        <ResizableHandle
          disabled={leftSidebar === LeftSideBarType.NONE}
          withHandle={leftSidebar !== LeftSideBarType.NONE}
          onDragging={setIsDraggingHandle}
          className={
            leftSidebar === LeftSideBarType.NONE ? 'bg-transparent' : ''
          }
        />

        <ResizablePanel defaultSize={100} order={2} id="flow-canvas" className={readonly ? "pointer-events-none" : ""}>
          <div ref={middlePanelRef} className={cn("relative h-full w-full", readonly && "pointer-events-none")}>
            <FlowCanvas
              setHasCanvasBeenInitialised={setHasCanvasBeenInitialised}
            ></FlowCanvas>

            <RunDetailsBar
              run={run}
              isLoading={isSwitchingToDraftPending}
              exitRun={() => {
                socket.removeAllListeners(
                  WebsocketClientEvent.FLOW_RUN_PROGRESS,
                );
                switchToDraft();
              }}
            />
            {middlePanelRef.current &&
              middlePanelRef.current.clientWidth > 0 && (
                <CanvasControls
                  canvasHeight={middlePanelRef.current?.clientHeight ?? 0}
                  canvasWidth={middlePanelRef.current?.clientWidth ?? 0}
                  hasCanvasBeenInitialised={hasCanvasBeenInitialised}
                  selectedStep={selectedStep}
                ></CanvasControls>
              )}

            <ShowPoweredBy
              position="absolute"
              show={platform?.plan.showPoweredBy}
            />
            <DataSelector
              parentHeight={middlePanelSize.height}
              parentWidth={middlePanelSize.width}
            ></DataSelector>
          </div>
        </ResizablePanel>

        <ResizableHandle
          disabled={rightSidebar === RightSideBarType.NONE}
          withHandle={rightSidebar !== RightSideBarType.NONE}
          onDragging={setIsDraggingHandle}
          className={
            rightSidebar === RightSideBarType.NONE ? 'bg-transparent' : ''
          }
        />

        <ResizablePanel
          ref={rightHandleRef}
          id="right-sidebar"
          defaultSize={0}
          minSize={0}
          maxSize={60}
          order={3}
          className={cn('min-w-0 bg-background z-30', {
            [minWidthOfSidebar]: rightSidebar !== RightSideBarType.NONE,
            [animateResizeClassName]: !isDraggingHandle,
            'pointer-events-none': readonly,
          })}
        >
          <div ref={rightSidePanelRef} className={cn("h-full w-full", readonly && "pointer-events-none")}>
            {rightSidebar === RightSideBarType.PIECE_SETTINGS &&
              memorizedSelectedStep && (
                <StepSettingsProvider
                  pieceModel={pieceModel}
                  selectedStep={memorizedSelectedStep}
                  key={
                    containerKey +
                    (pieceModel?.name ?? '') +
                    memorizedSelectedStep.type
                  }
                >
                  <StepSettingsContainer />
                </StepSettingsProvider>
              )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
      </div>
      <ChatDrawer />
    </div>
  );
};

BuilderPage.displayName = 'BuilderPage';
export { BuilderPage };
