import {
    ApId,
    apId,
    Cursor,
    FlowActivity,
    FlowActivityAction,
    FlowActivityWithUser,
    FlowId,
    isNil,
    ProjectId,
    SeekPage,
    UserId,
} from '@activepieces/shared'
import { FastifyBaseLogger } from 'fastify'
import { repoFactory } from '../../core/db/repo-factory'
import { buildPaginator } from '../../helper/pagination/build-paginator'
import { paginationHelper } from '../../helper/pagination/pagination-utils'
import { userService } from '../../user/user-service'
import { userIdentityService } from '../../authentication/user-identity/user-identity-service'
import {
    FlowActivityEntity,
    FlowActivitySchema,
} from './flow-activity.entity'

const repo = repoFactory(FlowActivityEntity)

export const flowActivityService = (log: FastifyBaseLogger) => ({
    async create({
        projectId,
        flowId,
        userId,
        actionType,
        metadata,
    }: CreateParams): Promise<FlowActivity> {
        const activity: Omit<FlowActivitySchema, 'user' | 'project' | 'flow' | 'created' | 'updated'> = {
            id: apId(),
            projectId,
            flowId,
            userId: userId ?? null,
            actionType,
            metadata: metadata ?? null,
        }

        const saved = await repo().save(activity)
        return saved
    },

    async list({
        projectId,
        flowId,
        cursorRequest,
        limit,
        actionType,
    }: ListParams): Promise<SeekPage<FlowActivityWithUser>> {
        const decodedCursor = paginationHelper.decodeCursor(cursorRequest)
        const paginator = buildPaginator({
            entity: FlowActivityEntity,
            query: {
                limit,
                order: 'DESC',
                orderBy: 'created',
                afterCursor: decodedCursor.nextCursor,
                beforeCursor: decodedCursor.previousCursor,
            },
        })

        const queryBuilder = repo()
            .createQueryBuilder('flow_activity')
            .where({ projectId })

        if (flowId) {
            queryBuilder.andWhere({ flowId })
        }

        if (actionType) {
            queryBuilder.andWhere({ actionType })
        }

        const { data, cursor } = await paginator.paginate(queryBuilder)

        const enrichedData: FlowActivityWithUser[] = await Promise.all(
            data.map(async (activity) => {
                let user = null
                if (activity.userId) {
                    try {
                        const userEntity = await userService.getOneOrFail({ id: activity.userId })
                        const identity = await userIdentityService(log).getBasicInformation(userEntity.identityId)
                        user = {
                            id: userEntity.id,
                            email: identity.email,
                            firstName: identity.firstName,
                            lastName: identity.lastName,
                            platformId: userEntity.platformId ?? '',
                            platformRole: userEntity.platformRole,
                            status: userEntity.status,
                            externalId: userEntity.externalId ?? null,
                            created: userEntity.created,
                            updated: userEntity.updated,
                        }
                    } catch (error) {
                        log.warn({ userId: activity.userId, error }, 'Failed to load user for activity')
                    }
                }

                return {
                    ...activity,
                    user,
                }
            }),
        )

        return paginationHelper.createPage<FlowActivityWithUser>(enrichedData, cursor)
    },
})

type CreateParams = {
    projectId: ProjectId
    flowId: FlowId
    userId: UserId | null
    actionType: FlowActivityAction
    metadata?: Record<string, unknown>
}

type ListParams = {
    projectId: ProjectId
    flowId?: FlowId
    cursorRequest: Cursor | null
    limit: number
    actionType?: string
}

