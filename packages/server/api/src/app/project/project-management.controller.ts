import {
    ApId,
    ApEdition,
    EndpointScope,
    PrincipalType,
    Project,
    ProjectId,
    SeekPage,
} from '@activepieces/shared'
import { FastifyPluginAsyncTypebox, Type } from '@fastify/type-provider-typebox'
import { StatusCodes } from 'http-status-codes'
import { system } from '../helper/system/system'
import { paginationHelper } from '../helper/pagination/pagination-utils'
import { projectService } from './project-service'
import { authenticationUtils } from '../authentication/authentication-utils'
import { assertCanManageTeam } from '../authentication/permission-helpers'

/**
 * CE-only project management controller.
 * This provides project CRUD operations without using Enterprise code.
 * For open-source compliance - no imports from ee/ packages.
 */
export const projectManagementController: FastifyPluginAsyncTypebox = async (app) => {
    const edition = system.getEdition()
    
    app.log.info(`projectManagementController: edition is ${edition}`)
    // Only register in Community Edition
    if (edition !== ApEdition.COMMUNITY) {
        app.log.info('projectManagementController: skipping registration (not Community Edition)')
        return
    }
    
    app.log.info('projectManagementController: registering routes for Community Edition')

    // List all projects user has access to
    app.get('/', ListProjectsRequest, async (request) => {
        const userId = await authenticationUtils.extractUserIdFromPrincipal(request.principal)
        if (!userId) {
            throw new Error('User ID not found')
        }

        app.log.info({
            userId,
            platformId: request.principal.platform.id,
        }, 'Listing projects for user - route handler called (Community Edition)')

        const projects = await projectService.getAllForUser({
            platformId: request.principal.platform.id,
            userId,
        })

        app.log.info(`Projects retrieved successfully: ${projects.length} projects`)
        
        // Return as a page (for consistency with frontend)
        return paginationHelper.createPage(projects, null)
    })

    // Create a new project
    app.post('/', CreateProjectRequest, async (request, reply) => {
        app.log.info({
            method: request.method,
            url: request.url,
            userId: request.principal.id,
            platformId: request.principal.platform.id,
            body: request.body,
        }, 'Creating project - route handler called (Community Edition)')
        try {
            const userId = await authenticationUtils.extractUserIdFromPrincipal(request.principal)
            if (!userId) {
                throw new Error('User ID not found')
            }

            // In CE, any user can create projects (or restrict to platform admins if needed)
            // For now, allow all authenticated users to create projects
            app.log.info(`Creating project with displayName: ${request.body.displayName}`)
            const newProject = await projectService.create({
                ownerId: userId,
                displayName: request.body.displayName,
                platformId: request.principal.platform.id,
                externalId: request.body.externalId ?? undefined,
                metadata: request.body.metadata ?? undefined,
            })

            app.log.info({
                projectId: newProject.id,
                ownerId: newProject.ownerId,
                platformId: newProject.platformId,
                displayName: newProject.displayName,
            }, 'Project created successfully - verifying it can be found')
            
            // Verify the project can be retrieved immediately
            const verifyProject = await projectService.getOneOrThrow(newProject.id)
            app.log.info({
                verifiedProjectId: verifyProject.id,
                verifiedOwnerId: verifyProject.ownerId,
            }, 'Project verified - can be retrieved')
            
            await reply.status(StatusCodes.CREATED).send(newProject)
        } catch (error) {
            app.log.error({ error }, 'Error creating project')
            throw error
        }
    })

    // Update a project (use PATCH for RESTful consistency, POST is handled by projectController)
    app.patch('/:id', UpdateProjectRequest, async (request) => {
        const userId = await authenticationUtils.extractUserIdFromPrincipal(request.principal)
        if (!userId) {
            throw new Error('User ID not found')
        }

        const projectId = request.params.id as ProjectId
        
        // Check if user is project owner or has OWNER role
        const project = await projectService.getOneOrThrow(projectId)
        if (project.ownerId !== userId) {
            // Check if user has OWNER role via ProjectMember
            await assertCanManageTeam(projectId, userId, request.log)
        }

        return projectService.update(projectId, {
            displayName: request.body.displayName,
            externalId: request.body.externalId,
            metadata: request.body.metadata,
            releasesEnabled: request.body.releasesEnabled,
        })
    })

    // Delete a project
    app.delete('/:id', DeleteProjectRequest, async (request, reply) => {
        const userId = await authenticationUtils.extractUserIdFromPrincipal(request.principal)
        if (!userId) {
            throw new Error('User ID not found')
        }

        const projectId = request.params.id as ProjectId
        
        // Check if user is project owner or has OWNER role
        const project = await projectService.getOneOrThrow(projectId)
        if (project.ownerId !== userId) {
            // Check if user has OWNER role via ProjectMember
            await assertCanManageTeam(projectId, userId, request.log)
        }

        // Soft delete the project
        await projectService.delete(projectId)
        await reply.status(StatusCodes.NO_CONTENT).send()
    })
}

const ListProjectsRequest = {
    config: {
        allowedPrincipals: [PrincipalType.USER] as const,
        scope: EndpointScope.PLATFORM,
    },
    schema: {
        tags: ['projects'],
        querystring: Type.Object({
            cursor: Type.Optional(Type.String()),
            limit: Type.Optional(Type.Number()),
            displayName: Type.Optional(Type.String()),
        }),
        response: {
            [StatusCodes.OK]: SeekPage(Project),
        },
    },
}

const CreateProjectRequest = {
    config: {
        allowedPrincipals: [PrincipalType.USER] as const,
        scope: EndpointScope.PLATFORM,
    },
    schema: {
        tags: ['projects'],
        body: Type.Object({
            displayName: Type.String(),
            externalId: Type.Optional(Type.String()),
            metadata: Type.Optional(Type.Record(Type.String(), Type.Any())),
        }),
        response: {
            [StatusCodes.CREATED]: Project,
        },
    },
}

const UpdateProjectRequest = {
    config: {
        allowedPrincipals: [PrincipalType.USER] as const,
        scope: EndpointScope.PLATFORM,
    },
    schema: {
        tags: ['projects'],
        params: Type.Object({
            id: ApId,
        }),
        body: Type.Object({
            displayName: Type.Optional(Type.String()),
            externalId: Type.Optional(Type.String()),
            metadata: Type.Optional(Type.Record(Type.String(), Type.Any())),
            releasesEnabled: Type.Optional(Type.Boolean()),
        }),
        response: {
            [StatusCodes.OK]: Project,
        },
    },
}

const DeleteProjectRequest = {
    config: {
        allowedPrincipals: [PrincipalType.USER] as const,
        scope: EndpointScope.PLATFORM,
    },
    schema: {
        tags: ['projects'],
        params: Type.Object({
            id: ApId,
        }),
        response: {
            [StatusCodes.NO_CONTENT]: Type.Never(),
        },
    },
}

