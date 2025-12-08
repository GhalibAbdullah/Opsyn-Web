import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { flowCommentApi } from './flow-comment-api';
import {
    FlowCommentWithUser,
    ListFlowCommentsQueryParams,
    SeekPage,
    CreateFlowCommentRequestBody,
    UpdateFlowCommentRequestBody,
    WebsocketClientEvent,
} from '@activepieces/shared';
import { useEffect } from 'react';
import { useSocket } from '@/components/socket-provider';

const createFlowCommentQueryKey = (
    flowId: string,
    params: Omit<ListFlowCommentsQueryParams, 'flowId'>,
) => ['flow-comments', flowId, params];

export const flowCommentHooks = {
    useFlowComments: (
        flowId: string | undefined,
        params: Omit<ListFlowCommentsQueryParams, 'flowId'> & { enabled?: boolean } = {},
    ) => {
        const { enabled: enabledParam, ...queryParams } = params;
        const queryClient = useQueryClient();
        const socket = useSocket();

        const commentQueryKey = createFlowCommentQueryKey(flowId || '', queryParams)

        const query = useQuery<SeekPage<FlowCommentWithUser>>({
            queryKey: commentQueryKey,
            queryFn: async () => {
                if (!flowId) {
                    throw new Error('Flow ID is required');
                }
                return await flowCommentApi.list(flowId, queryParams);
            },
            enabled: (enabledParam !== undefined ? enabledParam : true) && !!flowId,
            staleTime: 5 * 1000, // Consider data stale after 5 seconds
            retry: 1, // Only retry once on error
            retryOnMount: false, // Don't retry when component remounts
        });

        // Subscribe to WebSocket events for real-time updates
        useEffect(() => {
            if (!socket || !flowId) return;

            const handleCommentCreated = (data: { flowId: string; commentId: string }) => {
                if (data.flowId === flowId) {
                    queryClient.invalidateQueries({
                        queryKey: commentQueryKey,
                    });
                }
            };

            const handleCommentChanged = (data: { flowId: string; commentId: string; content: string }) => {
                if (data.flowId === flowId) {
                    queryClient.invalidateQueries({
                        queryKey: commentQueryKey,
                    });
                }
            };

            const handleCommentDeleted = (data: { flowId: string; commentId: string }) => {
                if (data.flowId === flowId) {
                    queryClient.invalidateQueries({
                        queryKey: commentQueryKey,
                    });
                }
            };

            socket.on(WebsocketClientEvent.FLOW_COMMENT_CREATED, handleCommentCreated);
            socket.on(WebsocketClientEvent.FLOW_COMMENT_CHANGED, handleCommentChanged);
            socket.on(WebsocketClientEvent.FLOW_COMMENT_DELETED, handleCommentDeleted);

            return () => {
                socket.off(WebsocketClientEvent.FLOW_COMMENT_CREATED, handleCommentCreated);
                socket.off(WebsocketClientEvent.FLOW_COMMENT_CHANGED, handleCommentChanged);
                socket.off(WebsocketClientEvent.FLOW_COMMENT_DELETED, handleCommentDeleted);
            };
        }, [socket, flowId, queryClient]);

        return query;
    },

    useCreateFlowComment: () => {
        const queryClient = useQueryClient();

        return useMutation({
            mutationFn: ({
                flowId,
                request,
            }: {
                flowId: string;
                request: CreateFlowCommentRequestBody;
            }) => flowCommentApi.create(flowId, request),
            onSuccess: (_, variables) => {
                queryClient.invalidateQueries({
                    queryKey: ['flow-comments', variables.flowId],
                });
            },
        });
    },

    useUpdateFlowComment: () => {
        const queryClient = useQueryClient();

        return useMutation({
            mutationFn: ({
                flowId,
                commentId,
                request,
            }: {
                flowId: string;
                commentId: string;
                request: UpdateFlowCommentRequestBody;
            }) => flowCommentApi.update(flowId, commentId, request),
            onSuccess: (_, variables) => {
                queryClient.invalidateQueries({
                    queryKey: ['flow-comments', variables.flowId],
                });
            },
        });
    },

    useDeleteFlowComment: () => {
        const queryClient = useQueryClient();

        return useMutation({
            mutationFn: ({
                flowId,
                commentId,
            }: {
                flowId: string;
                commentId: string;
            }) => flowCommentApi.delete(flowId, commentId),
            onSuccess: (_, variables) => {
                queryClient.invalidateQueries({
                    queryKey: ['flow-comments', variables.flowId],
                });
            },
        });
    },
};

