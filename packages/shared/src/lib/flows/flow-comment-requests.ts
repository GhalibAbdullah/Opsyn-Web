import { Static, Type } from '@sinclair/typebox';
import { ApId } from '../common/id-generator';
import { Nullable } from '../common/base-model';

export const ListFlowCommentsQueryParams = Type.Object({
    flowId: Type.Optional(ApId), // Optional because it can come from route params
    stepName: Type.Optional(Type.String()),
    parentCommentId: Type.Optional(ApId), // Filter by parent comment for replies
    cursor: Type.Optional(Type.String()),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
});

export type ListFlowCommentsQueryParams = Static<typeof ListFlowCommentsQueryParams>;

export const CreateFlowCommentRequestBody = Type.Object({
    flowId: ApId,
    content: Type.String(),
    stepName: Type.Optional(Nullable(Type.String())),
    parentCommentId: Type.Optional(Nullable(ApId)),
});

export type CreateFlowCommentRequestBody = Static<typeof CreateFlowCommentRequestBody>;

export const UpdateFlowCommentRequestBody = Type.Object({
    content: Type.String(),
});

export type UpdateFlowCommentRequestBody = Static<typeof UpdateFlowCommentRequestBody>;

