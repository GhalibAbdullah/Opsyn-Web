import { useEffect, useState, useRef } from 'react';
import { useSocket } from '@/components/socket-provider';
import { FlowEditorsChanged, FlowEditorInfo, WebsocketClientEvent } from '@activepieces/shared';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/user-avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { t } from 'i18next';

export const ActiveEditorsBadge = ({ flowId }: { flowId: string | undefined }) => {
  const socket = useSocket();
  const [activeEditors, setActiveEditors] = useState<FlowEditorInfo[]>([]);
  const hasReceivedEditorsRef = useRef(false);
  const previousFlowIdRef = useRef<string | undefined>(undefined);

  // Use ref to track current flowId to avoid stale closures
  const flowIdRef = useRef<string | undefined>(flowId);
  useEffect(() => {
    flowIdRef.current = flowId;
  }, [flowId]);

  useEffect(() => {
    if (!flowId) {
      setActiveEditors([]); // Clear when no flowId
      hasReceivedEditorsRef.current = false;
      return;
    }

    // Don't clear editors immediately - wait to see if we receive an event
    // This prevents the badge from disappearing briefly when flowId changes
    hasReceivedEditorsRef.current = false;

    const handleEditorsChanged = (data: FlowEditorsChanged) => {
      const currentFlowId = flowIdRef.current;
      if (data.flowId === currentFlowId) {
        setActiveEditors(data.editors || []);
        hasReceivedEditorsRef.current = true;
      }
    };

    // Set up listener IMMEDIATELY (before anything else)
    // This is critical to catch events that might be sent right after FLOW_EDITOR_JOINED
    socket.on(WebsocketClientEvent.FLOW_EDITORS_CHANGED, handleEditorsChanged);

    // Clear editors only when flowId actually changes (not on every render)
    if (previousFlowIdRef.current !== flowId) {
      if (previousFlowIdRef.current !== undefined) {
        // Only clear if we had a previous flowId (not on initial mount)
        setActiveEditors([]);
      }
      previousFlowIdRef.current = flowId;
    }

    // Request current editors list after a delay to ensure the listener is set up
    // This is a fallback in case we missed the initial event
    // We use 300ms to ensure it runs after the backend's 200ms delay
    const requestTimeout = setTimeout(() => {
      if (!hasReceivedEditorsRef.current && socket.connected && flowId) {
        // Re-emit FLOW_EDITOR_JOINED to trigger the backend to send the current editors list
        // This is safe because the backend handles duplicate joins gracefully
        socket.emit('FLOW_EDITOR_JOINED' as any, { flowId });
      }
    }, 300);

    return () => {
      clearTimeout(requestTimeout);
      socket.off(WebsocketClientEvent.FLOW_EDITORS_CHANGED, handleEditorsChanged);
    };
  }, [flowId, socket]);

  if (activeEditors.length === 0) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="flex items-center gap-2 px-2 py-1">
            <div className="flex -space-x-2">
              {activeEditors.slice(0, 3).map((editor) => (
                <UserAvatar
                  key={editor.userId}
                  name={editor.userName}
                  email={editor.userEmail}
                  size={20}
                  disableTooltip={true}
                />
              ))}
            </div>
            <span className="text-xs">
              {activeEditors.length === 1
                ? '1 person editing'
                : `${activeEditors.length} people editing`}
            </span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="flex flex-col gap-1">
            <p className="font-semibold text-sm">{t('Active editors')}</p>
            {activeEditors.map((editor) => (
              <div key={editor.userId} className="flex items-center gap-2">
                <UserAvatar
                  name={editor.userName}
                  email={editor.userEmail}
                  size={16}
                  disableTooltip={true}
                />
                <span className="text-xs">{editor.userName}</span>
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

