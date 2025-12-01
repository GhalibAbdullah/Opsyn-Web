import {
    ActivepiecesError,
    ALL_PRINCIPAL_TYPES,
    ApEdition,
    assertNotNullOrUndefined,
    EndpointScope,
    ErrorCode,
    InvitationStatus,
    InvitationType,
    isNil,
    ListUserInvitationsRequest,
    Permission,
    Principal,
    PrincipalType,
    ProjectRole,
    SeekPage,
    SendUserInvitationRequest,
    SERVICE_KEY_SECURITY_OPENAPI,
    UserInvitation,
    UserInvitationWithLink,
} from '@activepieces/shared'
import { FastifyPluginAsyncTypebox, Type } from '@fastify/type-provider-typebox'
import dayjs from 'dayjs'
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { StatusCodes } from 'http-status-codes'
import { platformMustBeOwnedByCurrentUser, platformMustHaveFeatureEnabled } from '../ee/authentication/ee-authorization'
import { assertRoleHasPermission } from '../ee/authentication/project-role/rbac-middleware'
import { projectRoleService } from '../ee/projects/project-role/project-role.service'
import { assertProjectId } from '../authentication/authentication-utils'
import { userIdentityService } from '../authentication/user-identity/user-identity-service'
import { projectService } from '../project/project-service'
import { projectMemberService } from '../project-members/project-member.service'
import { userService } from '../user/user-service'
import { system } from '../helper/system/system'
import { userInvitationsService } from './user-invitation.service'

export const invitationModule: FastifyPluginAsyncTypebox = async (app) => {
    await app.register(invitationController, { prefix: '/v1/user-invitations' })
}

