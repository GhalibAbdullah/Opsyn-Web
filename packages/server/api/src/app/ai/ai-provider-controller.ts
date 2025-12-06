import { AIProviderWithoutSensitiveData, CreateAIProviderRequest } from '@activepieces/common-ai'
import { PrincipalType, SeekPage } from '@activepieces/shared'
import { FastifyPluginAsyncTypebox, Type } from '@fastify/type-provider-typebox'
import { StatusCodes } from 'http-status-codes'
import { aiProviderService } from './ai-provider-service'

export const aiProviderController: FastifyPluginAsyncTypebox = async (app) => {
    app.get('/', ListAIProviders, async (request) => {
        const platformId = request.principal.platform.id
        const projectId = request.principal.projectId ?? undefined
        return aiProviderService.list(platformId, projectId)
    })
    app.post('/', CreateAIProvider, async (request, reply) => {
        const platformId = request.principal.platform.id
        const projectId = request.principal.projectId ?? undefined
        await aiProviderService.upsert(platformId, request.body, projectId)
        return reply.status(StatusCodes.NO_CONTENT).send()
    })
    app.delete('/:id', DeleteAIProvider, async (request) => {
        const platformId = request.principal.platform.id
        const projectId = request.principal.projectId ?? undefined
        // The :id param is actually the provider name (e.g., "google")
        return aiProviderService.delete(platformId, request.params.id, projectId)
    })
}

const ListAIProviders = {
    config: {
        allowedPrincipals: [PrincipalType.USER, PrincipalType.ENGINE] as const,
    },
    schema: {
        response: {
            [StatusCodes.OK]: SeekPage(AIProviderWithoutSensitiveData),
        },
    },
}

const CreateAIProvider = {
    config: {
        allowedPrincipals: [PrincipalType.USER] as const,
    },
    schema: {
        body: CreateAIProviderRequest,
    },
}

const DeleteAIProvider = {
    config: {
        allowedPrincipals: [PrincipalType.USER] as const,
    },
    schema: {
        params: Type.Object({
            id: Type.String(),
        }),
    },
}
