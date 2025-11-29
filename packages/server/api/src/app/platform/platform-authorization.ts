import {
    ActivepiecesError,
    ErrorCode,
    isNil,
    PrincipalType,
} from '@activepieces/shared'
import { FastifyRequest, onRequestAsyncHookHandler } from 'fastify'
import { platformService } from './platform.service'
import { userService } from '../user/user-service'

/**
 * Open source authorization check - verifies user can access their platform
 * In Community Edition, users own their platform, so we check if:
 * 1. User's platformId matches the requested platform, OR
 * 2. User is the owner of the platform (via platform.ownerId)
 */
const checkIfUserCanAccessPlatform = async (platformId: string, request: FastifyRequest) => {
    if (isNil(platformId)) {
        throw new ActivepiecesError({
            code: ErrorCode.AUTHORIZATION,
            params: {
                message: 'Platform ID is required',
            },
        })
    }

    const isApiKey = request.principal.type === PrincipalType.SERVICE
    if (isApiKey) {
        return
    }

    const user = await userService.getOneOrFail({
        id: request.principal.id,
    })

    if (isNil(user)) {
        throw new ActivepiecesError({
            code: ErrorCode.AUTHORIZATION,
            params: {
                message: 'User is not found',
            },
        })
    }

    // Check if user's platformId matches (primary check)
    if (user.platformId === platformId) {
        return
    }

    // Fallback: Check if user is the owner of the platform
    // This handles cases where platformId might not be set yet
    const platform = await platformService.getOneOrThrow(platformId)
    if (platform.ownerId === user.id) {
        return
    }

    // User doesn't have access
    throw new ActivepiecesError({
        code: ErrorCode.AUTHORIZATION,
        params: {
            message: `You are not authorized to access this platform. User platformId: ${user.platformId}, Requested platformId: ${platformId}, Platform ownerId: ${platform.ownerId}, User id: ${user.id}`,
        },
    })
}

/**
 * Open source authorization - checks if user can access their current platform
 */
export const platformMustBeAccessibleByCurrentUser: onRequestAsyncHookHandler =
    async (request, _res) => {
        const principal = request.principal
        if (principal.type !== PrincipalType.USER && principal.type !== PrincipalType.SERVICE) {
            throw new ActivepiecesError({
                code: ErrorCode.AUTHORIZATION,
                params: {
                    message: 'You are unauthenticated and cannot access this resource',
                },
            })
        }
        const platformId = principal.platform.id
        await checkIfUserCanAccessPlatform(platformId, request)
    }

/**
 * Open source authorization - checks if user can edit the specified platform
 */
export const platformToEditMustBeAccessibleByCurrentUser: onRequestAsyncHookHandler =
    async (request, _res) => {
        if (!request.params || typeof request.params !== 'object' || !('id' in request.params) || typeof request.params.id !== 'string') {
            throw new ActivepiecesError({
                code: ErrorCode.AUTHORIZATION,
                params: {
                    message: 'Platform ID is required',
                },
            })
        }
        
        await checkIfUserCanAccessPlatform(request.params.id, request)
    }

