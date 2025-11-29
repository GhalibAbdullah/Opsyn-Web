import { FlowId, ProjectId, WebsocketClientEvent } from '@activepieces/shared';
import { FastifyBaseLogger } from 'fastify';
import { Server } from 'socket.io';

export const flowCommentSideEffects = (_log: FastifyBaseLogger) => ({
    async notifyCommentCreated({ socket, flowId, projectId, commentId }: NotifyCommentCreatedParams) {
        const request = {
            flowId,
            commentId,
        };
        socket.to(projectId).emit(WebsocketClientEvent.FLOW_COMMENT_CREATED, request);
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

