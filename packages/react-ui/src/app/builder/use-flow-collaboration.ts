import { useEffect, useRef } from 'react';
import { useSocket } from '@/components/socket-provider';
import { useBuilderStateContext } from './builder-hooks';
import { FlowOperationBroadcast, FlowEditorsChanged, FlowOperationRequest, WebsocketClientEvent, flowOperations } from '@activepieces/shared';
import { useQueryClient } from '@tanstack/react-query';
import { flowsApi } from '@/features/flows/lib/flows-api';
import { authenticationSession } from '@/lib/authentication-session';
import { userHooks } from '@/hooks/user-hooks';
import { toast } from '@/components/ui/use-toast';
import { t } from 'i18next';

export const useFlowCollaboration = (flowId: string | undefined) => {
  const socket = useSocket();
  const queryClient = useQueryClient();
  const { data: currentUser } = userHooks.useCurrentUser();
  const [flowVersion, setVersion, setFlow] = useBuilderStateContext((state) => [
    state.flowVersion,
    state.setVersion,
    state.setFlow,
  ]);
  
  // Use ref to always get the latest flowVersion without causing re-renders
  const flowVersionRef = useRef(flowVersion);
  useEffect(() => {
    flowVersionRef.current = flowVersion;
  }, [flowVersion]);

  useEffect(() => {
    if (!flowId) {
      return;
    }

    // Listen for flow operation broadcasts
    const handleFlowOperationBroadcast = async (data: FlowOperationBroadcast) => {
      console.log('Received flow operation broadcast:', data);

      // Only apply if it's for the current flow
      if (data.flowId !== flowId) {
        return;
      }

      // Get current flow version from ref to avoid stale closure
      const currentFlowVersion = flowVersionRef.current;

      // Check if we need to refresh from server (if flowVersionId doesn't match)
      if (data.flowVersionId !== currentFlowVersion.id) {
        // Flow version mismatch - refresh from server
        console.log('Flow version mismatch, refreshing from server');
        try {
          const updatedFlow = await flowsApi.get(flowId);
          setFlow(updatedFlow);
          setVersion(updatedFlow.version);
          
          // Only show notification if it's from another user
          if (data.userId !== currentUser?.id) {
            toast({
              title: t('Flow updated'),
              description: t('Another user made changes. The flow has been refreshed.'),
            });
          }
        } catch (error) {
          console.error('Failed to refresh flow after remote change:', error);
        }
        return;
      }

      // Apply the operation optimistically
      try {
        const operation = data.operation as FlowOperationRequest;
        const newFlowVersion = flowOperations.apply(currentFlowVersion, operation);
        
        console.log('Applying remote operation optimistically');
        setVersion(newFlowVersion);
        
        // Invalidate query to ensure UI is in sync
        queryClient.invalidateQueries({
          queryKey: ['flow', flowId, authenticationSession.getProjectId()],
        });
      } catch (error) {
        console.error('Failed to apply remote operation:', error);
        // If optimistic apply fails, refresh from server
        try {
          const updatedFlow = await flowsApi.get(flowId);
          setFlow(updatedFlow);
          setVersion(updatedFlow.version);
        } catch (refreshError) {
          console.error('Failed to refresh flow:', refreshError);
        }
      }
    };

    // Listen for active editors changes
    const handleEditorsChanged = (data: FlowEditorsChanged) => {
      // This will be handled by the active editors badge component
      // We can store this in state if needed, but for now we'll handle it in the badge component
    };

    // Set up listeners
    socket.on(WebsocketClientEvent.FLOW_OPERATION_BROADCAST, handleFlowOperationBroadcast);
    socket.on(WebsocketClientEvent.FLOW_EDITORS_CHANGED, handleEditorsChanged);

    // Also set up listeners when socket connects (in case it wasn't connected initially)
    const onConnect = () => {
      console.log('Socket connected, setting up flow collaboration listeners');
    };
    socket.on('connect', onConnect);

    return () => {
      socket.off(WebsocketClientEvent.FLOW_OPERATION_BROADCAST, handleFlowOperationBroadcast);
      socket.off(WebsocketClientEvent.FLOW_EDITORS_CHANGED, handleEditorsChanged);
      socket.off('connect', onConnect);
    };
  }, [flowId, socket, currentUser?.id, setVersion, setFlow, queryClient]); // Removed flowVersion from deps to avoid re-running on every change
};

