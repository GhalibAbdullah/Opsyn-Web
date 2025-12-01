import { Static, Type } from '@sinclair/typebox'
import { BaseModelSchema, Nullable } from '../common/base-model'
import { ApId } from '../common/id-generator'
import { UserWithMetaInformation } from '../user'

export enum FlowActivityAction {
    CREATED = 'CREATED',
    UPDATED = 'UPDATED',
    DELETED = 'DELETED',
    PUBLISHED = 'PUBLISHED',
    UNPUBLISHED = 'UNPUBLISHED',
    STATUS_CHANGED = 'STATUS_CHANGED',
    NAME_CHANGED = 'NAME_CHANGED',
    STEP_ADDED = 'STEP_ADDED',
    STEP_REMOVED = 'STEP_REMOVED',
    STEP_UPDATED = 'STEP_UPDATED',
}

export const FlowActivity = Type.Object({
    ...BaseModelSchema,
    projectId: ApId,
    flowId: ApId,
    userId: Nullable(ApId),
    actionType: Type.String(),
    metadata: Nullable(Type.Record(Type.String(), Type.Unknown())),
})

export type FlowActivity = Static<typeof FlowActivity>

export const FlowActivityWithUser = Type.Composite([
    FlowActivity,
    Type.Object({
        user: Nullable(UserWithMetaInformation),
    }),
])

export type FlowActivityWithUser = Static<typeof FlowActivityWithUser>

