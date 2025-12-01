import { ExportRequestBody, PrincipalType, Solution } from '@activepieces/shared'
import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { StatusCodes } from 'http-status-codes'
import { assertProjectId } from '../../authentication/authentication-utils'
import { solutionService } from './solution.service'

export const solutionsController: FastifyPluginAsyncTypebox = async (fastify) => {
    fastify.post('/export', ExportRequest, async (request) => {
        assertProjectId(request.principal)
        const { name, description } = request.body
        return solutionService(fastify.log).export({
            projectId: request.principal.projectId,
            name,
            description,
        })
    })

    fastify.post('/import', ImportRequest, async (request) => {
        assertProjectId(request.principal)
        return solutionService(fastify.log).import({
            solution: request.body as Solution,
            projectId: request.principal.projectId,
            platformId: request.principal.platform.id,
        })
    })
}


const ExportRequest = {
    config: {
        allowedPrincipals: [PrincipalType.USER] as const,
    },
    schema: {
        body: ExportRequestBody,
        response: {
            [StatusCodes.CREATED]: Solution,
        },
    },
}

const ImportRequest = {
    config: {
        allowedPrincipals: [PrincipalType.USER] as const,
    },
    schema: {
        body: Solution,
    },
}
