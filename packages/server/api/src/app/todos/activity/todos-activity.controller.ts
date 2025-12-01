import { CreateTodoActivityRequestBody, ListTodoActivitiesQueryParams, PrincipalType } from '@activepieces/shared'
import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { assertProjectId } from '../../authentication/authentication-utils'
import { todoActivitiesService as todoActivityService } from './todos-activity.service'

const DEFAULT_LIMIT = 10
const DEFAULT_CURSOR = null

export const todoActivityController: FastifyPluginAsyncTypebox = async (app) => {
    app.get('/', ListTodoCommentsRequest, async (request) => {
        assertProjectId(request.principal)
        return todoActivityService(request.log).list({
            todoId: request.query.todoId,
            platformId: request.principal.platform.id,
            projectId: request.principal.projectId,
            limit: request.query.limit ?? DEFAULT_LIMIT,
            cursor: request.query.cursor ?? DEFAULT_CURSOR,
        })
    })

    app.post('/', CreateTodoCommentRequest, async (request) => {
        assertProjectId(request.principal)
        const { content } = request.body
        return todoActivityService(request.log).create({
            content,
            platformId: request.principal.platform.id,
            projectId: request.principal.projectId,
            userId: request.principal.id,
            todoId: request.body.todoId,
            socket: app.io,
        })
    })
}

const ListTodoCommentsRequest = {
    schema: {
        querystring: ListTodoActivitiesQueryParams,
    },
    config: {
        allowedPrincipals: [PrincipalType.USER] as const,
    },
}


const CreateTodoCommentRequest = {
    schema: {
        body: CreateTodoActivityRequestBody,
    },
    config: {
        allowedPrincipals: [PrincipalType.USER] as const,
    },
}