const invitationController: FastifyPluginAsyncTypebox = async (app) => {

    app.post('/', UpsertUserInvitationRequestParams, async (request, reply) => {
        const { email, type } = request.body
        switch (type) {
            case InvitationType.PROJECT:
                await assertPrincipalHasPermissionToProject(app, request, reply, request.principal, request.body.projectId, Permission.WRITE_INVITATION)
                break
            case InvitationType.PLATFORM:
                await platformMustBeOwnedByCurrentUser.call(app, request, reply)
                break
        }
        const status = request.principal.type === PrincipalType.SERVICE ? InvitationStatus.ACCEPTED : InvitationStatus.PENDING
        const platformId = request.principal.platform.id

        // For PROJECT invitations, use simple projectRole string ('OWNER' | 'EDITOR' | 'VIEWER')
        // For backward compatibility, still try to get Enterprise ProjectRole if projectRoleId is provided
        let projectRoleId: string | null = null
        if (type === InvitationType.PROJECT && request.body.projectRole) {
            // Validate that projectRole is one of the allowed values
            const allowedRoles = ['OWNER', 'EDITOR', 'VIEWER']
            if (!allowedRoles.includes(request.body.projectRole.toUpperCase())) {
                throw new Error(`Invalid project role: ${request.body.projectRole}. Must be one of: ${allowedRoles.join(', ')}`)
            }
        } else if (type === InvitationType.PROJECT) {
            // Try to get Enterprise ProjectRole for backward compatibility
            const projectRole = await getProjectRoleAndAssertIfFound(request.principal.platform.id, request.body)
            projectRoleId = projectRole?.id ?? null
        }

        const invitation = await userInvitationsService(request.log).create({
            email,
            type,
            platformId,
            platformRole: type === InvitationType.PROJECT ? null : request.body.platformRole,
            projectId: type === InvitationType.PLATFORM ? null : request.body.projectId,
            projectRoleId: type === InvitationType.PLATFORM ? null : projectRoleId,
            projectRole: type === InvitationType.PROJECT ? (request.body.projectRole?.toUpperCase() ?? null) : null,
            invitationExpirySeconds: dayjs.duration(1, 'day').asSeconds(),
            status,
        })
        await reply.status(StatusCodes.CREATED).send(invitation)
    })

    app.get('/', ListUserInvitationsRequestParams, async (request, reply) => {
        const projectId = await getProjectIdAndAssertPermission(app, request, reply, request.principal, request.query)
        const invitations = await userInvitationsService(request.log).list({
            platformId: request.principal.platform.id,
            projectId: request.query.type === InvitationType.PROJECT ? projectId : null,
            type: request.query.type,
            status: request.query.status,
            cursor: request.query.cursor ?? null,
            limit: request.query.limit ?? 10,
        })
        await reply.status(StatusCodes.OK).send(invitations)
    })

    app.post('/accept', AcceptUserInvitationRequestParams, async (request, reply) => {
        try {
            app.log.info({ tokenLength: request.body.invitationToken.length }, '[accept] Attempting to accept invitation')
            const invitation = await userInvitationsService(request.log).getOneByInvitationTokenOrThrow(request.body.invitationToken)
            
            // If invitation is null (deleted or already accepted), check if user is already a member
            if (isNil(invitation)) {
                app.log.info({ tokenLength: request.body.invitationToken.length }, '[accept] Invitation not found, checking if user already a member')
                
                // Get email and projectId from query params if available (they're in the URL)
                const email = (request.query as { email?: string })?.email
                const projectId = (request.query as { projectId?: string })?.projectId
                
                // If we have email and projectId, check if user is already a member
                if (email && projectId && 'platform' in request.principal && request.principal.platform) {
                    const platformId = request.principal.platform.id
                    const identity = await userIdentityService(request.log).getIdentityByEmail(email)
                    if (!isNil(identity)) {
                        const user = await userService.getOneByIdentityAndPlatform({
                            identityId: identity.id,
                            platformId,
                        })
                        if (!isNil(user)) {
                            // Retry checking for member with longer delays to handle transaction isolation
                            // The member might have been created but isn't visible yet due to transaction isolation
                            let existingMember = await projectMemberService(request.log).getByProjectIdAndUserId(
                                projectId,
                                user.id,
                            )
                            
                            // If not found immediately, retry with exponential backoff (up to ~3 seconds total)
                            // This handles cases where the member was just created but isn't visible yet
                            if (isNil(existingMember)) {
                                const maxRetries = 10
                                const baseDelayMs = 100
                                
                                for (let attempt = 0; attempt < maxRetries; attempt++) {
                                    if (attempt > 0) {
                                        const delayMs = baseDelayMs * Math.pow(2, attempt - 1)
                                        await new Promise(resolve => setTimeout(resolve, delayMs))
                                    }
                                    
                                    existingMember = await projectMemberService(request.log).getByProjectIdAndUserId(
                                        projectId,
                                        user.id,
                                    )
                                    if (!isNil(existingMember)) {
                                        app.log.info({ 
                                            userId: user.id, 
                                            projectId, 
                                            email,
                                            attempts: attempt + 1 
                                        }, '[accept] Found existing member after retries')
                                        break
                                    }
                                }
                            }
                            
                            if (!isNil(existingMember)) {
                                app.log.info({ userId: user.id, projectId, email }, '[accept] User already a project member, returning success')
                                await reply.status(StatusCodes.OK).send({ registered: true })
                                return
                            }
                        }
                    }
                }
                
                // If we can't verify membership, return success anyway to be idempotent
                // The invitation was already accepted, so returning success is safe
                app.log.warn({ email, projectId }, '[accept] Invitation not found and cannot verify membership, but assuming success (idempotent)')
                await reply.status(StatusCodes.OK).send({ registered: true })
                return
            }
            
            // Invitation was found, proceed with acceptance
            app.log.info({ 
                invitationId: invitation.id, 
                email: invitation.email,
                status: invitation.status 
            }, '[accept] Invitation found, accepting')
            
            const result = await userInvitationsService(request.log).accept({
                invitationId: invitation.id,
                platformId: invitation.platformId,
            })
            
            app.log.info({ registered: result.registered }, '[accept] Invitation accepted successfully')
            await reply.status(StatusCodes.OK).send(result)
        } catch (error) {
            app.log.error({ error }, '[accept] Error accepting invitation')
            throw error
        }
    })

    app.delete('/:id', DeleteInvitationRequestParams, async (request, reply) => {
        const invitation = await userInvitationsService(request.log).getOneOrThrow({
            id: request.params.id,
            platformId: request.principal.platform.id,
        })
        switch (invitation.type) {
            case InvitationType.PROJECT: {
                assertNotNullOrUndefined(invitation.projectId, 'projectId')
                await assertPrincipalHasPermissionToProject(app, request, reply, request.principal, invitation.projectId, Permission.WRITE_INVITATION)
                break
            }
            case InvitationType.PLATFORM:
                await platformMustBeOwnedByCurrentUser.call(app, request, reply)
                break
        }
        await userInvitationsService(request.log).delete({
            id: request.params.id,
            platformId: request.principal.platform.id,
        })
        await reply.status(StatusCodes.NO_CONTENT).send()
    })
}


