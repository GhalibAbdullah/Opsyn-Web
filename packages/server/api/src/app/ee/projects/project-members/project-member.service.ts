import {
    ProjectMember,
    ProjectMemberId,
    ProjectMemberWithUser,
} from '@activepieces/ee-shared'
import {
    ActivepiecesError,
    ApEdition,
    ApId,
    apId,
    AppConnectionScope,
    Cursor,
    DefaultProjectRole,
    ErrorCode,
    isNil,
    PlatformId,
    PlatformRole,
    ProjectId,
    ProjectRole,
    SeekPage,
    UserId,
} from '@activepieces/shared'
import dayjs from 'dayjs'
import { FastifyBaseLogger } from 'fastify'
import { Equal } from 'typeorm'
import { userIdentityService } from '../../../authentication/user-identity/user-identity-service'
import { repoFactory } from '../../../core/db/repo-factory'
import { buildPaginator } from '../../../helper/pagination/build-paginator'
import { paginationHelper } from '../../../helper/pagination/pagination-utils'
import { system } from '../../../helper/system/system'
import { projectService } from '../../../project/project-service'
import { userService } from '../../../user/user-service'
import { projectRoleService } from '../project-role/project-role.service'
import { appConnectionService } from '../../../app-connection/app-connection-service/app-connection-service'
import { appConnectionsRepo } from '../../../app-connection/app-connection-service/app-connection-service'
import { APArrayContains } from '../../../database/database-connection'
import {
    ProjectMemberEntity,
} from './project-member.entity'
const repo = repoFactory(ProjectMemberEntity)

