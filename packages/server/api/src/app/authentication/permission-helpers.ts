import {
    ActivepiecesError,
    ApEdition,
    ErrorCode,
    ProjectId,
    UserId,
} from '@activepieces/shared'
import { FastifyBaseLogger } from 'fastify'
import { system } from '../helper/system/system'
import { projectMemberService } from '../project-members/project-member.service'
import { ProjectMemberRole } from '../project-members/project-member.entity'
import { projectPermissionsService } from './project-permissions.service'

/**
 * Check if user can edit flows (OWNER or EDITOR)
 * Throws error if user is VIEWER or doesn't have permission
 */
export async function assertCanEditFlow(
    projectId: ProjectId,
    userId: UserId,
    log: FastifyBaseLogger,
): Promise<void> {
    const edition = system.getEdition()
    if (edition !== ApEdition.COMMUNITY) {
        // For Enterprise/Cloud, use existing RBAC system
        return
    }

    const canEdit = await projectPermissionsService(log).canEditFlows(projectId, userId)
    if (!canEdit) {
        // For CE, projectRole should be null (we use ProjectMemberRole strings, not Enterprise ProjectRole objects)
        throw new ActivepiecesError({
            code: ErrorCode.PERMISSION_DENIED,
            params: {
                userId,
                projectId,
                projectRole: null,
                permission: undefined,
            },
        })
    }
}

/**
 * Check if user can manage team (OWNER only)
 * Throws error if user is not OWNER
 */
export async function assertCanManageTeam(
    projectId: ProjectId,
    userId: UserId,
    log: FastifyBaseLogger,
): Promise<void> {
    const edition = system.getEdition()
    if (edition !== ApEdition.COMMUNITY) {
        // For Enterprise/Cloud, use existing RBAC system
        return
    }

    const canManage = await projectPermissionsService(log).canManageProjectMembers(projectId, userId)
    if (!canManage) {
        // For CE, projectRole should be null (we use ProjectMemberRole strings, not Enterprise ProjectRole objects)
        throw new ActivepiecesError({
            code: ErrorCode.PERMISSION_DENIED,
            params: {
                userId,
                projectId,
                projectRole: null,
                permission: undefined,
            },
        })
    }
}

/**
 * Get user's role in project
 * Returns 'OWNER', 'EDITOR', or 'VIEWER'
 * Returns null if user has no access (no default to EDITOR)
 */
export async function getUserProjectRole(
    projectId: ProjectId,
    userId: UserId,
    log: FastifyBaseLogger,
): Promise<ProjectMemberRole | null> {
    const edition = system.getEdition()
    if (edition !== ApEdition.COMMUNITY) {
        // For Enterprise/Cloud, this should not be used
        // Return null to indicate this service doesn't apply
        return null
    }

    return await projectPermissionsService(log).getRole(projectId, userId)
}

/**
 * Check if user has access to project (has ProjectMember record or is owner)
 * Returns true if user has access, false otherwise
 */
export async function userHasProjectAccess(
    projectId: ProjectId,
    userId: UserId,
    log: FastifyBaseLogger,
): Promise<boolean> {
    const edition = system.getEdition()
    if (edition !== ApEdition.COMMUNITY) {
        // For Enterprise/Cloud, assume access (existing RBAC handles this)
        return true
    }

    try {
        return await projectPermissionsService(log).canViewFlows(projectId, userId)
    } catch (error) {
        log.warn({ projectId, userId, error }, '[userHasProjectAccess] Error checking access')
        return false
    }
}