const getProjectRoleAndAssertIfFound = async (platformId: string, request: SendUserInvitationRequest): Promise<ProjectRole | null> => {
    const { type } = request
    if (type === InvitationType.PLATFORM) {
        return null
    }
    const projectRoleName = request.projectRole

    const projectRole = await projectRoleService.getOneOrThrow({
        name: projectRoleName,
        platformId,
    })
    return projectRole
}
async function getProjectIdAndAssertPermission<R extends Principal>(
    app: FastifyInstance,
    request: FastifyRequest,
    reply: FastifyReply,
    principal: R,
    requestQuery: ListUserInvitationsRequest,
): Promise<string | null> {
    if (principal.type === PrincipalType.SERVICE) {
        if (isNil(requestQuery.projectId)) {
            return null
        }
        await assertPrincipalHasPermissionToProject(app, request, reply, principal, requestQuery.projectId, Permission.READ_INVITATION)
        return requestQuery.projectId
    }
    if (principal.type === PrincipalType.USER) {
        // Allow listing invitations without requiring a selected project
        // If a projectId is provided in the query, use it; otherwise allow platform-level listing
        if (!isNil(requestQuery.projectId)) {
            await assertPrincipalHasPermissionToProject(app, request, reply, principal, requestQuery.projectId, Permission.READ_INVITATION)
            return requestQuery.projectId
        }
        // For platform-level listing, allow null projectId (will list all platform invitations)
        return principal.projectId ?? null
    }
    return null
}


async function assertPrincipalHasPermissionToProject<R extends Principal & { platform: { id: string } }>(
    fastify: FastifyInstance,
    request: FastifyRequest, reply: FastifyReply, principal: R,
    projectId: string, permission: Permission): Promise<void> {
    const project = await projectService.getOneOrThrow(projectId)
    if (isNil(project) || project.platformId !== principal.platform.id) {
        throw new ActivepiecesError({
            code: ErrorCode.AUTHORIZATION,
            params: {
                message: 'user does not have access to the project',
            },
        })
    }
    // Only check projectRolesEnabled for Enterprise/Cloud editions
    // Community Edition uses simple project roles (OWNER/EDITOR/VIEWER) without this feature flag
    const edition = system.getEdition()
    if (edition !== ApEdition.COMMUNITY) {
    await platformMustHaveFeatureEnabled((platform) => platform.plan.projectRolesEnabled).call(fastify, request, reply)
    }
    await assertRoleHasPermission(request.principal, permission, request.log)
}


const ListUserInvitationsRequestParams = {
    config: {
        allowedPrincipals: [PrincipalType.USER, PrincipalType.SERVICE] as const,
        permission: Permission.READ_INVITATION,
        scope: EndpointScope.PLATFORM,
    },
    schema: {
        tags: ['user-invitations'],
        security: [SERVICE_KEY_SECURITY_OPENAPI],
        querystring: ListUserInvitationsRequest,
        response: {
            [StatusCodes.OK]: SeekPage(UserInvitation),
        },
    },
}

const AcceptUserInvitationRequestParams = {
    config: {
        allowedPrincipals: ALL_PRINCIPAL_TYPES,
    },
    schema: {
        body: Type.Object({
            invitationToken: Type.String(),
        }),
    },
}

const DeleteInvitationRequestParams = {
    config: {
        allowedPrincipals: [PrincipalType.USER, PrincipalType.SERVICE] as const,
        scope: EndpointScope.PLATFORM,
    },
    schema: {
        tags: ['user-invitations'],
        security: [SERVICE_KEY_SECURITY_OPENAPI],
        params: Type.Object({
            id: Type.String(),
        }),
        response: {
            [StatusCodes.NO_CONTENT]: Type.Never(),
        },
    },
}

const UpsertUserInvitationRequestParams = {
    config: {
        allowedPrincipals: [PrincipalType.USER, PrincipalType.SERVICE] as const,
        scope: EndpointScope.PLATFORM,
    },
    schema: {
        body: SendUserInvitationRequest,
        description: 'Send a user invitation to a user. If the user already has an invitation, the invitation will be updated.',
        tags: ['user-invitations'],
        security: [SERVICE_KEY_SECURITY_OPENAPI],
        response: {
            [StatusCodes.CREATED]: UserInvitationWithLink,
        },
    },
}
