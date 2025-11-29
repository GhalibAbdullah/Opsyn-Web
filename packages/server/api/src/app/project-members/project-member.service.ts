import {
    ActivepiecesError,
    ApEdition,
    ApId,
    apId,
    Cursor,
    ErrorCode,
    isNil,
    PlatformId,
    PlatformRole,
    ProjectId,
    SeekPage,
    UserId,
} from '@activepieces/shared'
import dayjs from 'dayjs'
import { FastifyBaseLogger } from 'fastify'
import { Equal } from 'typeorm'
import { repoFactory } from '../core/db/repo-factory'
import { buildPaginator } from '../helper/pagination/build-paginator'
import { paginationHelper } from '../helper/pagination/pagination-utils'
import { system } from '../helper/system/system'
import { projectService } from '../project/project-service'
import { userService } from '../user/user-service'
import { userIdentityService } from '../authentication/user-identity/user-identity-service'
import {
    ProjectMemberEntity,
    ProjectMemberRole,
    ProjectMemberSchema,
} from './project-member.entity'

const repo = repoFactory(ProjectMemberEntity)

export type ProjectMember = Omit<ProjectMemberSchema, 'user' | 'project'>

export type ProjectMemberWithUser = ProjectMember & {
    user: {
        id: string
        email: string
        firstName: string | null
        lastName: string | null
        platformId: string
        platformRole: PlatformRole
        status: string
        externalId: string | null
        created: string
        updated: string
    }
}

