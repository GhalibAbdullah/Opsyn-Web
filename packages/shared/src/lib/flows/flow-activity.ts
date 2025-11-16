import { Static, Type } from '@sinclair/typebox'
import { BaseModelSchema, Nullable } from '../common/base-model'
import { UserWithMetaInformation } from '../user'

export enum FlowActivityAction {
    CREATED = 'CREATED',
    UPDATED = 'UPDATED',
    DELETED = 'DELETED',
    PUBLISHED = 'PUBLISHED',
    STATUS_CHANGED = 'STATUS_CHANGED',
    FOLDER_CHANGED = 'FOLDER_CHANGED',
    NAME_CHANGED = 'NAME_CHANGED',
    METADATA_UPDATED = 'METADATA_UPDATED',
    TRIGGER_UPDATED = 'TRIGGER_UPDATED',
    ACTION_ADDED = 'ACTION_ADDED',
    ACTION_UPDATED = 'ACTION_UPDATED',
    ACTION_DELETED = 'ACTION_DELETED',
    ACTION_MOVED = 'ACTION_MOVED',
    ACTION_DUPLICATED = 'ACTION_DUPLICATED',
    BRANCH_ADDED = 'BRANCH_ADDED',
    BRANCH_DELETED = 'BRANCH_DELETED',
    BRANCH_DUPLICATED = 'BRANCH_DUPLICATED',
}

export const FlowActivity = Type.Object({
    ...BaseModelSchema,
    flowId: Type.String(),
    projectId: Type.String(),
    userId: Nullable(Type.String()),
    action: Type.Enum(FlowActivityAction),
    operationType: Nullable(Type.String()),
    details: Type.Optional(Type.Record(Type.String(), Type.Any())),
    message: Type.String(),
})

export type FlowActivity = Static<typeof FlowActivity>

export const FlowActivityWithUser = Type.Composite([
    FlowActivity,
    Type.Object({
        user: Nullable(UserWithMetaInformation),
    }),
])

export type FlowActivityWithUser = Static<typeof FlowActivityWithUser>

