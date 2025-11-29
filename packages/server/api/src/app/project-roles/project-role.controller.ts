import {
    ApEdition,
    EndpointScope,
    PrincipalType,
    ProjectRole,
    SeekPage,
} from '@activepieces/shared'
import { FastifyPluginAsyncTypebox, Type } from '@fastify/type-provider-typebox'
import { StatusCodes } from 'http-status-codes'
import { system } from '../helper/system/system'
import { paginationHelper } from '../helper/pagination/pagination-utils'

/**
 * CE-only project role controller.
 * Returns simple roles: OWNER, EDITOR, VIEWER
 * This is a compatibility layer for frontend code that expects project roles.
 */
export const projectRoleController: FastifyPluginAsyncTypebox = async (app) => {
    const edition = system.getEdition()
    
    // Only register in Community Edition
    if (edition !== ApEdition.COMMUNITY) {
        return
    }

    // List project roles (returns simple CE roles)
    app.get('/', ListProjectRolesRequest, async (request) => {
        const now = new Date().toISOString()
        const platformId = request.principal.platform.id
        
        // Return basic CE roles as ProjectRole objects for compatibility
        const roles: ProjectRole[] = [
            {
                id: 'owner',
                name: 'OWNER',
                created: now,
                updated: now,
                platformId: platformId,
                permissions: [],
                type: 'CUSTOM',
            },
            {
                id: 'editor',
                name: 'EDITOR',
                created: now,
                updated: now,
                platformId: platformId,
                permissions: [],
                type: 'CUSTOM',
            },
            {
                id: 'viewer',
                name: 'VIEWER',
                created: now,
                updated: now,
                platformId: platformId,
                permissions: [],
                type: 'CUSTOM',
            },
        ]

        return paginationHelper.createPage(roles, null)
    })
}

const ListProjectRolesRequest = {
    config: {
        allowedPrincipals: [PrincipalType.USER] as const,
        scope: EndpointScope.PLATFORM,
    },
    schema: {
        tags: ['project-roles'],
        response: {
            [StatusCodes.OK]: SeekPage(ProjectRole),
        },
    },
}

