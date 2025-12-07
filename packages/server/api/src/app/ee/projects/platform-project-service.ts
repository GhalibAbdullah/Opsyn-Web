import {
    UpdateProjectPlatformRequest,
} from '@activepieces/ee-shared'
import {
    ActivepiecesError,
    ApEdition,
    assertNotNullOrUndefined,
    Cursor,
    ErrorCode,
    FlowStatus,
    isNil,
    PlatformId,
    Project,
    ProjectId,
    ProjectWithLimits,
    SeekPage,
    spreadIfDefined,
    UserStatus,
} from '@activepieces/shared'
import { FastifyBaseLogger } from 'fastify'
import { EntityManager, Equal, ILike, In } from 'typeorm'
import { appConnectionService } from '../../app-connection/app-connection-service/app-connection-service'
import { repoFactory } from '../../core/db/repo-factory'
import { transaction } from '../../core/db/transaction'
import { flowRepo } from '../../flows/flow/flow.repo'
import { flowService } from '../../flows/flow/flow.service'
import { buildPaginator } from '../../helper/pagination/build-paginator'
import { paginationHelper } from '../../helper/pagination/pagination-utils'
import { system } from '../../helper/system/system'
import { platformService } from '../../platform/platform.service'
import { ProjectEntity } from '../../project/project-entity'
import { projectService } from '../../project/project-service'
import { userService } from '../../user/user-service'
import { platformPlanService } from '../platform/platform-plan/platform-plan.service'
import { platformUsageService } from '../platform/platform-usage-service'
import { ProjectMemberEntity } from './project-members/project-member.entity'
import { projectLimitsService } from './project-plan/project-plan.service'
const projectRepo = repoFactory(ProjectEntity)
const projectMemberRepo = repoFactory(ProjectMemberEntity)

export const platformProjectService = (log: FastifyBaseLogger) => ({
    async getAllForPlatform(params: GetAllForParamsAndUser): Promise<SeekPage<ProjectWithLimits>> {
        const user = await userService.getOneOrFail({
            id: params.userId,
        })
        assertNotNullOrUndefined(user.platformId, 'platformId is undefined')
        const projects = await projectService.getAllForUser({
            platformId: user.platformId,
            userId: params.userId,
            displayName: params.displayName,
        })
        return getProjects({
            ...params,
            projectIds: projects.map((project) => project.id),
        }, log)
    },
    async update({
        projectId,
        request,
        userId,
    }: UpdateParams): Promise<ProjectWithLimits> {
        await projectService.update(projectId, request)
        if (!isNil(request.plan)) {
            log.debug({
                name: 'platformProjectService.update',
                projectId,
                receivedPlan: {
                    piecesCount: request.plan.pieces?.length ?? 'not provided',
                    piecesFilterType: request.plan.piecesFilterType ?? 'not provided',
                    pieces: request.plan.pieces?.slice(0, 10) ?? 'not provided',
                },
            })
            const project = await projectService.getOneOrThrow(projectId)
            const platform = await platformService.getOneWithPlanOrThrow(project.platformId)
            // Allow project owners to update their project plan even without enterprise feature
            const isProjectOwner = !isNil(userId) && project.ownerId === userId
            log.debug({
                name: 'platformProjectService.update',
                projectId,
                authorization: {
                    manageProjectsEnabled: platform.plan.manageProjectsEnabled,
                    isProjectOwner,
                    willUpdate: platform.plan.manageProjectsEnabled || isProjectOwner,
                },
            })
            if (platform.plan.manageProjectsEnabled || isProjectOwner) {
                const edition = system.getEdition()
                if (edition === ApEdition.COMMUNITY) {
                    // Use CE service for Community Edition
                    const { projectPlanService } = require('../../project/project-plan.service')
                    await projectPlanService(log).upsert(
                        {
                            pieces: request.plan.pieces,
                            piecesFilterType: request.plan.piecesFilterType,
                            aiCredits: request.plan.aiCredits ?? null,
                        },
                        projectId,
                    )
                } else {
                    // Use EE service for Enterprise/Cloud
                    const planLimits: any = {
                            aiCredits: request.plan.aiCredits ?? null,
                    }
                    // Always update pieces if provided (even if empty array) to ensure filtering works
                    if (request.plan.pieces !== undefined) {
                        planLimits.pieces = request.plan.pieces
                    }
                    // Always update piecesFilterType if provided
                    if (request.plan.piecesFilterType !== undefined) {
                        planLimits.piecesFilterType = request.plan.piecesFilterType
                    }
                    log.debug({
                        name: 'platformProjectService.update',
                        projectId,
                        planLimits: {
                            piecesCount: planLimits.pieces?.length ?? 'not provided',
                            piecesFilterType: planLimits.piecesFilterType ?? 'not provided',
                            pieces: planLimits.pieces?.slice(0, 10) ?? 'not provided',
                        },
                    })
                    await projectLimitsService(log).upsert(planLimits, projectId)
                }
            }
        }
        return this.getWithPlanAndUsageOrThrow(projectId)
    },
    async getWithPlanAndUsageOrThrow(
        projectId: string,
    ): Promise<ProjectWithLimits> {
        return enrichProject(
            await projectRepo().findOneByOrFail({
                id: projectId,
            }),
            log,
        )
    },


    async hardDelete({ id, platformId }: HardDeleteParams): Promise<void> {
        await transaction(async (entityManager) => {
            await assertAllProjectFlowsAreDisabled({
                projectId: id,
                entityManager,
            }, log)

            const allFlows = await flowRepo(entityManager).find({
                where: {
                    projectId: id,
                },
                select: {
                    id: true,
                },
            })
            await Promise.all(allFlows.map((flow) => flowService(log).delete({ id: flow.id, projectId: id })))
            await appConnectionService(log).deleteAllProjectConnections(id)
            await projectRepo().delete({
                id,
                platformId,
            })
        })

    },
})

