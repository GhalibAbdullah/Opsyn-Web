import { WorkerSystemProp } from '@activepieces/server-shared'
import { ActivepiecesError, apId, assertNotNullOrUndefined, ErrorCode, InvitationStatus, InvitationType, isNil, Platform, PlatformRole, SeekPage, spreadIfDefined, User, UserIdentity, UserInvitation, UserInvitationWithLink } from '@activepieces/shared'
import { FastifyBaseLogger } from 'fastify'
import { IsNull } from 'typeorm'
import { userIdentityService } from '../authentication/user-identity/user-identity-service'
import { repoFactory } from '../core/db/repo-factory'
import { getSmtpConfig } from '../helper/community-email'
import { system } from '../helper/system/system'
import { projectMemberService } from '../project-members/project-member.service'
import { jwtUtils } from '../helper/jwt-utils'
import { buildPaginator } from '../helper/pagination/build-paginator'
import { paginationHelper } from '../helper/pagination/pagination-utils'
import { platformService } from '../platform/platform.service'
import { projectService } from '../project/project-service'
import { userService } from '../user/user-service'
import { communityInvitationEmailService } from './community-invitation-email'
import { UserInvitationEntity } from './user-invitation.entity'

const repo = repoFactory(UserInvitationEntity)

export const userInvitationsService = (log: FastifyBaseLogger) => ({
    async getOneByInvitationTokenOrThrow(invitationToken: string): Promise<UserInvitation | null> {
        try {
            const decodedToken = await jwtUtils.decodeAndVerify<UserInvitationToken>({
                jwt: invitationToken,
                key: await jwtUtils.getJwtSecret(),
            })
            log.info({ invitationId: decodedToken.id }, '[getOneByInvitationTokenOrThrow] Decoded token')
            
            const invitation = await repo().findOneBy({
                id: decodedToken.id,
            })
            
            if (isNil(invitation)) {
                log.warn({ invitationId: decodedToken.id }, '[getOneByInvitationTokenOrThrow] Invitation not found - may have been deleted or already accepted')
                // Return null instead of throwing - let the accept method handle it
                return null
            }
            
            // Allow accepting already-accepted invitations (idempotent)
            // This handles cases where the user clicks the link multiple times
            // or the invitation was accepted but the frontend didn't get the response
            if (invitation.status === InvitationStatus.ACCEPTED) {
                log.info({ 
                    invitationId: invitation.id, 
                    status: invitation.status,
                    email: invitation.email 
                }, '[getOneByInvitationTokenOrThrow] Invitation already accepted, but allowing idempotent acceptance')
            }
            
            log.info({ 
                invitationId: invitation.id, 
                status: invitation.status,
                email: invitation.email 
            }, '[getOneByInvitationTokenOrThrow] Found invitation')
            
            return invitation
        } catch (error) {
            log.error({ error, tokenLength: invitationToken.length }, '[getOneByInvitationTokenOrThrow] Error decoding or finding invitation')
            if (error instanceof ActivepiecesError) {
                throw error
            }
            // If JWT verification fails, throw a more user-friendly error
            throw new ActivepiecesError({
                code: ErrorCode.INVALID_BEARER_TOKEN,
                params: {
                    message: 'Invalid or expired invitation token',
                },
            })
        }
    },
    async provisionUserInvitation({ email }: ProvisionUserInvitationParams): Promise<void> {
        const identity = await userIdentityService(log).getIdentityByEmail(email)
        if (isNil(identity)) {
            return
        }
        const invitations = await repo().createQueryBuilder('user_invitation')
            .where('LOWER("user_invitation"."email") = :email', { email: email.toLowerCase().trim() })
            .andWhere({
                status: InvitationStatus.ACCEPTED,
            })
            .getMany()

        log.info({ count: invitations.length }, '[provisionUserInvitation] list invitations')
        for (const invitation of invitations) {
            log.info({ invitation }, '[provisionUserInvitation] provision')
            const user = await getOrCreateUser(identity, invitation.platformId)
            switch (invitation.type) {
                case InvitationType.PLATFORM: {
                    assertNotNullOrUndefined(invitation.platformRole, 'platformRole')
                    await userService.update({
                        id: user.id,
                        platformId: invitation.platformId,
                        platformRole: invitation.platformRole,
                    })
                    break
                }
                case InvitationType.PROJECT: {
                    const { projectId, projectRole, projectRoleId } = invitation
                    assertNotNullOrUndefined(projectId, 'projectId')
                    
                    let roleToUse: 'OWNER' | 'EDITOR' | 'VIEWER' | null = null

                    if (projectRole && ['OWNER', 'EDITOR', 'VIEWER'].includes(projectRole.toUpperCase())) {
                        roleToUse = projectRole.toUpperCase() as 'OWNER' | 'EDITOR' | 'VIEWER'
                    }
                    
                    if (!roleToUse) {
                        throw new ActivepiecesError({
                            code: ErrorCode.VALIDATION,
                            params: {
                                message: 'Project role is required and must be OWNER, EDITOR, or VIEWER',
                            },
                        })
                    }

                    const project = await projectService.exists({
                        projectId,
                        isSoftDeleted: false,
                    })
                    if (!isNil(project)) {
                        try {
                            await projectMemberService(log).create({
                                projectId,
                                userId: user.id,
                                role: roleToUse,
                            })
                            
                            // Wait for the member to become visible before deleting the invitation
                            // This ensures that when the project query runs, the member is visible
                            // Use exponential backoff with up to ~2 seconds total wait time
                            const maxRetries = 8
                            const baseDelayMs = 100
                            let memberVisible = false
                            
                            for (let attempt = 0; attempt < maxRetries; attempt++) {
                                if (attempt > 0) {
                                    const delayMs = baseDelayMs * Math.pow(2, attempt - 1)
                                    await new Promise(resolve => setTimeout(resolve, delayMs))
                                }
                                
                                const visibleMember = await projectMemberService(log).getByProjectIdAndUserId(
                                    projectId,
                                    user.id,
                                )
                                
                                if (!isNil(visibleMember)) {
                                    memberVisible = true
                                    log.info({ 
                                        projectId, 
                                        userId: user.id,
                                        attempts: attempt + 1 
                                    }, '[provisionUserInvitation] Project member is now visible')
                                    break
                                }
                            }
                            
                            if (!memberVisible) {
                                log.warn({ 
                                    projectId, 
                                    userId: user.id 
                                }, '[provisionUserInvitation] Project member not visible after retries, but continuing (member was created)')
                            }
                        } catch (createError) {
                            // If creation fails but member might already exist, check if it exists
                            const existingMember = await projectMemberService(log).getByProjectIdAndUserId(
                                projectId,
                                user.id,
                            )
                            if (isNil(existingMember)) {
                                // Member doesn't exist and creation failed - log error but continue
                                // The invitation was accepted, so we don't want to fail the whole operation
                                log.error({ 
                                    error: createError, 
                                    projectId, 
                                    userId: user.id,
                                    role: roleToUse 
                                }, '[provisionUserInvitation] Failed to create project member, but invitation was accepted')
                            } else {
                                // Member already exists - that's fine, it's idempotent
                                log.info({ 
                                    projectId, 
                                    userId: user.id 
                                }, '[provisionUserInvitation] Project member already exists (idempotent)')
                            }
                        }
                    }
                    break
                }
            }
            await repo().delete({
                id: invitation.id,
            })
        }
    },
    async create({
        email,
        platformId,
        projectId,
        type,
        projectRoleId,
        projectRole,
        platformRole,
        invitationExpirySeconds,
        status,
    }: CreateParams): Promise<UserInvitationWithLink> {
        const platform = await platformService.getOneOrThrow(platformId)
        const id = apId()
        await repo().upsert({
            id,
            status,
            type,
            email: email.toLowerCase().trim(),
            platformId,
            projectRoleId: type === InvitationType.PLATFORM ? undefined : projectRoleId ?? undefined,
            projectRole: type === InvitationType.PROJECT ? projectRole ?? undefined : undefined,
            platformRole: type === InvitationType.PROJECT ? undefined : platformRole!,
            projectId: type === InvitationType.PLATFORM ? undefined : projectId!,
        }, ['email', 'platformId', 'projectId'])

        const userInvitation = await this.getOneOrThrow({
            id,
            platformId,
        })
        if (status === InvitationStatus.ACCEPTED) {
            await this.accept({
                invitationId: id,
                platformId,
            })
            return userInvitation
        }
        return enrichWithInvitationLink(platform, userInvitation, invitationExpirySeconds, log)
    },
    async list(params: ListUserParams): Promise<SeekPage<UserInvitation>> {
        const decodedCursor = paginationHelper.decodeCursor(params.cursor ?? null)
        const paginator = buildPaginator({
            entity: UserInvitationEntity,
            query: {
                limit: params.limit,
                order: 'ASC',
                afterCursor: decodedCursor.nextCursor,
                beforeCursor: decodedCursor.previousCursor,
            },
        })
        const queryBuilder = repo().createQueryBuilder('user_invitation')
            .where({
                platformId: params.platformId,
                ...spreadIfDefined('projectId', params.projectId),
                ...spreadIfDefined('status', params.status),
                ...spreadIfDefined('type', params.type),
            })
        const { data, cursor } = await paginator.paginate(queryBuilder)
        return paginationHelper.createPage<UserInvitation>(data, cursor)
    },
    async delete({ id, platformId }: PlatformAndIdParams): Promise<void> {
        const invitation = await this.getOneOrThrow({ id, platformId })
        await repo().delete({
            id: invitation.id,
            platformId,
        })
    },
    async getOneOrThrow({ id, platformId }: PlatformAndIdParams): Promise<UserInvitation> {
        const invitation = await repo().findOne({
            where: {
                id,
                platformId,
            },
        })
        if (isNil(invitation)) {
            throw new ActivepiecesError({
                code: ErrorCode.ENTITY_NOT_FOUND,
                params: {
                    entityId: `id=${id}`,
                    entityType: 'UserInvitation',
                },
            })
        }
        return invitation
    },
    async acceptByIdempotent({ invitationId, invitationToken }: { invitationId: string, invitationToken: string }): Promise<{ registered: boolean } | null> {
        // Try to find the invitation by ID first
        const invitation = await repo().findOneBy({ id: invitationId })
        
        if (!isNil(invitation)) {
            // If invitation exists, use the regular accept flow
            return this.accept({
                invitationId: invitation.id,
                platformId: invitation.platformId,
            })
        }
        
        // Invitation is deleted, but check if user was already provisioned
        // We need to decode the token to get the email
        try {
            const decodedToken = await jwtUtils.decodeAndVerify<UserInvitationToken>({
                jwt: invitationToken,
                key: await jwtUtils.getJwtSecret(),
            })
            
            // Try to find any accepted invitation with this ID in the past
            // Since we can't query deleted records easily, we'll check if the user is already a member
            // by looking up invitations that were accepted for this email
            // For now, we'll return null and let the caller handle it
            // The real solution is to check project membership directly
            log.info({ invitationId }, '[acceptByIdempotent] Invitation deleted, cannot verify idempotency without invitation data')
            return null
        } catch (error) {
            log.error({ error, invitationId }, '[acceptByIdempotent] Error decoding token')
            return null
        }
    },
    
    async accept({ invitationId, platformId }: AcceptParams): Promise<{ registered: boolean; platformId?: string; projectId?: string }> {
        const invitation = await this.getOneOrThrow({ id: invitationId, platformId })
        
        // If already accepted, check if user is already provisioned and return success
        if (invitation.status === InvitationStatus.ACCEPTED) {
            log.info({ invitationId, email: invitation.email }, '[accept] Invitation already accepted, checking if user is provisioned')
            const identity = await userIdentityService(log).getIdentityByEmail(invitation.email)
            if (isNil(identity)) {
                return {
                    registered: false,
                }
            }
            // Check if user is already a member (for project invitations)
            if (invitation.type === InvitationType.PROJECT && invitation.projectId) {
                const user = await userService.getOneByIdentityAndPlatform({
                    identityId: identity.id,
                    platformId: invitation.platformId,
                })
                if (!isNil(user)) {
                    const existingMember = await projectMemberService(log).getByProjectIdAndUserId(
                        invitation.projectId,
                        user.id,
                    )
                    if (!isNil(existingMember)) {
                        log.info({ invitationId, userId: user.id, projectId: invitation.projectId }, '[accept] User already a project member, returning success')
                        return {
                            registered: true,
                            platformId: invitation.platformId,
                            projectId: invitation.projectId,
                        }
                    }
                }
            }
            // Re-provision to ensure everything is set up correctly
            await this.provisionUserInvitation({
                email: invitation.email,
            })
            return {
                registered: true,
                platformId: invitation.platformId,
                projectId: invitation.projectId ?? undefined,
            }
        }
        
        // First time acceptance
        await repo().update(invitation.id, {
            status: InvitationStatus.ACCEPTED,
        })
        const identity = await userIdentityService(log).getIdentityByEmail(invitation.email)
        if (isNil(identity)) {
            return {
                registered: false,
            }
        }
        await this.provisionUserInvitation({
            email: invitation.email,
        })
        return {
            registered: true,
            platformId: invitation.platformId,
            projectId: invitation.projectId ?? undefined,
        }
    },
    async hasAnyAcceptedInvitations({
        email,
        platformId,
    }: HasAnyAcceptedInvitationsParams): Promise<boolean> {
        const invitations = await repo().createQueryBuilder().where({
            platformId,
            status: InvitationStatus.ACCEPTED,
        }).andWhere('LOWER(user_invitation.email) = :email', { email: email.toLowerCase().trim() })
            .getMany()
        return invitations.length > 0
    },
    async getByEmailAndPlatformIdOrThrow({
        email,
        platformId,
        projectId,
    }: GetOneByPlatformIdAndEmailParams): Promise<UserInvitation | null> {
        return repo().findOneBy({
            email,
            platformId,
            projectId: isNil(projectId) ? IsNull() : projectId,
        })
    },
})


