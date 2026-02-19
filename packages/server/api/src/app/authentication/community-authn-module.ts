import { Static, Type } from '@sinclair/typebox'
import { ALL_PRINCIPAL_TYPES, ApId } from '@activepieces/shared'
import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { StatusCodes } from 'http-status-codes'
import { platformUtils } from '../platform/platform.utils'
import { passwordResetService } from './password-reset/password-reset-service'

enum OtpType {
    EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
    PASSWORD_RESET = 'PASSWORD_RESET',
}

const CreateOtpRequestBody = Type.Object({
    email: Type.String(),
    type: Type.Enum(OtpType),
})
type CreateOtpRequestBody = Static<typeof CreateOtpRequestBody>

const ResetPasswordRequestBody = Type.Object({
    identityId: ApId,
    otp: Type.String(),
    newPassword: Type.String(),
})
type ResetPasswordRequestBody = Static<typeof ResetPasswordRequestBody>

const VerifyEmailRequestBody = Type.Object({
    identityId: ApId,
    otp: Type.String(),
})
type VerifyEmailRequestBody = Static<typeof VerifyEmailRequestBody>

const otpController: FastifyPluginAsyncTypebox = async (app) => {
    app.post('/', {
        config: { allowedPrincipals: ALL_PRINCIPAL_TYPES },
        schema: { body: CreateOtpRequestBody },
    }, async (req, res) => {
        const platformId = await platformUtils.getPlatformIdForRequest(req)
        if (req.body.type === OtpType.PASSWORD_RESET) {
            await passwordResetService(req.log).requestPasswordReset({
                platformId,
                email: req.body.email,
            })
        }
        else {
            await passwordResetService(req.log).requestEmailVerification({
                platformId,
                email: req.body.email,
            })
        }
        return res.code(StatusCodes.NO_CONTENT).send()
    })
}

const localAuthnController: FastifyPluginAsyncTypebox = async (app) => {
    app.post('/reset-password', {
        config: { allowedPrincipals: ALL_PRINCIPAL_TYPES },
        schema: { body: ResetPasswordRequestBody },
    }, async (req) => {
        await passwordResetService(req.log).resetPassword(req.body)
    })

    app.post('/verify-email', {
        config: { allowedPrincipals: ALL_PRINCIPAL_TYPES },
        schema: { body: VerifyEmailRequestBody },
    }, async (req) => {
        await passwordResetService(req.log).verifyEmail(req.body)
    })
}

export const communityAuthnModule: FastifyPluginAsyncTypebox = async (app) => {
    await app.register(otpController, { prefix: '/v1/otp' })
    await app.register(localAuthnController, { prefix: '/v1/authn/local' })
}
