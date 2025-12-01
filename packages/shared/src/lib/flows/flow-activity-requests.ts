import { Static, Type } from '@sinclair/typebox'
import { ApId } from '../common/id-generator'

export const ListFlowActivitiesQueryParams = Type.Object({
    flowId: Type.Optional(ApId),
    cursor: Type.Optional(Type.String()),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
    actionType: Type.Optional(Type.String()),
})

export type ListFlowActivitiesQueryParams = Static<typeof ListFlowActivitiesQueryParams>