async function getOrCreateUser(identity: UserIdentity, platformId: string): Promise<User> {
    const user = await userService.getOneByIdentityAndPlatform({
        identityId: identity.id,
        platformId,
    })
    if (isNil(user)) {
        try {
            return await userService.create({
                identityId: identity.id,
                platformId,
                platformRole: PlatformRole.MEMBER,
            })
        } catch (error: any) {
            // Handle race condition: if two requests try to create the same user simultaneously,
            // the second one will hit a UNIQUE constraint. In that case, fetch and return the existing user.
            const message: string = error?.message ?? ''
            const driverMessage: string = error?.driverError?.message ?? ''
            const isUniqueConstraintError =
                error?.code === 'SQLITE_CONSTRAINT' ||
                error?.errno === 19 ||
                error?.code === '23505' ||
                (error?.driverError &&
                    (error.driverError.code === 'SQLITE_CONSTRAINT' ||
                        error.driverError.code === '23505')) ||
                message.includes('UNIQUE constraint failed: user.platformId, user.identityId') ||
                driverMessage.includes('UNIQUE constraint failed: user.platformId, user.identityId')
            
            if (isUniqueConstraintError) {
                // User was created by another concurrent request - fetch and return it
                const existingUser = await userService.getOneByIdentityAndPlatform({
                    identityId: identity.id,
                    platformId,
                })
                if (!isNil(existingUser)) {
                    return existingUser
                }
                // If still not found after retry, wait a bit and try once more (transaction isolation)
                await new Promise(resolve => setTimeout(resolve, 100))
                const retryUser = await userService.getOneByIdentityAndPlatform({
                    identityId: identity.id,
                    platformId,
                })
                if (!isNil(retryUser)) {
                    return retryUser
                }
            }
            // Re-throw if it's not a constraint error or if we still can't find the user
            throw error
        }
    }
    return user
}
async function generateInvitationLink(userInvitation: UserInvitation, expireyInSeconds: number): Promise<string> {
    const token = await jwtUtils.sign({
        payload: {
            id: userInvitation.id,
        },
        expiresInSeconds: expireyInSeconds,
        key: await jwtUtils.getJwtSecret(),
    })

    // URL encode the token to handle special characters safely
    const encodedToken = encodeURIComponent(token)
    
    const projectIdParam = userInvitation.projectId ? `&projectId=${userInvitation.projectId}` : ''
    const frontendUrl = system.getOrThrow(WorkerSystemProp.FRONTEND_URL).replace(/\/+$/, '')
    return `${frontendUrl}/invitation?token=${encodedToken}&email=${encodeURIComponent(userInvitation.email)}${projectIdParam}`
}
const enrichWithInvitationLink = async (platform: Platform, userInvitation: UserInvitation, expireyInSeconds: number, log: FastifyBaseLogger) => {
    const invitationLink = await generateInvitationLink(userInvitation, expireyInSeconds)
    
    // Always include the link in the response so users can copy it if needed
    const invitationWithLink: UserInvitationWithLink = {
            ...userInvitation,
            link: invitationLink,
        }
    
    try {
        await communityInvitationEmailService(log).sendInvitation({
            userInvitation,
            invitationLink,
        })
    }
    catch (error) {
        log.warn({ error }, 'Failed to send invitation email, but link is still available')
    }
    
    return invitationWithLink
}
type ListUserParams = {
    platformId: string
    type: InvitationType
    projectId: string | null
    status?: InvitationStatus
    limit: number
    cursor: string | null
}

type HasAnyAcceptedInvitationsParams = {
    email: string
    platformId: string
}
type ProvisionUserInvitationParams = {
    email: string
}

type PlatformAndIdParams = {
    id: string
    platformId: string
}
export type UserInvitationToken = {
    id: string
}

type AcceptParams = {
    invitationId: string
    platformId: string
}

type CreateParams = {
    email: string
    platformId: string
    platformRole: PlatformRole | null
    projectId: string | null
    status: InvitationStatus
    type: InvitationType
    projectRoleId: string | null
    projectRole: string | null // Simple role: 'OWNER' | 'EDITOR' | 'VIEWER'
    invitationExpirySeconds: number
}



type GetOneByPlatformIdAndEmailParams = {
    email: string
    platformId: string
    projectId: string | null
}