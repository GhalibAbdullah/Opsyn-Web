import { getProjectMaxConcurrentJobsKey } from '@activepieces/server-shared'
import {
    ActivepiecesError,
    ApId,
    apId,
    assertNotNullOrUndefined,
    ErrorCode,
    isNil,
    Metadata,
    PlatformRole,
    Project,
    ProjectId,
    spreadIfDefined,
    UserId,
} from '@activepieces/shared'
import { FindOptionsWhere, ILike, In, IsNull, Not } from 'typeorm'
import { repoFactory } from '../core/db/repo-factory'
import { distributedStore } from '../database/redis-connections'
import { projectMemberService } from '../ee/projects/project-members/project-member.service'
import { system } from '../helper/system/system'
import { userService } from '../user/user-service'
import { ProjectEntity } from './project-entity'
import { projectHooks } from './project-hooks'

export const projectRepo = repoFactory(ProjectEntity)

export const projectService = {
    async create(params: CreateParams): Promise<Project> {
        const newProject: NewProject = {
            id: apId(),
            ...params,
            maxConcurrentJobs: params.maxConcurrentJobs,
            releasesEnabled: false,
        }
        const savedProject = await projectRepo().save(newProject)
        await projectHooks.get(system.globalLogger()).postCreate(savedProject)
        if (!isNil(params.maxConcurrentJobs)) {
            await distributedStore.put(getProjectMaxConcurrentJobsKey(savedProject.id), params.maxConcurrentJobs)
        }
        return savedProject
    },
    async getOneByOwnerAndPlatform(params: GetOneByOwnerAndPlatformParams): Promise<Project | null> {
        return projectRepo().findOneBy({
            ownerId: params.ownerId,
            platformId: params.platformId,
        })
    },

    async getOne(projectId: ProjectId | undefined): Promise<Project | null> {
        if (isNil(projectId)) {
            return null
        }

        return projectRepo().findOneBy({
            id: projectId,
        })
    },

    async getProjectIdsByPlatform(platformId: string): Promise<string[]> {
        const projects = await projectRepo().find({
            select: {
                id: true,
            },
            where: {
                platformId,
            },
        })

        return projects.map((project) => project.id)
    },

    async update(projectId: ProjectId, request: UpdateParams): Promise<Project> {
        const externalId = request.externalId?.trim() !== '' ? request.externalId : undefined
        await assertExternalIdIsUnique(externalId, projectId)

        await projectRepo().update(
            {
                id: projectId,
            },
            {
                ...spreadIfDefined('externalId', externalId),
                ...spreadIfDefined('displayName', request.displayName),
                ...spreadIfDefined('releasesEnabled', request.releasesEnabled),
                ...spreadIfDefined('metadata', request.metadata),
                ...spreadIfDefined('maxConcurrentJobs', request.maxConcurrentJobs),
            },
        )
        return this.getOneOrThrow(projectId)
    },

    async getPlatformId(projectId: ProjectId): Promise<string> {
        const result = await projectRepo().createQueryBuilder('project').select('"platformId"').where({
            id: projectId,
        }).getRawOne()
        const platformId = result?.platformId
        if (isNil(platformId)) {
            throw new Error(`Platform ID for project ${projectId} is undefined in webhook.`)
        }
        return platformId
    },
    async getOneOrThrow(projectId: ProjectId): Promise<Project> {
        const project = await this.getOne(projectId)

        if (isNil(project)) {
            throw new ActivepiecesError({
                code: ErrorCode.ENTITY_NOT_FOUND,
                params: {
                    entityId: projectId,
                    entityType: 'project',
                },
            })
        }

        return project
    },
    async exists({ projectId, isSoftDeleted }: ExistsParams): Promise<boolean> {
        const project = await projectRepo().findOne({
            where: {
                id: projectId,
                deleted: isSoftDeleted ? Not(IsNull()) : IsNull(),
            },
            withDeleted: true,
        })
        return !isNil(project)
    },
    async getUserProjectOrThrow(userId: UserId): Promise<Project> {
        const user = await userService.getOneOrFail({ id: userId })
        assertNotNullOrUndefined(user.platformId, 'platformId is undefined')
        const projects = await this.getAllForUser({
            platformId: user.platformId,
            userId,
        })
        if (isNil(projects) || projects.length === 0) {
            throw new ActivepiecesError({
                code: ErrorCode.ENTITY_NOT_FOUND,
                params: {
                    entityId: userId,
                    entityType: 'user',
                },
            })
        }
        return projects[0]
    },

    async getAllForUser(params: GetAllForUserParams): Promise<Project[]> {
        assertNotNullOrUndefined(params.platformId, 'platformId is undefined')
        const filters = await getUsersFilters(params)
        // findBy expects a single filter object, not an array
        // We always return an array with one filter, so use the first element
        const filter = filters[0]
        if (!filter) {
            system.globalLogger().warn('No filter returned for getAllForUser')
            return []
        }
        return projectRepo().findBy(filter)
    },
    async userHasProjects(params: GetAllForUserParams): Promise<boolean> {
        const filters = await getUsersFilters(params)
        return projectRepo().existsBy(filters)
    },
    async addProjectToPlatform({ projectId, platformId }: AddProjectToPlatformParams): Promise<void> {
        const query = {
            id: projectId,
        }

        const update = {
            platformId,
        }

        await projectRepo().update(query, update)
    },

    async getByPlatformIdAndExternalId({
        platformId,
        externalId,
    }: GetByPlatformIdAndExternalIdParams): Promise<Project | null> {
        return projectRepo().findOneBy({
            platformId,
            externalId,
        })
    },
    async delete(projectId: ProjectId): Promise<void> {
        const project = await this.getOneOrThrow(projectId)
        await projectRepo().softRemove(project)
    },
}


