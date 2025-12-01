import {
    ActivepiecesError,
    assertNotNullOrUndefined,
    ErrorCode,
    PrincipalType,
} from '@activepieces/shared'
import { FastifyRequest } from 'fastify'
import { requestUtils } from '../../request/request-utils'
import { BaseSecurityHandler } from '../security-handler'
import { userHasProjectAccess } from '../../../authentication/permission-helpers'

export class ProjectAuthzHandler extends BaseSecurityHandler {
    private static readonly IGNORED_ROUTES = [
        '/v1/admin/pieces',
        '/v1/admin/platforms',
        '/v1/app-credentials',
        '/v1/authentication/switch-project',
        '/v1/authentication/switch-platform',
        '/v1/webhooks',
        '/v1/webhooks/:flowId',
        '/v1/webhooks/:flowId/test',
        '/v1/webhooks/:flowId/sync',
        // This works for both platform and project, we have to check this manually
        '/v1/user-invitations',
        '/v1/audit-events',
    ]

    protected canHandle(request: FastifyRequest): Promise<boolean> {
        // Some routes may not have routeOptions.url set, skip authorization for those
        const routerPath = request.routeOptions?.url
        if (!routerPath) {
            return Promise.resolve(false)
        }
        const requestMatches = !ProjectAuthzHandler.IGNORED_ROUTES.includes(
            routerPath,
        )
        return Promise.resolve(requestMatches)
    }

    protected async doHandle(request: FastifyRequest): Promise<void> {
        const principal = request.principal
        if (principal.type === PrincipalType.WORKER || principal.type === PrincipalType.UNKNOWN) {
            return Promise.resolve()
        }

        const projectId = requestUtils.extractProjectId(request)

        if (projectId && projectId !== principal.projectId) {
            throw new ActivepiecesError({
                code: ErrorCode.AUTHORIZATION,
                params: {
                    message: 'invalid project id',
                },
            })
        }

        // Also verify that the user actually has access to the project
        // This prevents users with old tokens from accessing projects they were removed from
        if (projectId && principal.type === PrincipalType.USER) {
            const hasAccess = await userHasProjectAccess(projectId, principal.id, request.log)
            if (!hasAccess) {
                throw new ActivepiecesError({
                    code: ErrorCode.AUTHORIZATION,
                    params: {
                        message: 'You do not have access to this project',
                    },
                })
            }
        }

        return Promise.resolve()
    }
}
