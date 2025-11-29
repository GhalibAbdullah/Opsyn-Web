import { apId, PlatformId, UserIdentity } from '@activepieces/shared'
import dayjs from 'dayjs'
import { FastifyBaseLogger } from 'fastify'
import { isNil } from '@activepieces/shared'
import { repoFactory } from '../../core/db/repo-factory'
import { userIdentityService } from '../user-identity/user-identity-service'
import { passwordResetOtpGenerator } from './password-reset-otp-generator'
import { PasswordResetOtpEntity, PasswordResetOtpState } from './password-reset-entity'
import { passwordResetEmailService } from './password-reset-email-service'
import { system } from '../../helper/system/system'
import { WorkerSystemProp } from '@activepieces/server-shared'

const TEN_MINUTES_MS = 10 * 60 * 1000

const passwordResetOtpRepo = repoFactory(PasswordResetOtpEntity)

export const passwordResetService = (log: FastifyBaseLogger) => ({
    async requestPasswordReset({
        platformId,
        email,
    }: {
        platformId: PlatformId | null
        email: string
    }): Promise<void> {
        const userIdentity = await userIdentityService(log).getIdentityByEmail(email)
        if (!userIdentity) {
            // Don't reveal if user exists - security best practice
            return
        }

        // Check for existing OTP
        const existingOtp = await passwordResetOtpRepo().findOneBy({
            identityId: userIdentity.id,
        })

        // If OTP exists and is not expired, don't create a new one
        if (existingOtp && existingOtp.state === PasswordResetOtpState.PENDING) {
            const isNotExpired = dayjs().diff(dayjs(existingOtp.updated), 'milliseconds') < TEN_MINUTES_MS
            if (isNotExpired) {
                // Don't send another email if one was recently sent
                return
            }
        }

        // Generate new OTP
        const otpValue = passwordResetOtpGenerator.generate()
        const newOtp = {
            id: apId(),
            created: dayjs().toISOString(),
            updated: dayjs().toISOString(),
            identityId: userIdentity.id,
            value: otpValue,
            state: PasswordResetOtpState.PENDING,
        }

        // Upsert OTP (replace if exists)
        await passwordResetOtpRepo().save(newOtp)

        // Generate reset link - use FRONTEND_URL from system
        const frontendUrl = system.getOrThrow(WorkerSystemProp.FRONTEND_URL)
        const resetLink = `${frontendUrl}/reset-password?otpcode=${otpValue}&identityId=${userIdentity.id}`

        // Send email
        await passwordResetEmailService(log).sendPasswordResetEmail({
            platformId,
            userEmail: userIdentity.email,
            resetLink,
        })
    },

    async resetPassword({
        identityId,
        otp,
        newPassword,
    }: {
        identityId: string
        otp: string
        newPassword: string
    }): Promise<void> {
        const otpRecord = await passwordResetOtpRepo().findOneBy({
            identityId,
        })

        if (!otpRecord) {
            throw new Error('Invalid or expired password reset token')
        }

        // Check if OTP is valid
        const isPending = otpRecord.state === PasswordResetOtpState.PENDING
        const isNotExpired = dayjs().diff(dayjs(otpRecord.updated), 'milliseconds') < TEN_MINUTES_MS
        const otpMatches = otpRecord.value === otp

        if (!isPending || !isNotExpired || !otpMatches) {
            throw new Error('Invalid or expired password reset token')
        }

        // Mark OTP as confirmed
        await passwordResetOtpRepo().update(otpRecord.id, {
            state: PasswordResetOtpState.CONFIRMED,
        })

        // Update password
        await userIdentityService(log).updatePassword({
            id: identityId,
            newPassword,
        })
    },

    async requestEmailVerification({
        platformId,
        email,
    }: {
        platformId: PlatformId | null
        email: string
    }): Promise<void> {
        const userIdentity = await userIdentityService(log).getIdentityByEmail(email)
        if (!userIdentity) {
            // Don't reveal if user exists - security best practice
            return
        }

        // If already verified, don't send email
        if (userIdentity.verified) {
            return
        }

        // Check for existing OTP
        const existingOtp = await passwordResetOtpRepo().findOneBy({
            identityId: userIdentity.id,
        })

        // If OTP exists and is not expired, don't create a new one
        if (existingOtp && existingOtp.state === PasswordResetOtpState.PENDING) {
            const isNotExpired = dayjs().diff(dayjs(existingOtp.updated), 'milliseconds') < TEN_MINUTES_MS
            if (isNotExpired) {
                // Don't send another email if one was recently sent
                return
            }
        }

        // Generate new OTP
        const otpValue = passwordResetOtpGenerator.generate()
        const newOtp = {
            id: apId(),
            created: dayjs().toISOString(),
            updated: dayjs().toISOString(),
            identityId: userIdentity.id,
            value: otpValue,
            state: PasswordResetOtpState.PENDING,
        }

        // Upsert OTP (replace if exists)
        await passwordResetOtpRepo().save(newOtp)

        // Generate verification link
        const frontendUrl = system.getOrThrow(WorkerSystemProp.FRONTEND_URL)
        const verificationLink = `${frontendUrl}/verify-email?otpcode=${otpValue}&identityId=${userIdentity.id}`

        // Send email
        await passwordResetEmailService(log).sendEmailVerificationEmail({
            platformId,
            userEmail: userIdentity.email,
            verificationLink,
        })
    },

    async verifyEmail({
        identityId,
        otp,
    }: {
        identityId: string
        otp: string
    }): Promise<UserIdentity> {
        const otpRecord = await passwordResetOtpRepo().findOneBy({
            identityId,
        })

        if (!otpRecord) {
            throw new Error('Invalid or expired verification token')
        }

        // Check if OTP is valid
        const isPending = otpRecord.state === PasswordResetOtpState.PENDING
        const isNotExpired = dayjs().diff(dayjs(otpRecord.updated), 'milliseconds') < TEN_MINUTES_MS
        const otpMatches = otpRecord.value === otp

        if (!isPending || !isNotExpired || !otpMatches) {
            throw new Error('Invalid or expired verification token')
        }

        // Mark OTP as confirmed
        await passwordResetOtpRepo().update(otpRecord.id, {
            state: PasswordResetOtpState.CONFIRMED,
        })

        // Verify user identity
        return userIdentityService(log).verify(identityId)
    },
})