async function getProjects(params: GetAllParams & { projectIds?: string[] }, log: FastifyBaseLogger): Promise<SeekPage<ProjectWithLimits>> {
    const { cursorRequest, limit, platformId, displayName, externalId, projectIds } = params
    const decodedCursor = paginationHelper.decodeCursor(cursorRequest)
    const paginator = buildPaginator({
        entity: ProjectEntity,
        query: {
            limit,
            order: 'ASC',
            afterCursor: decodedCursor.nextCursor,
            beforeCursor: decodedCursor.previousCursor,
        },
    })
    const displayNameFilter = displayName ? ILike(`%${displayName}%`) : undefined
    const filters = {
        platformId: Equal(platformId),
        ...spreadIfDefined('externalId', externalId),
        ...spreadIfDefined('displayName', displayNameFilter),
        ...(projectIds ? { id: In(projectIds) } : {}),
    }

    const queryBuilder = projectRepo()
        .createQueryBuilder('project')
        .leftJoinAndMapOne(
            'project.plan',
            'project_plan',
            'project_plan',
            'project.id = "project_plan"."projectId"',
        )
        .where(filters)
        .groupBy('project.id')
        .addGroupBy('"project_plan"."id"')

    const { data, cursor } = await paginator.paginate(queryBuilder)
    const projects: ProjectWithLimits[] = await Promise.all(
        data.map((project) => enrichProject(project, log)),
    )
    return paginationHelper.createPage<ProjectWithLimits>(projects, cursor)
}

type GetAllForParamsAndUser = {
    userId: string
} & GetAllParams

type GetAllParams = {
    platformId: string
    displayName?: string
    externalId?: string
    cursorRequest: Cursor | null
    limit: number
}

async function enrichProject(
    project: Project,
    log: FastifyBaseLogger,
): Promise<ProjectWithLimits> {
    const totalUsers = await projectMemberRepo().countBy({
        projectId: project.id,
    })
    const activeUsers = await projectMemberRepo()
        .createQueryBuilder('project_member')
        .leftJoin('user', 'user', 'user.id = project_member."userId"')
        .groupBy('user.id')
        .where('user.status = :activeStatus and project_member."projectId" = :projectId', {
            activeStatus: UserStatus.ACTIVE,
            projectId: project.id,
        })
        .getCount()

    const totalFlows = await flowService(log).count({
        projectId: project.id,
    })

    const activeFlows = await flowService(log).count({
        projectId: project.id,
        status: FlowStatus.ENABLED,
    })


    const platformBilling = await platformPlanService(log).getOrCreateForPlatform(project.platformId)

    const { startDate, endDate } = await platformPlanService(system.globalLogger()).getBillingDates(platformBilling)
    const projectAICreditUsage = await platformUsageService(log).getProjectUsage({ projectId: project.id, metric: 'ai_credits', startDate, endDate })
    return {
        ...project,
        plan: await projectLimitsService(log).getPlanWithPlatformLimits(
            project.id,
        ),
        usage: {
            aiCredits: projectAICreditUsage,
            nextLimitResetDate: endDate,
        },
        analytics: {
            activeFlows,
            totalFlows,
            totalUsers,
            activeUsers,
        },
    }
}

const assertAllProjectFlowsAreDisabled = async (
    params: AssertAllProjectFlowsAreDisabledParams,
    log: FastifyBaseLogger,
): Promise<void> => {
    const { projectId, entityManager } = params

    const projectHasEnabledFlows = await flowService(log).existsByProjectAndStatus({
        projectId,
        status: FlowStatus.ENABLED,
        entityManager,
    })

    if (projectHasEnabledFlows) {
        throw new ActivepiecesError({
            code: ErrorCode.VALIDATION,
            params: {
                message: 'PROJECT_HAS_ENABLED_FLOWS',
            },
        })
    }
}

type UpdateParams = {
    projectId: ProjectId
    request: UpdateProjectPlatformRequest
    platformId?: PlatformId
    userId?: string
}

type AssertAllProjectFlowsAreDisabledParams = {
    projectId: ProjectId
    entityManager: EntityManager
}

type HardDeleteParams = {
    id: ProjectId
    platformId: PlatformId
}