export const projectMemberService = (log: FastifyBaseLogger) => ({
    async getByProjectId(projectId: ProjectId): Promise<ProjectMember[]> {
        return repo().find({
            where: { projectId },
        })
    },

    async getByProjectIdAndUserId(
        projectId: ProjectId,
        userId: UserId,
    ): Promise<ProjectMember | null> {
        return repo().findOneBy({
            projectId,
            userId,
        })
    },

    async create({
        userId,
        projectId,
        role,
    }: CreateParams): Promise<ProjectMember> {
        const project = await projectService.getOneOrThrow(projectId)
        const { platformId } = project

        // Upsert operation: if member already exists for this (projectId, userId, platformId), return it
        // This makes the operation idempotent - calling it twice for the same user/project will not throw
        const existing = await repo().findOneBy({
            projectId,
            userId,
            platformId,
        })

        if (existing) {
            // Member already exists - return it (idempotent behavior)
            // Note: We don't update the role here to preserve the original role assignment
            // If role update is needed, it should be done via update() method
            return existing
        }

        // Member doesn't exist, create a new one
        const finalRole = role ?? (await this.getDefaultRole(platformId, projectId, userId))
        
        // Double-check for existing member right before save to minimize race window
        // This reduces the chance of hitting UNIQUE constraint in the first place
        const doubleCheck = await repo().findOneBy({
            projectId,
            userId,
            platformId,
        })
        
        if (doubleCheck) {
            // Member was created between our initial check and now - return it
            return doubleCheck
        }
        
        const projectMember: Omit<ProjectMember, 'created' | 'updated'> = {
            id: apId(),
            userId,
            platformId,
            projectId,
            role: finalRole,
        }

        try {
            await repo().save(projectMember)
        } catch (saveError: unknown) {
            // If save fails due to UNIQUE constraint (race condition), find existing member by unique key
            const isConstraintError = saveError && 
                typeof saveError === 'object' && 
                (('code' in saveError && (saveError.code === 'SQLITE_CONSTRAINT' || saveError.code === '23505')) ||
                ('errno' in saveError && saveError.errno === 19) ||
                ('driverError' in saveError && 
                    saveError.driverError && 
                    typeof saveError.driverError === 'object' &&
                    'code' in saveError.driverError &&
                    (saveError.driverError.code === 'SQLITE_CONSTRAINT' || saveError.driverError.code === '23505')))
            
            if (isConstraintError) {
                // Race condition: another request already created the member
                // The UNIQUE constraint proves the member exists, we just need to wait for the transaction to commit
                // Use more aggressive retries with longer delays since we know the member exists
                const maxRetries = 10 // Increased retries since we know member exists
                const baseDelayMs = 100 // Longer initial delay
                
                for (let attempt = 0; attempt < maxRetries; attempt++) {
                    if (attempt > 0) {
                        // Exponential backoff: 100ms, 200ms, 400ms, 800ms, 1600ms, etc.
                        const delayMs = baseDelayMs * Math.pow(2, attempt - 1)
                        await new Promise(resolve => setTimeout(resolve, delayMs))
                    }
                    
                    // Always find by unique key, never by ID
                    const found = await repo().findOneBy({
                        projectId,
                        userId,
                        platformId,
                    })
                    
                    if (found) {
                        // Member exists, return it (idempotent behavior)
                        log.debug({ projectId, userId, platformId, attempt: attempt + 1 }, 
                            '[projectMemberService.create] Found existing member after constraint error')
                        return found
                    }
                }
                
                // Still not found after many retries - this should be extremely rare
                // The member definitely exists (constraint proves it), but we can't see it yet due to transaction isolation
                // Since the UNIQUE constraint proves the member exists, keep retrying until we find it
                // This ensures we return the actual member from the database, not a placeholder
                log.warn({ projectId, userId, platformId, attempts: maxRetries }, 
                    '[projectMemberService.create] UNIQUE constraint but member still not visible after retries - continuing to wait')
                
                // Continue retrying with exponential backoff until we find the member
                // Reduced total wait time: ~5 seconds max (to avoid long loading times in frontend)
                const maxExtendedRetries = 5 // Reduced retries for faster response
                const extendedBaseDelayMs = 200
                
                for (let attempt = 0; attempt < maxExtendedRetries; attempt++) {
                    const delayMs = extendedBaseDelayMs * Math.pow(2, attempt)
                    await new Promise(resolve => setTimeout(resolve, delayMs))
                    
                    const found = await repo().findOneBy({
                        projectId,
                        userId,
                        platformId,
                    })
                    
                    if (found) {
                        log.info({ projectId, userId, platformId, totalAttempts: maxRetries + attempt + 1 }, 
                            '[projectMemberService.create] Found member after extended retries')
                        return found
                    }
                }
                
                // After reasonable wait (~5 seconds total), if still not visible, try inserting again
                // The other transaction might have rolled back, so the member doesn't actually exist
                // Try to insert again - if it still fails with constraint, retry finding it one more time
                log.warn({ projectId, userId, platformId }, 
                    '[projectMemberService.create] Member still not visible after extended wait - attempting to insert again in case transaction rolled back')
                
                try {
                    // Try to insert again - use a new ID in case the previous one conflicted
                    const retryProjectMember: Omit<ProjectMember, 'created' | 'updated'> = {
                        id: apId(),
                        userId,
                        platformId,
                        projectId,
                        role: finalRole,
                    }
                    
                    await repo().save(retryProjectMember)
                    
                    // Insert succeeded - find and return the member
                    const found = await repo().findOneBy({
                        projectId,
                        userId,
                        platformId,
                    })
                    
                    if (found) {
                        log.info({ projectId, userId, platformId }, 
                            '[projectMemberService.create] Successfully inserted member after retry')
                        return found
                    }
                } catch (retryError: unknown) {
                    // Still getting constraint error - member must exist, try finding it one more time
                    const isRetryConstraintError = retryError && 
                        typeof retryError === 'object' && 
                        (('code' in retryError && (retryError.code === 'SQLITE_CONSTRAINT' || retryError.code === '23505')) ||
                        ('errno' in retryError && retryError.errno === 19) ||
                        ('driverError' in retryError && 
                            retryError.driverError && 
                            typeof retryError.driverError === 'object' &&
                            'code' in retryError.driverError &&
                            (retryError.driverError.code === 'SQLITE_CONSTRAINT' || retryError.driverError.code === '23505')))
                    
                    if (isRetryConstraintError) {
                        // Wait a bit more and try one final time to find it
                        await new Promise(resolve => setTimeout(resolve, 500))
                        const finalFound = await repo().findOneBy({
                            projectId,
                            userId,
                            platformId,
                        })
                        
                        if (finalFound) {
                            log.info({ projectId, userId, platformId }, 
                                '[projectMemberService.create] Found member after retry insert constraint')
                            return finalFound
                        }
                    }
                    
                    // Still not found - log error but don't throw yet, try one more query
                    log.error({ projectId, userId, platformId, error: retryError }, 
                        '[projectMemberService.create] Retry insert also failed - member may not exist')
                }
                
                // Final attempt to find the member - if still not found, return null and let caller handle it
                // Don't throw error to avoid losing the invitation
                const finalAttempt = await repo().findOneBy({
                    projectId,
                    userId,
                    platformId,
                })
                
                if (finalAttempt) {
                    log.info({ projectId, userId, platformId }, 
                        '[projectMemberService.create] Found member on final attempt')
                    return finalAttempt
                }
                
                // Still not found - log error but don't throw
                // The member should exist (constraint proved it), but we can't see it
                // Return null and let the caller handle it
                log.error({ projectId, userId, platformId }, 
                    '[projectMemberService.create] Member never became visible after all retries and retry insert - returning null')
                
                // Return null to indicate member not found
                // This is better than throwing an error which would lose the invitation
                // The caller should check for null and handle appropriately
                return null as unknown as ProjectMember
            }
            
            // Re-throw if it's a different error
            throw saveError
        }

        // After successful save, find by unique key (not by ID) to handle race conditions
        // where another concurrent request might have created it with a different ID
        const maxRetries = 3
        const baseDelayMs = 50
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            if (attempt > 0) {
                const delayMs = baseDelayMs * Math.pow(2, attempt - 1)
                await new Promise(resolve => setTimeout(resolve, delayMs))
            }
            
            // Always find by unique key (projectId, userId, platformId), never by ID
            const found = await repo().findOneBy({
                projectId,
                userId,
                platformId,
            })
            
            if (found) {
                return found
            }
        }
        
        // If still not found after retries, try one final time
        const finalAttempt = await repo().findOneBy({
            projectId,
            userId,
            platformId,
        })
        
        if (finalAttempt) {
            return finalAttempt
        }
        
        // Last resort: throw error if member truly not found
        // This shouldn't happen in normal operation
        throw new ActivepiecesError({
            code: ErrorCode.ENTITY_NOT_FOUND,
            params: {
                entityType: 'project_member',
                entityId: `${projectId}/${userId}/${platformId}`,
                message: 'Project member was not found after creation',
            },
        })
    },

    async update({
        id,
        projectId,
        role,
    }: UpdateParams): Promise<ProjectMember> {
        const updateResult = await repo().update(
            {
                id,
                projectId,
            },
            {
                role,
            },
        )

        if (updateResult.affected === 0) {
            throw new ActivepiecesError({
                code: ErrorCode.ENTITY_NOT_FOUND,
                params: {
                    entityType: 'project_member',
                    entityId: id,
                    message: 'Project member not found',
                },
            })
        }

        return repo().findOneByOrFail({
            id,
            projectId,
        })
    },

    async delete({
        id,
        projectId,
    }: DeleteParams): Promise<void> {
        const deleteResult = await repo().delete({ id, projectId })
        
        if (deleteResult.affected === 0) {
            throw new ActivepiecesError({
                code: ErrorCode.ENTITY_NOT_FOUND,
                params: {
                    entityType: 'project_member',
                    entityId: id,
                    message: 'Project member not found',
                },
            })
        }
    },

    async getDefaultRole(
        platformId: PlatformId,
        projectId: ProjectId,
        userId: UserId,
    ): Promise<ProjectMemberRole> {
        const project = await projectService.getOneOrThrow(projectId)
        const user = await userService.getOneOrFail({ id: userId })

        // Project owner gets OWNER role
        if (user.id === project.ownerId) {
            return 'OWNER'
        }

        // Check if this is the first member (besides owner)
        const existingMembers = await repo().find({
            where: { projectId },
        })

        // If no members exist yet, first user gets OWNER
        if (existingMembers.length === 0) {
            return 'OWNER'
        }

        // Otherwise default to EDITOR (preserves current behavior)
        return 'EDITOR'
    },

    async getRole({
        userId,
        projectId,
    }: {
        projectId: ProjectId
        userId: UserId
    }): Promise<ProjectMemberRole | null> {
        const edition = system.getEdition()
        if (edition !== ApEdition.COMMUNITY) {
            return null
        }

        // Use the centralized permission service for consistent resolution
        const { projectPermissionsService } = await import('../authentication/project-permissions.service')
        return await projectPermissionsService(log).getRole(projectId, userId)
    },

    async list({
        platformId,
        projectId,
        cursorRequest,
        limit,
    }: ListParams): Promise<SeekPage<ProjectMemberWithUser>> {
        const decodedCursor = paginationHelper.decodeCursor(cursorRequest)
        const paginator = buildPaginator({
            entity: ProjectMemberEntity,
            query: {
                limit,
                order: 'ASC',
                afterCursor: decodedCursor.nextCursor,
                beforeCursor: decodedCursor.previousCursor,
            },
        })

        const queryBuilder = repo()
            .createQueryBuilder('project_member')
            .where({ platformId })

        if (projectId) {
            queryBuilder.andWhere({ projectId })
        }

        const { data, cursor } = await paginator.paginate(queryBuilder)
        const enrichedData: (ProjectMemberWithUser | null)[] = await Promise.all(
            data.map(async (member) => {
                return await enrichProjectMemberWithUser(member, log)
            }),
        )
        const filteredEnrichedData = enrichedData.filter(
            (member) => !isNil(member),
        )

        // For Community Edition: Also include platform admins who don't have explicit ProjectMember records
        // This maintains backward compatibility
        if (projectId) {
            const project = await projectService.getOneOrThrow(projectId)
            const platformAdminUsers = await userService.getByPlatformRole(
                platformId,
                PlatformRole.ADMIN,
            )

            // Get user IDs that already have ProjectMember records
            const existingMemberUserIds = new Set(
                filteredEnrichedData.map((m) => m.userId),
            )

            // Only show platform admins as virtual members if they're the project owner
            // This prevents removed members from reappearing as virtual members
            // Other platform admins must be explicitly added via ProjectMember records
            const virtualMembers: ProjectMemberWithUser[] = await Promise.all(
                platformAdminUsers
                    .filter((user) => {
                        // Only include if:
                        // 1. They don't have an explicit ProjectMember record
                        // 2. They are the project owner (project owners should always be visible)
                        return !existingMemberUserIds.has(user.id) && user.id === project.ownerId
                    })
                    .map(async (user) => {
                        const identity = await userIdentityService(log).getBasicInformation(
                            user.identityId,
                        )
                        // Project owner is always OWNER
                        const role: ProjectMemberRole = 'OWNER'

                        return {
                            id: `virtual-${user.id}`, // Virtual ID for members without DB records
                            created: user.created,
                            updated: user.updated,
                            projectId,
                            platformId,
                            userId: user.id,
                            role,
                            user: {
                                id: user.id,
                                email: identity.email,
                                firstName: identity.firstName,
                                lastName: identity.lastName,
                                platformId: user.platformId ?? '',
                                platformRole: user.platformRole,
                                status: user.status,
                                externalId: user.externalId ?? null,
                                created: user.created,
                                updated: user.updated,
                            },
                        }
                    }),
            )

            // Combine explicit members with virtual members
            const allMembers = [...filteredEnrichedData, ...virtualMembers]

            // Simple pagination for combined results
            const startIndex = decodedCursor.nextCursor
                ? parseInt(decodedCursor.nextCursor, 10) || 0
                : 0
            const endIndex = startIndex + (limit || 10)
            const paginatedMembers = allMembers.slice(startIndex, endIndex)

            return {
                data: paginatedMembers,
                next: endIndex < allMembers.length ? endIndex.toString() : null,
                previous: startIndex > 0 ? (startIndex - limit).toString() : null,
            }
        }

        return paginationHelper.createPage<ProjectMemberWithUser>(
            filteredEnrichedData,
            cursor,
        )
    },

    async getIdsOfProjects({
        userId,
        platformId,
    }: GetIdsOfProjectsParams): Promise<string[]> {
        // FORCE LOG IMMEDIATELY - this should always appear
        console.log('🔍 getIdsOfProjects CALLED', { userId, platformId })
        
        try {
            // Use both loggers to ensure we see the output
            const globalLog = system.globalLogger()
            globalLog.error({
                userId,
                platformId,
            }, '🔍 getIdsOfProjects START - ERROR LEVEL')
            
            log.error({
                userId,
                platformId,
            }, '🔍 getIdsOfProjects START - ERROR LEVEL')
            
            const edition = system.getEdition()
            globalLog.error({ edition }, '🔍 Edition check')
            
            if (edition !== ApEdition.COMMUNITY) {
                // For Enterprise/Cloud, this should not be used
                globalLog.error({}, '🔍 Not Community Edition, returning empty array')
                return []
            }

            globalLog.info({
                userId,
                platformId,
                edition,
            }, 'Getting project IDs for user - START')
            
            log.info({
                userId,
                platformId,
                edition,
            }, 'Getting project IDs for user - START')

            // Get all projects where user has explicit ProjectMember records
            const members = await repo().find({
                where: {
                    userId,
                    platformId,
                },
            })

            const projectIds = members.map((member) => member.projectId)
            log.info({
                memberProjectIds: projectIds,
                memberCount: members.length,
            }, 'Found project member records')

            // Also include projects where user is the owner (query directly to avoid circular dependency)
            const { ProjectEntity } = await import('../project/project-entity')
            const { repoFactory } = await import('../core/db/repo-factory')
            const { IsNull } = await import('typeorm')
            const projectRepository = repoFactory(ProjectEntity)
            
            log.info({
                queryingFor: {
                    ownerId: userId,
                    platformId,
                },
            }, 'Querying for owned projects')
            
            // First, let's check if ANY projects exist for this platform
            const allPlatformProjects = await projectRepository().find({
                where: {
                    platformId,
                },
                select: {
                    id: true,
                    ownerId: true,
                    deleted: true,
                },
                take: 10, // Just get a few to see what's there
            })
            
            log.info({
                allPlatformProjectsCount: allPlatformProjects.length,
                allPlatformProjects: allPlatformProjects.map(p => ({
                    id: p.id,
                    ownerId: p.ownerId,
                    deleted: p.deleted,
                })),
            }, 'All projects in platform (sample)')
            
            // Try querying without deleted filter first to see if projects exist
            const allOwnedProjects = await projectRepository().find({
                where: {
                    ownerId: userId,
                    platformId,
                },
                select: {
                    id: true,
                    deleted: true,
                },
            })
            
            globalLog.info({
                allOwnedProjectsCount: allOwnedProjects.length,
                allOwnedProjects: allOwnedProjects.map(p => ({
                    id: p.id,
                    deleted: p.deleted,
                })),
            }, 'All owned projects (including deleted)')
            
            // Try without deleted filter first - TypeORM should exclude soft-deleted by default
            const ownedProjectsWithoutFilter = await projectRepository().find({
                where: {
                    ownerId: userId,
                    platformId,
                },
                select: {
                    id: true,
                },
            })
            
            globalLog.info({
                ownedProjectsCountWithoutFilter: ownedProjectsWithoutFilter.length,
                ownedProjectsWithoutFilter: ownedProjectsWithoutFilter.map(p => p.id),
            }, 'Owned projects (no deleted filter)')
            
            // Also try with explicit IsNull filter
            const ownedProjects = await projectRepository().find({
                where: {
                    ownerId: userId,
                    platformId,
                    deleted: IsNull(), // Exclude soft-deleted projects
                },
                select: {
                    id: true,
                },
            })
            
            globalLog.info({
                ownedProjectsCount: ownedProjects.length,
                ownedProjects: ownedProjects.map(p => p.id),
            }, 'Owned projects (with IsNull filter)')
            
            // Use the results without filter if the IsNull filter returns nothing
            const finalOwnedProjects = ownedProjects.length > 0 ? ownedProjects : ownedProjectsWithoutFilter
            const finalOwnedProjectIds = finalOwnedProjects.map((project) => project.id)
            log.info({
                ownedProjectIds: finalOwnedProjectIds,
                ownedCount: finalOwnedProjects.length,
                ownerId: userId,
                platformId,
                queryResult: finalOwnedProjects,
            }, 'Found owned projects')

            // Combine and deduplicate
            const allProjectIds = [...new Set([...projectIds, ...finalOwnedProjectIds])]
            
            log.info({
                totalProjectIds: allProjectIds,
                totalCount: allProjectIds.length,
                memberIds: projectIds,
                ownedIds: finalOwnedProjectIds,
            }, 'Combined project IDs - END')

            return allProjectIds
        } catch (error) {
            log.error({
                error,
                userId,
                platformId,
            }, 'Error in getIdsOfProjects')
            throw error
        }
    },
})

