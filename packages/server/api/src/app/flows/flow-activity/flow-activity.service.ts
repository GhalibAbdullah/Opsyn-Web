import {
    ActivepiecesError,
    ApId,
    apId,
    Cursor,
    ErrorCode,
    FlowActivity,
    FlowActivityAction,
    FlowActivityWithUser,
    FlowId,
    isNil,
    ProjectId,
    SeekPage,
    spreadIfDefined,
    UserId,
} from '@activepieces/shared'
import { FastifyBaseLogger } from 'fastify'
import { In } from 'typeorm'
import { repoFactory } from '../../core/db/repo-factory'
import { buildPaginator } from '../../helper/pagination/build-paginator'
import { paginationHelper } from '../../helper/pagination/pagination-utils'
import { Order } from '../../helper/pagination/paginator'
import { userService } from '../../user/user-service'
import { FlowActivityEntity } from './flow-activity.entity'

const repo = repoFactory(FlowActivityEntity)

export const flowActivityService = (log: FastifyBaseLogger) => ({
    async create(params: CreateParams): Promise<FlowActivity> {
        const activity = repo().create({
            id: apId(),
            flowId: params.flowId,
            projectId: params.projectId,
            ...spreadIfDefined('userId', params.userId),
            action: params.action,
            ...spreadIfDefined('operationType', params.operationType),
            message: params.message,
            ...spreadIfDefined('details', params.details),
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
        })
        const savedActivity = await repo().save(activity)
        log.debug({ flowId: params.flowId, action: params.action }, '[FlowActivityService#create] Activity logged')
        return savedActivity
    },

    async list(params: ListParams): Promise<SeekPage<FlowActivityWithUser>> {
        const decodedCursor = paginationHelper.decodeCursor(params.cursor)
        const paginator = buildPaginator<FlowActivity>({
            entity: FlowActivityEntity,
            query: {
                limit: params.limit,
                order: Order.DESC,
                orderBy: 'created',
                afterCursor: decodedCursor.nextCursor,
                beforeCursor: decodedCursor.previousCursor,
            },
        })

        const query = repo().createQueryBuilder('flow_activity').where({
            flowId: params.flowId,
            projectId: params.projectId,
        })

        if (!isNil(params.action) && params.action.length > 0) {
            query.andWhere({ action: In(params.action) })
        }

        if (!isNil(params.userId)) {
            query.andWhere({ userId: params.userId })
        }

        if (!isNil(params.createdAfter)) {
            query.andWhere('flow_activity.created >= :createdAfter', {
                createdAfter: params.createdAfter,
            })
        }

        if (!isNil(params.createdBefore)) {
            query.andWhere('flow_activity.created <= :createdBefore', {
                createdBefore: params.createdBefore,
            })
        }

        if (!isNil(params.search)) {
            query.andWhere('flow_activity.message LIKE :search', {
                search: `%${params.search}%`,
            })
        }

        const { data, cursor: newCursor } = await paginator.paginate(query)
        const enrichedData = await Promise.all(
            data.map(async (activity) => {
                return enrichFlowActivityWithUser(activity)
            }),
        )
        return paginationHelper.createPage<FlowActivityWithUser>(enrichedData, newCursor)
    },

    async getOne(params: GetParams): Promise<FlowActivity | null> {
        return repo().findOneBy({ id: params.id })
    },

    async getOneOrThrow(params: GetParams): Promise<FlowActivity> {
        const flowActivity = await this.getOne(params)
        if (!flowActivity) {
            throw new ActivepiecesError({
                code: ErrorCode.ENTITY_NOT_FOUND,
                params: {
                    entityType: 'flow_activity',
                    entityId: params.id,
                    message: 'Flow activity by id not found',
                },
            })
        }
        return flowActivity
    },
})

async function enrichFlowActivityWithUser(
    activity: FlowActivity,
): Promise<FlowActivityWithUser> {
    const user = isNil(activity.userId)
        ? null
        : await userService.getMetaInformation({
              id: activity.userId,
          })
    return {
        ...activity,
        user,
    }
}

type GetParams = {
    id: string
}

type ListParams = {
    flowId: FlowId
    projectId: ProjectId
    limit: number
    cursor: Cursor | null
    action?: FlowActivityAction[]
    userId?: UserId
    createdAfter?: string
    createdBefore?: string
    search?: string
}

type CreateParams = {
    flowId: FlowId
    projectId: ProjectId
    userId: UserId | null
    action: FlowActivityAction
    operationType?: string
    message: string
    details?: Record<string, unknown>
}

