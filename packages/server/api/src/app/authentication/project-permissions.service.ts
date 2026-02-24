import {
    ApEdition,
    ProjectId,
    UserId,
    PlatformRole,
} from '@activepieces/shared'
import { FastifyBaseLogger } from 'fastify'
import { system } from '../helper/system/system'
import { projectMemberService } from '../project-members/project-member.service'
import { ProjectMemberRole } from '../project-members/project-member.entity'
import { projectService } from '../project/project-service'
import { userService } from '../user/user-service'

/**
 * Centralized permission resolution service for Community Edition.
 * 
 * This service provides consistent permission checks based on project membership
 * and roles. It does NOT default to EDITOR - returns null for no access.
 */
export const projectPermissionsService = (log: FastifyBaseLogger) => ({
    /**
     * Get user's effective role in project.
     * Returns: 'OWNER' | 'EDITOR' | 'VIEWER' | null
     * null means no access (user is not a member and not the owner)
     */
    async getRole(projectId: ProjectId, userId: UserId): Promise<ProjectMemberRole | null> {
        const edition = system.getEdition()
        if (edition !== ApEdition.COMMUNITY) {
            // For Enterprise/Cloud, this service should not be used
            // Return null to indicate this service doesn't apply
            return null
        }

        const project = await projectService.getOneOrThrow(projectId)
        const user = await userService.getOneOrFail({ id: userId })

        // 1. Platform admins always have OWNER role on all projects in Community Edition
        if (user.platformRole === PlatformRole.ADMIN) {
            return 'OWNER'
        }

        // 2. Project owner always has OWNER role
        if (project.ownerId === userId) {
            return 'OWNER'
        }

        // 3. Check explicit ProjectMember record
        const member = await projectMemberService(log).getByProjectIdAndUserId(projectId, userId)
        if (member) {
            return member.role
        }

        // 3. No access - return null (no default to EDITOR)
        return null
    },

    /**
     * Check if user can view flows in project.
     * Returns true if user has any role (OWNER, EDITOR, or VIEWER).
     */
    async canViewFlows(projectId: ProjectId, userId: UserId): Promise<boolean> {
        const role = await this.getRole(projectId, userId)
        return role !== null // Any role can view
    },

    /**
     * Check if user can edit flows in project.
     * Returns true only if user is OWNER or EDITOR.
     */
    async canEditFlows(projectId: ProjectId, userId: UserId): Promise<boolean> {
        const role = await this.getRole(projectId, userId)
        return role === 'OWNER' || role === 'EDITOR'
    },

    /**
     * Check if user can manage project members (invite, change roles, remove).
     * Returns true only if user is OWNER.
     */
    async canManageProjectMembers(projectId: ProjectId, userId: UserId): Promise<boolean> {
        const role = await this.getRole(projectId, userId)
        return role === 'OWNER'
    },

    /**
     * Check if user can participate in real-time collaboration with write operations.
     * Returns true only if user is OWNER or EDITOR (VIEWER can view but not edit).
     */
    async canParticipateInRealtimeCollab(projectId: ProjectId, userId: UserId): Promise<boolean> {
        const role = await this.getRole(projectId, userId)
        return role === 'OWNER' || role === 'EDITOR'
    },
})

