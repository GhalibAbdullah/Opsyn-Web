import {
    ListProjectMembersRequestQuery,
    ProjectMemberWithUser,
    UpdateProjectMemberRoleRequestBody,
} from '@activepieces/ee-shared'
import {
    Permission,
    PrincipalType,
    SeekPage,
    SERVICE_KEY_SECURITY_OPENAPI,
} from '@activepieces/shared'
import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { Type } from '@sinclair/typebox'
import { StatusCodes } from 'http-status-codes'
import { assertProjectId } from '../../../authentication/authentication-utils'
import { projectMemberService } from './project-member.service'

const DEFAULT_LIMIT_SIZE = 10

export const projectMemberController: FastifyPluginAsyncTypebox = async (
    app,
) => {

    app.get('/role', GetCurrentProjectMemberRoleRequest, async (request) => {
        assertProjectId(request.principal)
        return  projectMemberService(request.log).getRole({
            projectId: request.principal.projectId,
            userId: request.principal.id,
        })
    })

    app.get('/', ListProjectMembersRequestQueryOptions, async (request) => {
        assertProjectId(request.principal)
        return projectMemberService(request.log).list({
            platformId: request.principal.platform.id,  
            projectId: request.principal.projectId ?? undefined,
            cursorRequest: request.query.cursor ?? null,
            limit: request.query.limit ?? DEFAULT_LIMIT_SIZE,
            projectRoleId: request.query.projectRoleId ?? undefined,
        })
    })

    // Self-service: allow a user to leave the current project by removing their own membership.
    // This does NOT allow them to delete the project or remove other members.
    app.delete('/self', DeleteSelfProjectMemberRequest, async (request, reply) => {
        assertProjectId(request.principal)
        await projectMemberService(request.log).deleteSelf({
            projectId: request.principal.projectId,
            userId: request.principal.id,
        })
        await reply.status(StatusCodes.NO_CONTENT).send()
    })

    app.post('/:id', UpdateProjectMemberRoleRequest, async (req) => {
        assertProjectId(req.principal)
        return projectMemberService(req.log).update({
            id: req.params.id,
            role: req.body.role,
            projectId: req.principal.projectId,
            platformId: req.principal.platform.id,
        })
    })


    app.delete('/:id', DeleteProjectMemberRequest, async (request, reply) => {
        assertProjectId(request.principal)
        await projectMemberService(request.log).delete(
            request.principal.projectId,
            request.params.id,
        )
        await reply.status(StatusCodes.NO_CONTENT).send()
    })
}

const GetCurrentProjectMemberRoleRequest = {
    config: {
        allowedPrincipals: [PrincipalType.USER] as const,
    },
    schema: {

    },
}

const UpdateProjectMemberRoleRequest = {
    config: {
        allowedPrincipals: [PrincipalType.USER, PrincipalType.SERVICE] as const,
        permission: Permission.WRITE_PROJECT_MEMBER,
    },
    schema: {
        params: Type.Object({
            id: Type.String(),
        }),
        body: UpdateProjectMemberRoleRequestBody,
    },
    response: {
        [StatusCodes.OK]: ProjectMemberWithUser,
    },
}

const ListProjectMembersRequestQueryOptions = {
    config: {
        allowedPrincipals: [PrincipalType.USER, PrincipalType.SERVICE] as const,
        permission: Permission.READ_PROJECT_MEMBER,
    },
    schema: {
        tags: ['project-members'],
        security: [SERVICE_KEY_SECURITY_OPENAPI],
        querystring: ListProjectMembersRequestQuery,
        response: {
            [StatusCodes.OK]: SeekPage(ProjectMemberWithUser),
        },
    },
}

const DeleteProjectMemberRequest = {
    config: {
        allowedPrincipals: [PrincipalType.USER, PrincipalType.SERVICE] as const,
        permission: Permission.WRITE_PROJECT_MEMBER,
    },
    schema: {
        tags: ['project-members'],
        security: [SERVICE_KEY_SECURITY_OPENAPI],
        response: {
            [StatusCodes.NO_CONTENT]: Type.Never(),
        },
        params: Type.Object({
            id: Type.String(),
        }),
    },
}

const DeleteSelfProjectMemberRequest = {
    config: {
        // Any authenticated user can remove THEIR OWN membership from the current project.
        // Permissions for removing OTHER members remain enforced on the /:id route above.
        allowedPrincipals: [PrincipalType.USER] as const,
    },
    schema: {
        tags: ['project-members'],
        security: [SERVICE_KEY_SECURITY_OPENAPI],
        response: {
            [StatusCodes.NO_CONTENT]: Type.Never(),
        },
    },
}
