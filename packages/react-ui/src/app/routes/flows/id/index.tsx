import { useQuery } from '@tanstack/react-query';
import { ReactFlowProvider } from '@xyflow/react';
import { t } from 'i18next';
import { FileX } from 'lucide-react';
import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';

import { BuilderPage } from '@/app/builder';
import { BuilderStateProvider } from '@/app/builder/builder-state-provider';
import { useFlowCollaboration } from '@/app/builder/use-flow-collaboration';
import { NotAvailablePage } from '@/app/components/not-available-page';
import { buttonVariants } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/spinner';
import { useSocket } from '@/components/socket-provider';
import { flowsApi } from '@/features/flows/lib/flows-api';
import { sampleDataHooks } from '@/features/flows/lib/sample-data-hooks';
import { useAuthorization } from '@/hooks/authorization-hooks';
import { authenticationSession } from '@/lib/authentication-session';
import { cn } from '@/lib/utils';
import { isNil, Permission, PopulatedFlow, WebsocketServerEvent } from '@activepieces/shared';

// Type definitions for flow editor events
type FlowEditorJoined = { flowId: string };
type FlowEditorLeft = { flowId: string };

const FlowBuilderPage = () => {
  const { flowId } = useParams();
  const socket = useSocket();
  const { checkAccess } = useAuthorization();
  const canEditFlow = checkAccess(Permission.WRITE_FLOW);

  const {
    data: flow,
    isLoading,
    isError,
  } = useQuery<PopulatedFlow, Error>({
    queryKey: ['flow', flowId, authenticationSession.getProjectId()],
    queryFn: () => flowsApi.get(flowId!),
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Join flow room when editor opens
  useEffect(() => {
    if (!flowId) {
      return;
    }

    const joinFlowRoom = () => {
      if (socket.connected && flowId) {
        socket.emit('FLOW_EDITOR_JOINED' as any, {
          flowId,
        } as FlowEditorJoined);
      }
    };

    const leaveFlowRoom = () => {
      if (socket.connected && flowId) {
        socket.emit('FLOW_EDITOR_LEFT' as any, {
          flowId,
        } as FlowEditorLeft);
      }
    };

    // Join immediately if already connected
    if (socket.connected) {
      joinFlowRoom();
    }

    // Also join when socket connects (handles reconnections)
    socket.on('connect', joinFlowRoom);
    
    // Also join when socket reconnects
    const handleReconnect = () => {
      joinFlowRoom();
    };
    socket.io.on('reconnect', handleReconnect);

    // Cleanup: leave room and remove listeners
    return () => {
      socket.off('connect', joinFlowRoom);
      socket.io.off('reconnect', handleReconnect);
      leaveFlowRoom();
    };
  }, [flowId, socket]);

  const { data: sampleData, isLoading: isSampleDataLoading } =
    sampleDataHooks.useSampleDataForFlow(flow?.version, flow?.projectId);

  const { data: sampleDataInput, isLoading: isSampleDataInputLoading } =
    sampleDataHooks.useSampleDataInputForFlow(flow?.version, flow?.projectId);

  if (isLoading || isSampleDataLoading || isSampleDataInputLoading) {
    return (
      <div className="bg-background flex h-full w-full items-center justify-center ">
        <LoadingSpinner isLarge={true}></LoadingSpinner>
      </div>
    );
  }

  if (isNil(flow) || isError) {
    return <NotAvailablePage />;
  }

  return (
    <ReactFlowProvider>
      <BuilderStateProvider
        flow={flow}
        flowVersion={flow!.version}
        readonly={!canEditFlow}
        run={null}
        outputSampleData={sampleData ?? {}}
        inputSampleData={sampleDataInput ?? {}}
      >
        <FlowCollaborationWrapper flowId={flowId} />
        <BuilderPage />
      </BuilderStateProvider>
    </ReactFlowProvider>
  );
};

// Wrapper component to use the collaboration hook inside the provider context
const FlowCollaborationWrapper = ({ flowId }: { flowId: string | undefined }) => {
  useFlowCollaboration(flowId);
  return null;
};

export { FlowBuilderPage };
