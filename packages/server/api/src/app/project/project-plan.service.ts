import {
    apId,
    isNil,
    PiecesFilterType,
    ProjectPlan,
    spreadIfDefined,
    spreadIfNotUndefined,
} from '@activepieces/shared'
import { FastifyBaseLogger } from 'fastify'
import { repoFactory } from '../core/db/repo-factory'
import { ProjectPlanEntity } from './project-plan.entity'

const projectPlanRepo = repoFactory<ProjectPlan>(ProjectPlanEntity)

// Community Edition version - simplified, no enterprise dependencies
export const projectPlanService = (log: FastifyBaseLogger) => ({
    async upsert(
        planLimits: {
            pieces?: string[]
            piecesFilterType?: PiecesFilterType
            aiCredits?: number | null
            nickname?: string
            locked?: boolean
        },
        projectId: string,
    ): Promise<ProjectPlan> {
        const projectPlan = await this.getOrCreateDefaultPlan(projectId)
        const updateData: Partial<ProjectPlan> = {
            ...spreadIfNotUndefined('aiCredits', planLimits.aiCredits),
            ...spreadIfDefined('name', planLimits.nickname),
            ...spreadIfDefined('locked', planLimits.locked),
        }
        
        // Always update pieces if provided (even if empty array) to ensure filtering works
        if (planLimits.pieces !== undefined) {
            updateData.pieces = planLimits.pieces
        }
        
        // Always update piecesFilterType if provided
        if (planLimits.piecesFilterType !== undefined) {
            updateData.piecesFilterType = planLimits.piecesFilterType
        }
        
        log.debug({
            name: 'projectPlanService.upsert',
            projectId,
            updateData: {
                piecesCount: updateData.pieces?.length ?? 'not provided',
                piecesFilterType: updateData.piecesFilterType ?? 'not provided',
                pieces: updateData.pieces?.slice(0, 10) ?? 'not provided',
            },
        })
        
        await projectPlanRepo().update(projectPlan.id, updateData)
        const updated = await projectPlanRepo().findOneByOrFail({ projectId })
        
        log.debug({
            name: 'projectPlanService.upsert',
            projectId,
            afterUpdate: {
                piecesCount: updated.pieces.length,
                piecesFilterType: updated.piecesFilterType,
                pieces: updated.pieces.slice(0, 10),
            },
        })
        
        return updated
    },

    async getOrCreateDefaultPlan(projectId: string): Promise<ProjectPlan> {
        const existingPlan = await projectPlanRepo().findOneBy({ projectId })

        if (!isNil(existingPlan)) {
            return existingPlan
        }

        await projectPlanRepo().upsert({
            id: apId(),
            projectId,
            pieces: [],
            piecesFilterType: PiecesFilterType.NONE,
            locked: false,
            aiCredits: null,
            name: 'free',
        }, ['projectId'])

        return projectPlanRepo().findOneByOrFail({ projectId })
    },
})

