import {
    ApId,
    ListFlowActivitiesQueryParams,
    PrincipalType,
} from '@activepieces/shared'
import {
    FastifyPluginAsyncTypebox,
    Type,
} from '@fastify/type-provider-typebox'
import { flowActivityService } from './flow-activity.service'

const DEFAULT_LIMIT = 20

export const flowActivityController: FastifyPluginAsyncTypebox = async (app) => {
    app.get('/', ListFlowActivitiesRequest, async (request) => {
        return flowActivityService(request.log).list({
            flowId: request.params.flowId,
            projectId: request.principal.projectId,
            limit: request.query.limit ?? DEFAULT_LIMIT,
            cursor: request.query.cursor ?? null,
            action: request.query.action,
            userId: request.query.userId,
            createdAfter: request.query.createdAfter,
            createdBefore: request.query.createdBefore,
            search: request.query.search,
        })
    })
}

const ListFlowActivitiesRequest = {
    schema: {
        params: Type.Object({
            flowId: ApId,
        }),
        querystring: Type.Omit(ListFlowActivitiesQueryParams, ['flowId']),
    },
    config: {
        allowedPrincipals: [PrincipalType.USER, PrincipalType.SERVICE] as const,
    },
}

