import { EndpointScope, ListProjectRequestForUserQueryParams, PiecesFilterType, PrincipalType, Project, ProjectPlan, ProjectUsage, ProjectWithLimits, SeekPage, UpdateProjectRequestInCommunity } from '@activepieces/shared'
import { FastifyPluginAsyncTypebox, Type } from '@fastify/type-provider-typebox'
import { StatusCodes } from 'http-status-codes'
import { paginationHelper } from '../helper/pagination/pagination-utils'
import { projectService } from './project-service'

/**
 * Converts a Project to ProjectWithLimits with stub values for Community Edition.
 * In CE, we don't have plan/usage/analytics, so we provide defaults.
 */
function projectToProjectWithLimits(project: Project): ProjectWithLimits {
    const stubPlan: ProjectPlan = {
        id: project.id,
        created: project.created,
        updated: project.updated,
        projectId: project.id,
        locked: false,
        name: 'Community',
        piecesFilterType: PiecesFilterType.NONE,
        pieces: [],
        aiCredits: null,
    }

    const stubUsage: ProjectUsage = {
        aiCredits: 0,
        nextLimitResetDate: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days from now
    }

    const stubAnalytics = {
        totalUsers: 0,
        activeUsers: 0,
        totalFlows: 0,
        activeFlows: 0,
    }

    // Remove 'deleted' field if it exists
    const { deleted, ...projectWithoutDeleted } = project

    return {
        ...projectWithoutDeleted,
        plan: stubPlan,
        usage: stubUsage,
        analytics: stubAnalytics,
    }
}

export const userProjectController: FastifyPluginAsyncTypebox = async (fastify) => {
    fastify.log.info('Registering GET / route in userProjectController (Community Edition)')
    // Register '/' BEFORE '/:id' to ensure exact match routes are handled first
    fastify.get('/', {
        config: {
            allowedPrincipals: [PrincipalType.USER] as const,
            scope: EndpointScope.PLATFORM,
        },
        schema: {
            querystring: ListProjectRequestForUserQueryParams,
            response: {
                [StatusCodes.OK]: SeekPage(ProjectWithLimits),
            },
        },
    }, async (request) => {
        const { authenticationUtils } = await import('../authentication/authentication-utils')
        const userId = await authenticationUtils.extractUserIdFromPrincipal(request.principal)
        if (!userId) {
            throw new Error('User ID not found')
        }
        
        fastify.log.info({
            method: request.method,
            url: request.url,
            userId,
            platformId: request.principal.platform.id,
        }, 'Listing projects for user - route handler called (Community Edition)')
        try {
            const projects = await projectService.getAllForUser({
                platformId: request.principal.platform.id,
                userId,
                displayName: request.query.displayName,
            })
            // Return as a paginated page
            // Simple pagination - for CE, we'll just return all projects in one page
            // In the future, we can implement proper cursor-based pagination
            // For now, pass null as cursor since we're not implementing pagination yet
            fastify.log.info(`Projects retrieved successfully: ${projects.length} projects`)
            const projectsWithLimits = projects.map(projectToProjectWithLimits)
            // Return paginated response with null cursor (no pagination implemented yet)
            return paginationHelper.createPage(projectsWithLimits, null)
        } catch (error) {
            fastify.log.error({ error }, 'Error retrieving projects')
            throw error
        }
    })

    fastify.get('/:id', {
        config: {
            allowedPrincipals: [PrincipalType.USER] as const,
        },
        schema: {
            params: Type.Object({
                id: Type.String(),
            }),
            response: {
                [StatusCodes.OK]: Project,
            },
        },
    }, async (request) => {
        return projectService.getOneOrThrow(request.params.id)
    })
}

export const projectController: FastifyPluginAsyncTypebox = async (fastify) => {
    fastify.post('/:id', UpdateProjectRequest, async (request) => {
        return projectService.update(request.params.id, request.body)
    })
}

const UpdateProjectRequest = {
    config: {
        allowedPrincipals: [PrincipalType.USER, PrincipalType.SERVICE] as const,
        scope: EndpointScope.PLATFORM,
    },
    schema: {
        tags: ['projects'],
        params: Type.Object({
            id: Type.String(),
        }),
        response: {
            [StatusCodes.OK]: Project,
        },
        body: UpdateProjectRequestInCommunity,
    },
}
