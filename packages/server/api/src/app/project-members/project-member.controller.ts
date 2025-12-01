import {
    ActivepiecesError,
    ApId,
    ErrorCode,
    PrincipalType,
    SeekPage,
    WebsocketClientEvent,
} from '@activepieces/shared'
import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { Type } from '@sinclair/typebox'
import { StatusCodes } from 'http-status-codes'
import { assertCanManageTeam } from '../authentication/permission-helpers'
import { authenticationUtils } from '../authentication/authentication-utils'
import { projectMemberService, ProjectMemberWithUser } from './project-member.service'
import { ProjectMemberRole } from './project-member.entity'
import { app as globalApp } from '../server'

const DEFAULT_LIMIT_SIZE = 10

export const projectMemberController: FastifyPluginAsyncTypebox = async (
    app,
) => {
    app.get('/role', GetCurrentProjectMemberRoleRequest, async (request) => {
        const userId = await authenticationUtils.extractUserIdFromPrincipal(request.principal)
        if (!userId) {
            throw new Error('User ID not found')
        }
        const role = await projectMemberService(request.log).getRole({
            projectId: request.principal.projectId!,
            userId,
        })
        return { role: role ?? 'EDITOR' }
    })

    app.get('/', ListProjectMembersRequestQueryOptions, async (request) => {
        // Accept projectId from query parameter or principal
        const projectId = request.query.projectId ?? request.principal.projectId
        if (!projectId) {
            throw new ActivepiecesError({
                code: ErrorCode.VALIDATION,
                params: {
                    message: 'Project ID is required',
                },
            })
        }
        return projectMemberService(request.log).list({
            platformId: request.principal.platform.id,
            projectId,
            cursorRequest: request.query.cursor ?? null,
            limit: request.query.limit ?? DEFAULT_LIMIT_SIZE,
        })
    })

    app.post('/', CreateProjectMemberRequest, async (request, reply) => {
        const userId = await authenticationUtils.extractUserIdFromPrincipal(request.principal)
        if (!userId) {
            throw new Error('User ID not found')
        }
        await assertCanManageTeam(request.principal.projectId!, userId, request.log)

        const member = await projectMemberService(request.log).create({
            userId: request.body.userId,
            projectId: request.principal.projectId!,
            role: request.body.role,
        })

        // Broadcast project members changed event
        if (globalApp?.io) {
            globalApp.io.to(request.principal.projectId!).emit(WebsocketClientEvent.PROJECT_MEMBERS_CHANGED, {
                projectId: request.principal.projectId!,
            })
        }

        return reply.status(StatusCodes.CREATED).send(member)
    })

    app.post('/:id', UpdateProjectMemberRoleRequest, async (request) => {
        const userId = await authenticationUtils.extractUserIdFromPrincipal(request.principal)
        if (!userId) {
            throw new Error('User ID not found')
        }
        await assertCanManageTeam(request.principal.projectId!, userId, request.log)

        // Check if this is a virtual member (starts with "virtual-")
        if (request.params.id.startsWith('virtual-')) {
            // Extract the actual user ID from the virtual ID
            const actualUserId = request.params.id.replace('virtual-', '')
            
            // Create a new ProjectMember record for this user
            const member = await projectMemberService(request.log).create({
                userId: actualUserId,
                projectId: request.principal.projectId!,
                role: request.body.role,
            })

            return member
        }

        // Update existing member
        const member = await projectMemberService(request.log).update({
            id: request.params.id,
            projectId: request.principal.projectId!,
            role: request.body.role,
        })

        // Broadcast project members changed event
        if (globalApp?.io) {
            globalApp.io.to(request.principal.projectId!).emit(WebsocketClientEvent.PROJECT_MEMBERS_CHANGED, {
                projectId: request.principal.projectId!,
            })
        }

        return member
    })

    app.delete('/:id', DeleteProjectMemberRequest, async (request, reply) => {
        const userId = await authenticationUtils.extractUserIdFromPrincipal(request.principal)
        if (!userId) {
            throw new Error('User ID not found')
        }
        await assertCanManageTeam(request.principal.projectId!, userId, request.log)

        // Virtual members (without DB records) are project owners shown for convenience
        // They can't be deleted through this endpoint (project owner access is inherent)
        if (request.params.id.startsWith('virtual-')) {
            // Virtual members represent project owners who don't have explicit ProjectMember records
            // They can't be removed via this endpoint since their access comes from project.ownerId
            throw new ActivepiecesError({
                code: ErrorCode.VALIDATION,
                params: {
                    message: 'Cannot remove project owner. Transfer project ownership first.',
                },
            })
        }

        await projectMemberService(request.log).delete({
            id: request.params.id,
            projectId: request.principal.projectId!,
        })
        
        // Broadcast project members changed event
        if (globalApp?.io) {
            globalApp.io.to(request.principal.projectId!).emit(WebsocketClientEvent.PROJECT_MEMBERS_CHANGED, {
                projectId: request.principal.projectId!,
            })
        }
        
        await reply.status(StatusCodes.NO_CONTENT).send()
    })
}

const GetCurrentProjectMemberRoleRequest = {
    config: {
        allowedPrincipals: [PrincipalType.USER] as const,
    },
    schema: {
        tags: ['project-members'],
        response: {
            [StatusCodes.OK]: Type.Object({
                role: Type.Union([
                    Type.Literal('OWNER'),
                    Type.Literal('EDITOR'),
                    Type.Literal('VIEWER'),
                ]),
            }),
        },
    },
}

const ListProjectMembersRequestQueryOptions = {
    config: {
        allowedPrincipals: [PrincipalType.USER] as const,
    },
    schema: {
        tags: ['project-members'],
        querystring: Type.Object({
            projectId: Type.Optional(Type.String()),
            cursor: Type.Optional(Type.String()),
            limit: Type.Optional(Type.Number()),
        }),
        response: {
            [StatusCodes.OK]: SeekPage(Type.Any()),
        },
    },
}

const CreateProjectMemberRequest = {
    config: {
        allowedPrincipals: [PrincipalType.USER] as const,
    },
    schema: {
        tags: ['project-members'],
        body: Type.Object({
            userId: ApId,
            role: Type.Union([
                Type.Literal('OWNER'),
                Type.Literal('EDITOR'),
                Type.Literal('VIEWER'),
            ]),
        }),
        response: {
            [StatusCodes.CREATED]: Type.Any(), // ProjectMember type
        },
    },
}

const UpdateProjectMemberRoleRequest = {
    config: {
        allowedPrincipals: [PrincipalType.USER] as const,
    },
    schema: {
        tags: ['project-members'],
        params: Type.Object({
            id: Type.String(),
        }),
        body: Type.Object({
            role: Type.Union([
                Type.Literal('OWNER'),
                Type.Literal('EDITOR'),
                Type.Literal('VIEWER'),
            ]),
        }),
        response: {
            [StatusCodes.OK]: Type.Any(), // ProjectMember type
        },
    },
}

const DeleteProjectMemberRequest = {
    config: {
        allowedPrincipals: [PrincipalType.USER] as const,
    },
    schema: {
        tags: ['project-members'],
        response: {
            [StatusCodes.NO_CONTENT]: Type.Never(),
        },
        params: Type.Object({
            id: Type.String(),
        }),
    },
}

