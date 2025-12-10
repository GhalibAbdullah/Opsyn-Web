import { AIProviderWithoutSensitiveData, CreateAIProviderRequest } from '@activepieces/common-ai'
import { ActivepiecesError, ErrorCode, PrincipalType, SeekPage } from '@activepieces/shared'
import { FastifyPluginAsyncTypebox, Type } from '@fastify/type-provider-typebox'
import { StatusCodes } from 'http-status-codes'
import { aiProviderService } from './ai-provider-service'
import { projectService } from '../project/project-service'

export const aiProviderController: FastifyPluginAsyncTypebox = async (app) => {
    app.get('/', ListAIProviders, async (request) => {
        const platformId = request.principal.platform.id
        const projectId = request.principal.projectId ?? undefined
        // Only check ownership for USER principals, ENGINE principals should be able to list providers
        if (request.principal.type === PrincipalType.USER) {
            await assertOwner(projectId, request.principal.id)
        }
        return aiProviderService.list(platformId, projectId)
    })
    app.post('/', CreateAIProvider, async (request, reply) => {
        const platformId = request.principal.platform.id
        const projectId = request.principal.projectId ?? undefined
        await assertOwner(projectId, request.principal.id)
        await aiProviderService.upsert(platformId, request.body, projectId)
        return reply.status(StatusCodes.NO_CONTENT).send()
    })
    app.delete('/:id', DeleteAIProvider, async (request) => {
        const platformId = request.principal.platform.id
        const projectId = request.principal.projectId ?? undefined
        await assertOwner(projectId, request.principal.id)
        // The :id param is actually the provider name (e.g., "google")
        return aiProviderService.delete(platformId, request.params.id, projectId)
    })
}

async function assertOwner(projectId: string | undefined, userId: string): Promise<void> {
    if (!projectId) {
        throw new ActivepiecesError({
            code: ErrorCode.AUTHORIZATION,
            params: { message: 'Project context is required for AI providers' },
        })
    }
    const project = await projectService.getOneOrThrow(projectId)
    if (project.ownerId !== userId) {
        throw new ActivepiecesError({
            code: ErrorCode.AUTHORIZATION,
            params: { message: 'Only project owners can manage AI providers' },
        })
    }
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
