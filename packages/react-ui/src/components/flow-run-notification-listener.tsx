import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FlowRunFinishedNotification,
  FlowRunStatus,
  WebsocketClientEvent,
} from '@activepieces/shared';

import { authenticationSession } from '@/lib/authentication-session';

import { useSocket } from './socket-provider';
import { toast } from './ui/use-toast';

export const FlowRunNotificationListener = () => {
  const socket = useSocket();
  const navigate = useNavigate();

  useEffect(() => {
    const handleFlowRunNotification = (
      notification: FlowRunFinishedNotification,
    ) => {
      const isSuccess = notification.status === FlowRunStatus.SUCCEEDED;
      const isFailed = [
        FlowRunStatus.FAILED,
        FlowRunStatus.INTERNAL_ERROR,
        FlowRunStatus.QUOTA_EXCEEDED,
        FlowRunStatus.TIMEOUT,
        FlowRunStatus.MEMORY_LIMIT_EXCEEDED,
      ].includes(notification.status as FlowRunStatus);

      // Only show notifications for success and failure
      if (!isSuccess && !isFailed) {
        return;
      }

      const title = isSuccess
        ? `✓ ${notification.flowDisplayName} completed`
        : `✗ ${notification.flowDisplayName} failed`;

      const description = isFailed
        ? notification.errorMessage || 'An error occurred during execution'
        : 'Flow run completed successfully';

      toast({
        title,
        description,
        variant: isFailed ? 'destructive' : 'default',
        duration: 5000,
        action: (
          <button
            className="text-sm font-medium underline hover:no-underline"
            onClick={() => {
              navigate(
                authenticationSession.appendProjectRoutePrefix(
                  `/runs/${notification.flowRunId}`,
                ),
              );
            }}
          >
            View Run
          </button>
        ),
      });
    };

    socket.on(
      WebsocketClientEvent.FLOW_RUN_FINISHED_NOTIFICATION,
      handleFlowRunNotification,
    );

    return () => {
      socket.off(
        WebsocketClientEvent.FLOW_RUN_FINISHED_NOTIFICATION,
        handleFlowRunNotification,
      );
    };
  }, [socket, navigate]);

  return null;
};