export const projectMemberService = (log: FastifyBaseLogger) => ({
    async upsert({
        userId,
        projectId,
        projectRoleName,
    }: UpsertParams): Promise<ProjectMember> {
        const { platformId } = await projectService.getOneOrThrow(projectId)
        const existingProjectMember = await repo().findOneBy({
            projectId,
            userId,
            platformId,
        })
        const projectMemberId = existingProjectMember?.id ?? apId()

        const projectRole = await projectRoleService.getOneOrThrow({
            name: projectRoleName,
            platformId,
        })

        const projectMember: NewProjectMember = {
            id: projectMemberId,
            updated: dayjs().toISOString(),
            userId,
            platformId,
            projectId,
            projectRoleId: projectRole.id,
        }

        await repo().upsert(projectMember, [
            'projectId',
            'userId',
            'platformId',
        ])

        return repo().findOneOrFail({
            where: {
                id: projectMemberId,
            },
        })
    },
    async list(
        {
            platformId,
            projectId,
            cursorRequest,
            limit,
            projectRoleId,
        }: ListParams,
    ): Promise<SeekPage<ProjectMemberWithUser>> {
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

        if (projectRoleId) {
            queryBuilder.andWhere({ projectRoleId })
        }

        const { data, cursor } = await paginator.paginate(queryBuilder)
        const enrichedData: (ProjectMemberWithUser | null)[] = await Promise.all(
            data.map(async (member) => {
                const enrichedMember = await enrichProjectMemberWithUser(member, log)
                if (isNil(enrichedMember)) {
                    return null
                }
                return {
                    ...enrichedMember,
                    projectRole: await projectRoleService.getOneOrThrowById({
                        id: member.projectRoleId,
                    }),
                }
            }),
        )
        const filteredEnrichedData = enrichedData.filter((member) => !isNil(member))
        return paginationHelper.createPage<ProjectMemberWithUser>(filteredEnrichedData, cursor)
    },
    async getRole({
        userId,
        projectId,
    }: {
        projectId: ProjectId
        userId: UserId
    }): Promise<ProjectRole | null> {
        const project = await projectService.getOneOrThrow(projectId)
        const user = await userService.getOneOrFail({
            id: userId,
        })

        if (user.id === project.ownerId) {
            return projectRoleService.getOneOrThrow({ name: DefaultProjectRole.ADMIN, platformId: project.platformId })
        }
        if (project.platformId === user.platformId && user.platformRole === PlatformRole.ADMIN) {
            return projectRoleService.getOneOrThrow({ name: DefaultProjectRole.ADMIN, platformId: project.platformId })
        }
        if (project.platformId === user.platformId && user.platformRole === PlatformRole.OPERATOR) {
            return projectRoleService.getOneOrThrow({ name: DefaultProjectRole.OPERATOR, platformId: project.platformId })
        }
        const member = await repo().findOneBy({
            projectId,
            userId,
        })

        if (!member) {
            return null
        }

        const projectRole = await projectRoleService.getOneOrThrowById({
            id: member.projectRoleId,
        })

        return projectRole
    },
    async update(params: UpdateMemberRole): Promise<ProjectMember> {
        const projectRole = await projectRoleService.getOneOrThrow({
            name: params.role,
            platformId: params.platformId,
        })
        const updateResult = await repo().update({
            id: params.id,
            projectId: params.projectId,
        }, {
            projectRoleId: projectRole.id,
        })
        if (updateResult.affected === 0) {
            throw new ActivepiecesError({
                code: ErrorCode.ENTITY_NOT_FOUND,
                params: { entityType: 'project_member', entityId: params.id, message: 'Project member not found' },
            })
        }
        return repo().findOneByOrFail({
            id: params.id,
            projectId: params.projectId,
        })
    },
    async getIdsOfProjects({
        userId,
        platformId,
    }: GetIdsOfProjectsParams): Promise<string[]> {
        const edition = system.getEdition()
        if (edition === ApEdition.COMMUNITY) {
            return []
        }
        const members = await repo().findBy({
            userId,
            platformId: Equal(platformId),
        })
        return members.map((member) => member.projectId)
    },
    async delete(
        projectId: ProjectId,
        invitationId: ProjectMemberId,
    ): Promise<void> {
        // Get the project member to retrieve userId and platformId before deletion
        const projectMember = await repo().findOneBy({ projectId, id: invitationId })
        
        if (!projectMember) {
            throw new ActivepiecesError({
                code: ErrorCode.ENTITY_NOT_FOUND,
                params: {
                    entityType: 'project_member',
                    entityId: invitationId,
                    message: 'Project member not found',
                },
            })
        }

        const userId = projectMember.userId
        const platformId = projectMember.platformId

        // Delete the project member
        await repo().delete({ projectId, id: invitationId })

        // Cleanup: Delete all connections owned by this user in this project
        // This ensures that when a user is removed, their API keys/credentials are also removed
        await this.deleteUserConnectionsFromProject({
            userId,
            projectId,
            platformId,
            log,
        })
    },

    async deleteUserConnectionsFromProject({
        userId,
        projectId,
        platformId,
        log,
    }: {
        userId: UserId
        projectId: ProjectId
        platformId: PlatformId
        log: FastifyBaseLogger
    }): Promise<void> {
        // Find all connections owned by this user that belong to this project
        const userConnections = await appConnectionsRepo().find({
            where: {
                ownerId: userId,
                platformId,
                scope: AppConnectionScope.PROJECT,
                ...APArrayContains('projectIds', [projectId]),
            },
        })

        // Delete each connection
        // Note: We delete the entire connection even if it's shared across multiple projects
        // This is a security measure - when a user is removed, their credentials should be removed
        for (const connection of userConnections) {
            await appConnectionService(log).delete({
                id: connection.id,
                platformId,
                scope: AppConnectionScope.PROJECT,
                projectId,
            })
        }

        if (userConnections.length > 0) {
            log.info({
                userId,
                projectId,
                deletedConnectionsCount: userConnections.length,
            }, 'Deleted user connections after removing project member')
        }
    },

    async deleteSelf({
        projectId,
        userId,
    }: {
        projectId: ProjectId
        userId: UserId
    }): Promise<void> {
        // Find explicit project member record (owners may be treated as virtual members and have no row)
        const member = await repo().findOneBy({
            projectId,
            userId,
        })

        if (!member) {
            throw new ActivepiecesError({
                code: ErrorCode.ENTITY_NOT_FOUND,
                params: {
                    entityType: 'project_member',
                    entityId: userId,
                    message: 'Project member not found - you may be the project owner or not a member',
                },
            })
        }

        // Reuse existing delete logic so we also clean up connections, etc.
        await this.delete(projectId, member.id)
    },
})

type ListParams = {
    platformId: PlatformId
    projectId?: ProjectId
    cursorRequest: Cursor | null
    limit: number
    projectRoleId?: string
}

type GetIdsOfProjectsParams = {
    userId: UserId
    platformId: PlatformId
}

type UpsertParams = {
    userId: string
    projectId: ProjectId
    projectRoleName: string
}

type NewProjectMember = Omit<ProjectMember, 'created' | 'projectRole'>


type UpdateMemberRole = {
    id: ApId
    projectId: ProjectId
    platformId: PlatformId
    role: string
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
    const identity = await userIdentityService(log).getBasicInformation(user.identityId)
    const projectRole = await projectRoleService.getOneOrThrowById({
        id: projectMember.projectRoleId,
    })
    const project = await projectService.getOneOrThrow(projectMember.projectId)
    return {
        ...projectMember,
        projectRole,
        project: {
            id: project.id,
            displayName: project.displayName,
        },
        user: {
            platformId: user.platformId,
            platformRole: user.platformRole,
            status: user.status,
            externalId: user.externalId,
            email: identity.email,
            id: user.id,
            firstName: identity.firstName,
            lastName: identity.lastName,
            created: user.created,
            updated: user.updated,
        },
    }
}