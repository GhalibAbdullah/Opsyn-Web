import { Static, Type } from '@sinclair/typebox'
import { ApId } from '../common/id-generator'
import { FlowActivityAction } from './flow-activity'

export const ListFlowActivitiesQueryParams = Type.Object({
    flowId: Type.Optional(ApId),
    cursor: Type.Optional(Type.String()),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
    action: Type.Optional(Type.Array(Type.Enum(FlowActivityAction))),
    userId: Type.Optional(ApId),
    createdAfter: Type.Optional(Type.String({ format: 'date-time' })),
    createdBefore: Type.Optional(Type.String({ format: 'date-time' })),
    search: Type.Optional(Type.String()),
})

export type ListFlowActivitiesQueryParams = Static<typeof ListFlowActivitiesQueryParams>