async function getUsersFilters(params: GetAllForUserParams): Promise<FindOptionsWhere<Project>[]> {
    const user = await userService.getOneOrFail({ id: params.userId })
    const isPrivilegedUser = user.platformRole === PlatformRole.ADMIN || user.platformRole === PlatformRole.OPERATOR
    const displayNameFilter = params.displayName ? { displayName: ILike(`%${params.displayName}%`) } : {}
    
    system.globalLogger().info({
        userId: params.userId,
        platformId: params.platformId,
        platformRole: user.platformRole,
        isPrivilegedUser,
    }, 'Getting user filters for projects')
    
    if (isPrivilegedUser) {
        // Platform admins and operators can see all projects in their platform
        system.globalLogger().info('User is privileged, returning all platform projects')
        return [{
            platformId: params.platformId,
            ...displayNameFilter,
        }]
    }
    
    // Only fetch project memberships for non-privileged users
    const logger = system.globalLogger()
    logger.info({
        userId: params.userId,
        platformId: params.platformId,
    }, 'About to query for owned projects directly')
    
    // Query directly for owned projects instead of using getIdsOfProjects
    // This bypasses any potential issues with that function
    const { IsNull } = await import('typeorm')
    const ownedProjects = await projectRepo().find({
        where: {
            ownerId: params.userId,
            platformId: params.platformId,
            deleted: IsNull(),
        },
        select: {
            id: true,
        },
    })
    
    const ownedProjectIds = ownedProjects.map(p => p.id)
    
    logger.info({
        userId: params.userId,
        ownedProjectIds,
        ownedCount: ownedProjects.length,
    }, 'Found owned projects directly')
    
    // Also get project member records
    const projectMemberServiceInstance = projectMemberService(logger)
    const memberProjectIds = await (async () => {
        try {
            // Get project members
            const { repoFactory } = await import('../core/db/repo-factory')
            const { ProjectMemberEntity } = await import('../project-members/project-member.entity')
            const memberRepo = repoFactory(ProjectMemberEntity)
            const members = await memberRepo().find({
                where: {
                    userId: params.userId,
                    platformId: params.platformId,
                },
            })
            return members.map(m => m.projectId)
        } catch (error) {
            logger.error({ error }, 'Error fetching project members')
            return []
        }
    })()
    
    // Combine owned and member project IDs
    const allProjectIds = [...new Set([...ownedProjectIds, ...memberProjectIds])]
    
    logger.info({
        userId: params.userId,
        allProjectIds,
        totalCount: allProjectIds.length,
        ownedCount: ownedProjectIds.length,
        memberCount: memberProjectIds.length,
    }, 'Combined project IDs for user')
    
    // Regular members can only see projects they're members of or own
    if (allProjectIds.length === 0) {
        // Return a filter that will match nothing
        logger.info('No project IDs found, returning empty filter')
        return [{
            platformId: params.platformId,
            id: In(['__NONEXISTENT_ID__']), // This will never match
            ...displayNameFilter,
        }]
    }
    
    return [{
        platformId: params.platformId,
        id: In(allProjectIds),
        ...displayNameFilter,
    }]
}
async function assertExternalIdIsUnique(externalId: string | undefined | null, projectId: ProjectId): Promise<void> {
    if (!isNil(externalId)) {
        const externalIdAlreadyExists = await projectRepo().existsBy({
            id: Not(projectId),
            externalId,
        })

        if (externalIdAlreadyExists) {
            throw new ActivepiecesError({
                code: ErrorCode.PROJECT_EXTERNAL_ID_ALREADY_EXISTS,
                params: {
                    externalId,
                },
            })
        }
    }
}

type GetAllForUserParams = {
    platformId: string
    userId: string
    displayName?: string
}

type GetOneByOwnerAndPlatformParams = {
    ownerId: UserId
    platformId: string
}

type ExistsParams = {
    projectId: ProjectId
    isSoftDeleted?: boolean
}


type UpdateParams = {
    displayName?: string
    externalId?: string
    releasesEnabled?: boolean
    metadata?: Metadata
    maxConcurrentJobs?: number
}

type CreateParams = {
    ownerId: UserId
    displayName: string
    platformId: string
    externalId?: string
    metadata?: Metadata
    maxConcurrentJobs?: number
}

type GetByPlatformIdAndExternalIdParams = {
    platformId: string
    externalId: string
}

type AddProjectToPlatformParams = {
    projectId: ProjectId
    platformId: ApId
}

type NewProject = Omit<Project, 'created' | 'updated' | 'deleted'>
