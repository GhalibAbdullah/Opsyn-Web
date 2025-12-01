import { FlowId, ProjectId, WebsocketClientEvent } from '@activepieces/shared';
import { FastifyBaseLogger } from 'fastify';
import { Server } from 'socket.io';

export const flowCommentSideEffects = (_log: FastifyBaseLogger) => ({
    async notifyCommentCreated({ socket, flowId, projectId, commentId, mentionedUserIds }: NotifyCommentCreatedParams) {
        const request = {
            flowId,
            commentId,
            mentionedUserIds: mentionedUserIds || [],
        };
        socket.to(projectId).emit(WebsocketClientEvent.FLOW_COMMENT_CREATED, request);
        
        // Notify mentioned users specifically
        if (mentionedUserIds && mentionedUserIds.length > 0) {
            mentionedUserIds.forEach((userId) => {
                socket.to(userId).emit(WebsocketClientEvent.FLOW_COMMENT_MENTION, request);
            });
        }
    },

    async notifyCommentChanged({ socket, projectId, commentId, flowId, content }: NotifyCommentChangedParams) {
        const request = {
            commentId,
            flowId,
            content,
        };
        socket.to(projectId).emit(WebsocketClientEvent.FLOW_COMMENT_CHANGED, request);
    },

    async notifyCommentDeleted({ socket, projectId, commentId, flowId }: NotifyCommentDeletedParams) {
        const request = {
            commentId,
            flowId,
        };
        socket.to(projectId).emit(WebsocketClientEvent.FLOW_COMMENT_DELETED, request);
    },
});

type NotifyCommentCreatedParams = {
    socket: Server;
    projectId: ProjectId;
    flowId: FlowId;
    commentId: string;
    mentionedUserIds?: string[];
};

type NotifyCommentChangedParams = {
    socket: Server;
    projectId: ProjectId;
    commentId: string;
    flowId: FlowId;
    content: string;
};

type NotifyCommentDeletedParams = {
    socket: Server;
    projectId: ProjectId;
    commentId: string;
    flowId: FlowId;
};