type GetIdsOfProjectsParams = {
    userId: UserId
    platformId: PlatformId
}

type CreateParams = {
    userId: UserId
    projectId: ProjectId
    role?: ProjectMemberRole
}

type UpdateParams = {
    id: ApId
    projectId: ProjectId
    role: ProjectMemberRole
}

type DeleteParams = {
    id: ApId
    projectId: ProjectId
}

type ListParams = {
    platformId: PlatformId
    projectId?: ProjectId
    cursorRequest: Cursor | null
    limit: number
}

async function enrichProjectMemberWithUser(
    projectMember: ProjectMember,
    log: FastifyBaseLogger,
): Promise<ProjectMemberWithUser | null> {
    const isProjectSoftDeleted = await projectService.exists({
        projectId: projectMember.projectId,
        isSoftDeleted: true,
    })
    if (isProjectSoftDeleted) {
        return null
    }

    const user = await userService.getOneOrFail({
        id: projectMember.userId,
    })
    const identity = await userIdentityService(log).getBasicInformation(
        user.identityId,
    )

    return {
        ...projectMember,
        user: {
            platformId: user.platformId ?? '',
            platformRole: user.platformRole,
            status: user.status,
            externalId: user.externalId ?? null,
            email: identity.email,
            id: user.id,
            firstName: identity.firstName,
            lastName: identity.lastName,
            created: user.created,
            updated: user.updated,
        },
    }
}

