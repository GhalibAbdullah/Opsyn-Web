import { api } from '@/lib/api';
import {
    FlowCommentWithUser,
    FlowId,
    ListFlowCommentsQueryParams,
    SeekPage,
    CreateFlowCommentRequestBody,
    UpdateFlowCommentRequestBody,
} from '@activepieces/shared';

export const flowCommentApi = {
    list(
        flowId: FlowId,
        request: Omit<ListFlowCommentsQueryParams, 'flowId'>,
    ): Promise<SeekPage<FlowCommentWithUser>> {
        return api.get<SeekPage<FlowCommentWithUser>>(
            `/v1/flows/${flowId}/comments`,
            request,
        );
    },

    create(
        flowId: FlowId,
        request: CreateFlowCommentRequestBody,
    ): Promise<FlowCommentWithUser> {
        return api.post<FlowCommentWithUser>(
            `/v1/flows/${flowId}/comments`,
            request,
        );
    },

    update(
        flowId: FlowId,
        commentId: string,
        request: UpdateFlowCommentRequestBody,
    ): Promise<FlowCommentWithUser> {
        return api.patch<FlowCommentWithUser>(
            `/v1/flows/${flowId}/comments/${commentId}`,
            request,
        );
    },

    delete(flowId: FlowId, commentId: string): Promise<void> {
        return api.delete(`/v1/flows/${flowId}/comments/${commentId}`);
    },
};

