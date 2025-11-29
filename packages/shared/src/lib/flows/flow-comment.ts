import { Static, Type } from '@sinclair/typebox';
import { BaseModelSchema, Nullable } from '../common/base-model';
import { ApId } from '../common/id-generator';
import { UserWithMetaInformation } from '../user';

export const FlowComment = Type.Object({
    ...BaseModelSchema,
    flowId: ApId,
    userId: Nullable(ApId),
    content: Type.String(),
    stepName: Nullable(Type.String()), // Optional: null means workflow-level comment, otherwise step-level
    parentCommentId: Nullable(ApId), // Optional: null means top-level comment, otherwise reply
});

export type FlowComment = Static<typeof FlowComment>;

export const FlowCommentWithUser = Type.Composite([
    FlowComment,
    Type.Object({
        user: Nullable(UserWithMetaInformation),
    }),
]);

export type FlowCommentWithUser = Static<typeof FlowCommentWithUser>;

