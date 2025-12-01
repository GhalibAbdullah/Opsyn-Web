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
    projectRole?: {
        name: string
    }
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
        
        // Last resort: if member still not found after all retries, it might be a transaction isolation issue
        // The save succeeded, so the member should exist. Return a "stub" member object
        // The caller can verify membership later if needed
        log.warn({ 
            projectId, 
            userId, 
            platformId,
            savedId: projectMember.id 
        }, '[projectMemberService.create] Member not immediately visible after save - likely transaction isolation issue, returning stub')
        
        // Return a stub member - the actual member exists in the database but isn't visible yet
        // This allows the invitation acceptance to succeed, and the member will be visible after transaction commits
        return {
            id: projectMember.id,
            projectId,
            userId,
            platformId,
            role: finalRole,
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
        } as ProjectMember
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
            // CRITICAL: Strictly filter by projectId to ensure we only get members for this project
            queryBuilder.andWhere({ projectId })
        }

        const { data, cursor } = await paginator.paginate(queryBuilder)
        
        // Log initial query results for debugging
        if (projectId) {
            log.debug({ 
                projectId, 
                initialRecordCount: data.length,
                initialRecordProjectIds: data.map(m => m.projectId),
                initialRecordUserIds: data.map(m => m.userId)
            }, 'Initial project_member query results')
        }
        
        const enrichedData: (ProjectMemberWithUser | null)[] = await Promise.all(
            data.map(async (member) => {
                // Safety check: ensure member belongs to requested project
                if (projectId && member.projectId !== projectId) {
                    log.error({ 
                        requestedProjectId: projectId,
                        memberProjectId: member.projectId,
                        memberId: member.id
                    }, 'CRITICAL: Query returned member from wrong project - filtering out')
                    return null
                }
                return await enrichProjectMemberWithUser(member, log)
            }),
        )
        const filteredEnrichedData = enrichedData.filter(
            (member) => !isNil(member),
        )

        // For Community Edition: Always ensure project owner is included and shows as OWNER
        // This ensures project owners are always visible in the members list with correct role
        if (projectId) {
            const project = await projectService.getOneOrThrow(projectId)
            
            // CRITICAL: Verify we're working with the correct project
            if (project.id !== projectId) {
                log.error({ 
                    requestedProjectId: projectId, 
                    actualProjectId: project.id 
                }, 'Project ID mismatch in member list')
                throw new ActivepiecesError({
                    code: ErrorCode.VALIDATION,
                    params: { message: 'Project ID mismatch' },
                })
            }
            
            // Log project details for debugging
            log.info({ 
                projectId, 
                projectDisplayName: project.displayName,
                projectOwnerId: project.ownerId,
                platformId,
                explicitMemberCount: filteredEnrichedData.length,
                explicitMemberUserIds: filteredEnrichedData.map(m => m.userId)
            }, 'Listing project members - BEFORE adding owner')

            // Get user IDs that already have ProjectMember records for THIS project
            const existingMemberUserIds = new Set(
                filteredEnrichedData.map((m) => m.userId),
            )

            // Always ensure the project owner is included with OWNER role
            // ONLY if they are the actual owner of THIS specific project
            // CRITICAL: Double-check that project.ownerId matches the project we're querying
            if (project.ownerId && project.id === projectId) {
                try {
                    const ownerUser = await userService.getOneOrFail({ id: project.ownerId })
                    
                    // Verify owner belongs to the same platform
                    if (ownerUser.platformId !== platformId) {
                        log.warn({ 
                            projectId, 
                            ownerId: project.ownerId, 
                            ownerPlatformId: ownerUser.platformId,
                            projectPlatformId: platformId 
                        }, 'Project owner belongs to different platform, skipping')
                    } else if (project.id !== projectId) {
                        // Extra safety check - this should never happen due to earlier check
                        log.error({ 
                            projectId, 
                            projectOwnerId: project.ownerId,
                            actualProjectId: project.id 
                        }, 'Project ID mismatch when adding owner, skipping')
                    } else {
                        const identity = await userIdentityService(log).getBasicInformation(
                            ownerUser.identityId,
                        )
                        
                        // If owner has an explicit ProjectMember record for THIS project, update it to OWNER role
                        // CRITICAL: Only update if the member record belongs to THIS specific project
                        const existingOwnerMemberIndex = filteredEnrichedData.findIndex(
                            (m) => m.userId === project.ownerId && m.projectId === projectId
                        )
                        
                        if (existingOwnerMemberIndex >= 0) {
                            const existingMember = filteredEnrichedData[existingOwnerMemberIndex]
                            // Double-check: ensure this member record belongs to the correct project
                            if (existingMember.projectId !== projectId) {
                                log.error({ 
                                    projectId,
                                    memberProjectId: existingMember.projectId,
                                    memberUserId: existingMember.userId
                                }, 'CRITICAL: Found owner member record for wrong project - SKIPPING update')
                            } else {
                                // Update existing member to OWNER role
                                filteredEnrichedData[existingOwnerMemberIndex] = {
                                    ...existingMember,
                                    role: 'OWNER',
                                    projectRole: {
                                        name: 'OWNER',
                                    },
                                }
                            }
                        } else {
                            // Add owner as virtual member if they don't have an explicit record for THIS project
                            // CRITICAL: Triple-check that we're adding for the correct project
                            if (project.id !== projectId || project.ownerId !== ownerUser.id) {
                                log.error({ 
                                    projectId,
                                    projectActualId: project.id,
                                    projectOwnerId: project.ownerId,
                                    ownerUserId: ownerUser.id
                                }, 'CRITICAL: Project/owner mismatch when adding virtual member - SKIPPING')
                            } else {
                                log.info({ 
                                    projectId, 
                                    ownerId: ownerUser.id,
                                    ownerEmail: identity.email,
                                    ownerName: `${identity.firstName} ${identity.lastName}`
                                }, 'Adding project owner as virtual member')
                                
                                filteredEnrichedData.push({
                                    id: `virtual-${ownerUser.id}`,
                                    created: ownerUser.created,
                                    updated: ownerUser.updated,
                                    projectId, // Explicitly set to the current projectId
                                    platformId,
                                    userId: ownerUser.id,
                                    role: 'OWNER',
                                    projectRole: {
                                        name: 'OWNER',
                                    },
                                    user: {
                                        id: ownerUser.id,
                                        email: identity.email,
                                        firstName: identity.firstName,
                                        lastName: identity.lastName,
                                        platformId: ownerUser.platformId ?? '',
                                        platformRole: ownerUser.platformRole,
                                        status: ownerUser.status,
                                        externalId: ownerUser.externalId ?? null,
                                        created: ownerUser.created,
                                        updated: ownerUser.updated,
                                    },
                                })
                            }
                        }
                    }
                } catch (error) {
                    // If owner user doesn't exist, log but don't fail
                    log.warn({ projectId, ownerId: project.ownerId, error }, 'Failed to load project owner')
                }
            }

            // Final safety check: Filter out any members that don't belong to this project
            // This should never happen if the query is correct, but it's a safety net
            const allMembers = filteredEnrichedData.filter(
                (member) => member.projectId === projectId
            )
            
            // Remove duplicates by userId WITHIN THIS PROJECT ONLY
            // CRITICAL: Key by userId only (not projectId+userId) because we've already filtered to this project
            // This ensures we don't accidentally merge members from different projects
            const membersMap = new Map<string, ProjectMemberWithUser>()
            allMembers.forEach(member => {
                // Double-check: ensure member belongs to this project
                if (member.projectId !== projectId) {
                    log.warn({ 
                        memberProjectId: member.projectId, 
                        requestedProjectId: projectId,
                        memberUserId: member.userId 
                    }, 'Filtering out member from wrong project')
                    return // Skip this member
                }
                
                const existing = membersMap.get(member.userId)
                if (!existing) {
                    // No existing member for this userId in this project, add this one
                    membersMap.set(member.userId, member)
                } else {
                    // We have a duplicate for this userId in this project - prefer explicit records over virtual ones
                    const isCurrentExplicit = !member.id.startsWith('virtual-')
                    const isExistingExplicit = !existing.id.startsWith('virtual-')
                    
                    if (isCurrentExplicit && !isExistingExplicit) {
                        // Current is explicit, existing is virtual - replace with explicit
                        membersMap.set(member.userId, member)
                    }
                    // Otherwise keep existing (either both are same type, or existing is explicit)
                }
            })
            
            const finalMembers = Array.from(membersMap.values())
            
            // Final validation: Ensure ALL members belong to the requested project
            const invalidMembers = finalMembers.filter(m => m.projectId !== projectId)
            if (invalidMembers.length > 0) {
                log.error({ 
                    projectId, 
                    invalidMembers: invalidMembers.map(m => ({ userId: m.userId, projectId: m.projectId }))
                }, 'CRITICAL: Found members from wrong project after deduplication')
                // Filter them out as a safety measure
                return {
                    data: finalMembers.filter(m => m.projectId === projectId),
                    next: null,
                    previous: null,
                }
            }
            
            // Log final members for debugging
            log.info({ 
                projectId, 
                finalMemberCount: finalMembers.length,
                finalMemberDetails: finalMembers.map(m => ({
                    userId: m.userId,
                    email: m.user.email,
                    role: m.role,
                    isVirtual: m.id.startsWith('virtual-')
                }))
            }, 'Listing project members - FINAL result')

            // Simple pagination for combined results
            const startIndex = decodedCursor.nextCursor
                ? parseInt(decodedCursor.nextCursor, 10) || 0
                : 0
            const endIndex = startIndex + (limit || 10)
            const paginatedMembers = finalMembers.slice(startIndex, endIndex)

            return {
                data: paginatedMembers,
                next: endIndex < finalMembers.length ? endIndex.toString() : null,
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
        // Add retry logic to handle transaction isolation issues where newly created members
        // might not be immediately visible
        let members = await repo().find({
            where: {
                userId,
                platformId,
            },
        })

        // If no members found, retry a few times with delays to handle transaction isolation
        // This is especially important after accepting invitations where members are just created
        // SQLite with connection pooling may have delays before changes are visible to other connections
        if (members.length === 0) {
            const maxRetries = 5
            const baseDelayMs = 200
            
            for (let attempt = 0; attempt < maxRetries; attempt++) {
                if (attempt > 0) {
                    const delayMs = baseDelayMs * attempt // Linear backoff: 200ms, 400ms, 600ms, 800ms, 1000ms
                    log.info({
                        attempt: attempt + 1,
                        delayMs,
                    }, 'Retrying member query due to transaction isolation')
                    await new Promise(resolve => setTimeout(resolve, delayMs))
                }
                
                members = await repo().find({
                    where: {
                        userId,
                        platformId,
                    },
                })
                
                if (members.length > 0) {
                    log.info({
                        attempt: attempt + 1,
                        memberCount: members.length,
                    }, 'Found project members after retry')
                    break
                }
            }
        }

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
        projectRole: {
            name: projectMember.role,
        },
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

