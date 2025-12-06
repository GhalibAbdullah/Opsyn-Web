import { ApEdition, FilteredPieceBehavior, isNil, PiecesFilterType, Platform } from '@activepieces/shared'
import { system } from '../../../helper/system/system'
import { PieceMetadataSchema } from '../../../pieces/piece-metadata-entity'
import { platformService } from '../../../platform/platform.service'

export const enterpriseFilteringUtils = {
    async filter(params: FilterParams): Promise<PieceMetadataSchema[]> {
        const edition = system.getEdition()
        const { platformId, includeHidden, pieces, projectId } = params
        
        // If includeHidden is true, skip all filtering - return all pieces
        // This is needed for the pieces management page where users need to see
        // all pieces (including disabled ones) to toggle them
        if (includeHidden) {
            return pieces
        }
        
        // Always allow project-level filtering (for all editions)
        // ProjectPlanEntity is now available in Community Edition too
        if (!isNil(projectId)) {
            return filterBasedOnProject(projectId, pieces)
        }
        
        // Platform-level filtering is enterprise-only
        if (![ApEdition.ENTERPRISE, ApEdition.CLOUD].includes(edition)) {
            return params.pieces
        }
        
        if (isNil(platformId)) {
            return pieces
        }

        const platformWithPlan = await platformService.getOne(platformId)
        if (isNil(platformWithPlan)) {
            return pieces
        }
        return filterPiecesBasedPlatform(platformWithPlan, pieces)
    },
    async isFiltered({ piece, projectId, platformId }: IsFilteredParams): Promise<boolean> {
        const filteredPieces = await enterpriseFilteringUtils.filter({
            pieces: [piece],
            projectId,
            platformId,
        })
        return filteredPieces.length === 0
    },
}

type IsFilteredParams = {
    piece: PieceMetadataSchema
    projectId: string | undefined
    platformId: string | undefined
}

type FilterParams = {
    platformId?: string
    includeHidden?: boolean
    pieces: PieceMetadataSchema[]
    projectId?: string
}

async function filterBasedOnProject(
    projectId: string,
    pieces: PieceMetadataSchema[],
): Promise<PieceMetadataSchema[]> {
    const edition = system.getEdition()
    const log = system.globalLogger()
    // Use CE service for Community Edition, EE service for Enterprise/Cloud
    let projectPlan: { pieces: string[], piecesFilterType: PiecesFilterType }
    if (edition === ApEdition.COMMUNITY) {
        const { projectPlanService } = require('../../../project/project-plan.service')
        projectPlan = await projectPlanService(log).getOrCreateDefaultPlan(projectId)
    } else {
        const { projectLimitsService } = require('../../projects/project-plan/project-plan.service')
        projectPlan = await projectLimitsService(log).getOrCreateDefaultPlan(projectId)
    }
    const { pieces: allowedPieces, piecesFilterType } = projectPlan

    log.debug({
        name: 'filterBasedOnProject',
        projectId,
        piecesFilterType,
        allowedPiecesCount: allowedPieces.length,
        allowedPieces: allowedPieces.slice(0, 10), // Log first 10 for debugging
        totalPiecesBeforeFilter: pieces.length,
    })

    const filterPredicate: Record<
    PiecesFilterType,
    (p: PieceMetadataSchema) => boolean
    > = {
        [PiecesFilterType.NONE]: () => true,
        [PiecesFilterType.ALLOWED]: (p) => {
            const isAllowed = allowedPieces.includes(p.name)
            if (!isAllowed) {
                log.debug({
                    name: 'filterBasedOnProject',
                    message: `Piece ${p.name} filtered out`,
                    pieceName: p.name,
                    allowedPieces: allowedPieces,
                })
            }
            return isAllowed
        },
    }

    const predicate = filterPredicate[piecesFilterType]
    const filtered = pieces.slice().filter(predicate)
    
    log.debug({
        name: 'filterBasedOnProject',
        projectId,
        piecesFilterType,
        totalPiecesAfterFilter: filtered.length,
    })
    
    return filtered
}

/*
    @deprecated This function is deprecated and will be removed in the future. replaced with project filtering
*/
async function filterPiecesBasedPlatform(
    platformWithPlan: Platform,
    pieces: PieceMetadataSchema[],
): Promise<PieceMetadataSchema[]> {

    const filterPredicate: Record<
    FilteredPieceBehavior,
    (p: PieceMetadataSchema) => boolean
    > = {
        [FilteredPieceBehavior.ALLOWED]: (p) =>
            platformWithPlan.filteredPieceNames.includes(p.name),
        [FilteredPieceBehavior.BLOCKED]: (p) =>
            !platformWithPlan.filteredPieceNames.includes(p.name),
    }

    const predicate = filterPredicate[platformWithPlan.filteredPieceBehavior]
    const filteredPieces = pieces.slice().filter(predicate)
    return filteredPieces
}
