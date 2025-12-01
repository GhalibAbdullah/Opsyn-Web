import {
    ApId,
    ListFlowActivitiesQueryParams,
    PrincipalType,
    SeekPage,
} from '@activepieces/shared'
import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { Type } from '@sinclair/typebox'
import { StatusCodes } from 'http-status-codes'
import { flowActivityService } from './flow-activity.service'
import { FlowActivityWithUser } from '@activepieces/shared'

const DEFAULT_LIMIT = 50

export const flowActivityController: FastifyPluginAsyncTypebox = async (app) => {
    app.get('/', ListFlowActivitiesRequest, async (request) => {
        // flowId comes from route params (/:flowId/activity)
        const flowId = request.params.flowId
        return flowActivityService(request.log).list({
            projectId: request.principal.projectId!,
            flowId,
            cursorRequest: request.query.cursor ?? null,
            limit: request.query.limit ?? DEFAULT_LIMIT,
            actionType: request.query.actionType,
        })
    })
}

const ListFlowActivitiesRequest = {
    config: {
        allowedPrincipals: [PrincipalType.USER] as const,
    },
    schema: {
        tags: ['flow-activity'],
        description: 'List flow activities',
        params: Type.Object({
            flowId: ApId,
        }),
        querystring: Type.Omit(ListFlowActivitiesQueryParams, ['flowId']),
        response: {
            [StatusCodes.OK]: SeekPage(FlowActivityWithUser),
        },
    },
}

