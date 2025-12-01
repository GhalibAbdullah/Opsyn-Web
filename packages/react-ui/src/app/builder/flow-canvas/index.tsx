import {
  ReactFlow,
  Background,
  SelectionMode,
  OnSelectionChangeParams,
  useStoreApi,
  PanOnScrollMode,
  useKeyPress,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import React, { useCallback, useMemo, useRef, useState } from 'react';

import { useTheme } from '@/components/theme-provider';
import {
  FlowActionType,
  flowStructureUtil,
  FlowVersion,
  isNil,
  Step,
} from '@activepieces/shared';

import {
  doesSelectionRectangleExist,
  LeftSideBarType,
  NODE_SELECTION_RECT_CLASS_NAME,
  useBuilderStateContext,
  useFocusOnStep,
  useHandleKeyPressOnCanvas,
  useResizeCanvas,
} from '../builder-hooks';

import {
  CanvasContextMenu,
  ContextMenuType,
} from './context-menu/canvas-context-menu';
import { FlowDragLayer } from './flow-drag-layer';
import {
  flowUtilConsts,
  SELECTION_RECT_CHEVRON_ATTRIBUTE,
  STEP_CONTEXT_MENU_ATTRIBUTE,
} from './utils/consts';
import { flowCanvasUtils } from './utils/flow-canvas-utils';
import { AboveFlowWidgets } from './widgets';
import { useShowChevronNextToSelection } from './widgets/selection-chevron-button';

const getChildrenKey = (step: Step) => {
  switch (step.type) {
    case FlowActionType.LOOP_ON_ITEMS:
      return step.firstLoopAction ? step.firstLoopAction.name : '';
    case FlowActionType.ROUTER:
      return step.children.reduce((routerKey, child) => {
        const childrenKey = child
          ? flowStructureUtil
              .getAllSteps(child)
              .reduce(
                (childKey, grandChild) => `${childKey}-${grandChild.name}`,
                '',
              )
          : 'null';
        return `${routerKey}-${childrenKey}`;
      }, '');
    case FlowActionType.CODE:
    case FlowActionType.PIECE:
      return '';
  }
};

const createGraphKey = (flowVersion: FlowVersion) => {
  return flowStructureUtil
    .getAllSteps(flowVersion.trigger)
    .reduce((acc, step) => {
      const branchesNames =
        step.type === FlowActionType.ROUTER
          ? step.settings.branches.map((branch) => branch.branchName).join('-')
          : '0';
      const childrenKey = getChildrenKey(step);
      return `${acc}-${step.displayName}-${step.type}-${
        step.nextAction ? step.nextAction.name : ''
      }-${
        step.type === FlowActionType.PIECE ? step.settings.pieceName : ''
      }-${branchesNames}-${childrenKey}}`;
    }, '');
};

export const FlowCanvas = React.memo(
  ({
    setHasCanvasBeenInitialised,
  }: {
    setHasCanvasBeenInitialised: (value: boolean) => void;
  }) => {
    const { theme } = useTheme();
    const [
      flowVersion,
      setSelectedNodes,
      selectedNodes,
      selectedStep,
      panningMode,
      selectStepByName,
      readonly,
      leftSidebar,
    ] = useBuilderStateContext((state) => {
      return [
        state.flowVersion,
        state.setSelectedNodes,
        state.selectedNodes,
        state.selectedStep,
        state.panningMode,
        state.selectStepByName,
        state.readonly,
        state.leftSidebar,
      ];
    });
    const containerRef = useRef<HTMLDivElement>(null);

    useShowChevronNextToSelection();
    useFocusOnStep();
    useHandleKeyPressOnCanvas();
    useResizeCanvas(containerRef, setHasCanvasBeenInitialised);
    const storeApi = useStoreApi();
    
    // Ensure selected step's node stays selected when comments sidebar opens
    React.useEffect(() => {
      if (leftSidebar === LeftSideBarType.COMMENTS && selectedStep && selectedStep !== 'trigger') {
        // Re-select the node in React Flow to maintain visual selection
        const state = storeApi.getState();
        const currentSelected = state.nodes.filter((n: { id: string; selected?: boolean }) => n.selected).map((n: { id: string }) => n.id);
        if (!currentSelected.includes(selectedStep)) {
          state.addSelectedNodes([selectedStep]);
          setSelectedNodes([selectedStep]);
        }
      }
    }, [leftSidebar, selectedStep, storeApi, setSelectedNodes]);
    const isShiftKeyPressed = useKeyPress('Shift');
    const inGrabPanningMode = !isShiftKeyPressed && panningMode === 'grab';
    const onSelectionChange = useCallback(
      (ev: OnSelectionChangeParams) => {
        if (readonly) {
          return;
        }
        const selectedNodes = ev.nodes.map((n) => n.id);
        // If comments sidebar is open and we have a selected step, preserve it even if React Flow cleared selection
        if (selectedNodes.length === 0 && selectedStep) {
          if (leftSidebar === LeftSideBarType.COMMENTS) {
            // Preserve the step selection for commenting
            selectedNodes.push(selectedStep);
            // Re-select the node in React Flow to maintain visual selection
            setTimeout(() => {
              storeApi.getState().addSelectedNodes([selectedStep]);
            }, 0);
          } else {
            selectedNodes.push(selectedStep);
          }
        }
        setSelectedNodes(selectedNodes);
      },
      [readonly, setSelectedNodes, selectedStep, leftSidebar, storeApi],
    );
    const graphKey = useMemo(() => {
      if (!flowVersion?.trigger) {
        return '';
      }
      return createGraphKey(flowVersion);
    }, [flowVersion]);
    const graph = useMemo(() => {
      if (!flowVersion?.trigger) {
        return { nodes: [], edges: [] };
      }
      return flowCanvasUtils.convertFlowVersionToGraph(flowVersion);
    }, [flowVersion, graphKey]);
    const [contextMenuType, setContextMenuType] = useState<ContextMenuType>(
      ContextMenuType.CANVAS,
    );
    const onContextMenu = useCallback(
      (ev: React.MouseEvent<HTMLDivElement>) => {
        if (readonly) {
          ev.preventDefault();
          return;
        }
        if (
          ev.target instanceof HTMLElement ||
          ev.target instanceof SVGElement
        ) {
          const stepElement = ev.target.closest(
            `[data-${STEP_CONTEXT_MENU_ATTRIBUTE}]`,
          );
          const stepName = stepElement?.getAttribute(
            `data-${STEP_CONTEXT_MENU_ATTRIBUTE}`,
          );

          if (stepElement && stepName) {
            selectStepByName(stepName);
            storeApi.getState().addSelectedNodes([stepName]);
          }
          const targetIsSelectionChevron = ev.target.closest(
            `[data-${SELECTION_RECT_CHEVRON_ATTRIBUTE}]`,
          );
          const targetIsSelectionRect = ev.target.classList.contains(
            NODE_SELECTION_RECT_CLASS_NAME,
          );
          const showStepContextMenu =
            stepElement || targetIsSelectionRect || targetIsSelectionChevron;
          if (showStepContextMenu) {
            setContextMenuType(ContextMenuType.STEP);
          } else {
            setContextMenuType(ContextMenuType.CANVAS);
          }
          const shouldRemoveSelectionRect =
            !targetIsSelectionRect && !targetIsSelectionChevron;
          if (shouldRemoveSelectionRect) {
            document
              .querySelector(`.${NODE_SELECTION_RECT_CLASS_NAME}`)
              ?.remove();
          }
        }
      },
      [readonly, setSelectedNodes, selectedNodes, doesSelectionRectangleExist, selectStepByName, storeApi],
    );

    const onSelectionEnd = useCallback(() => {
      if (readonly) {
        return;
      }
      const selectedSteps = selectedNodes.map((node) =>
        flowStructureUtil.getStepOrThrow(node, flowVersion.trigger),
      );
      selectedSteps.forEach((step) => {
        if (
          step.type === FlowActionType.LOOP_ON_ITEMS ||
          step.type === FlowActionType.ROUTER
        ) {
          const childrenNotSelected = flowStructureUtil
            .getAllChildSteps(step)
            .filter((c) => isNil(selectedNodes.find((n) => n === c.name)));
          selectedSteps.push(...childrenNotSelected);
        }
      });
      const step = selectedStep
        ? flowStructureUtil.getStep(selectedStep, flowVersion.trigger)
        : null;
      if (selectedNodes.length === 0 && step) {
        selectedSteps.push(step);
      }
      storeApi
        .getState()
        .addSelectedNodes(selectedSteps.map((step) => step.name));
    }, [readonly, selectedNodes, storeApi, selectedStep, flowVersion]);
    const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
    return (
      <div
        ref={containerRef}
        className="size-full relative overflow-hidden z-30"
      >
        {readonly && (
          <div
            className="absolute inset-0 z-[10000] bg-transparent cursor-not-allowed"
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
              // Allow scrolling
              e.stopPropagation();
            }}
          />
        )}
        <FlowDragLayer cursorPosition={cursorPosition}>
          <CanvasContextMenu contextMenuType={contextMenuType}>
            <ReactFlow
              key={graphKey || 'empty-graph'}
              onContextMenu={onContextMenu}
              onPaneClick={() => {
                if (readonly) {
                  return;
                }
                // Don't clear selection if comments sidebar is open and we have a selected step
                // This allows users to click on the canvas while keeping the step selected for commenting
                if (leftSidebar === LeftSideBarType.COMMENTS && selectedStep) {
                  return;
                }
                storeApi.getState().unselectNodesAndEdges();
              }}
              nodeTypes={flowUtilConsts.nodeTypes}
              nodes={graph.nodes}
              edgeTypes={flowUtilConsts.edgeTypes}
              edges={graph.edges}
              draggable={false}
              edgesFocusable={false}
              elevateEdgesOnSelect={false}
              maxZoom={1.5}
              minZoom={0.5}
              panOnDrag={readonly ? false : (inGrabPanningMode ? [0, 1] : [1])}
              zoomOnDoubleClick={false}
              panOnScroll={!readonly}
              panOnScrollMode={PanOnScrollMode.Free}
              fitView={false}
              nodesConnectable={false}
              elementsSelectable={!readonly}
              nodesDraggable={false}
              nodesFocusable={false}
              onNodeDrag={(event) => {
                if (readonly) {
                  return;
                }
                setCursorPosition({ x: event.clientX, y: event.clientY });
              }}
              selectionKeyCode={readonly ? null : (inGrabPanningMode ? 'Shift' : null)}
              multiSelectionKeyCode={readonly ? null : (inGrabPanningMode ? 'Shift' : null)}
              selectionOnDrag={readonly ? false : (inGrabPanningMode ? false : true)}
              selectNodesOnDrag={!readonly}
              onNodesDelete={readonly ? undefined : undefined}
              onEdgesDelete={readonly ? undefined : undefined}
              deleteKeyCode={readonly ? null : 'Delete'}
              selectionMode={SelectionMode.Partial}
              onSelectionChange={onSelectionChange}
              onSelectionEnd={onSelectionEnd}
            >
              <AboveFlowWidgets></AboveFlowWidgets>
              <Background
                gap={30}
                size={4}
                variant={BackgroundVariant.Dots}
                bgColor={theme === 'dark' ? ' #1a1e23' : '#ffffff'}
                color={theme === 'dark' ? 'rgba(77, 77, 77, 0.45)' : '#F2F2F2'}
              />
            </ReactFlow>
          </CanvasContextMenu>
        </FlowDragLayer>
      </div>
    );
  },
);

FlowCanvas.displayName = 'FlowCanvas';
