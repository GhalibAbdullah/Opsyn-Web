import { FastifyBaseLogger } from 'fastify'
import { platformService } from '../../platform/platform.service'
import { defaultTheme } from '../../flags/theme'
import { brandedEmailTemplate, getSmtpConfig, createSmtpTransporter } from '../../helper/community-email'

export const passwordResetEmailService = (log: FastifyBaseLogger) => ({
    async sendPasswordResetEmail({
        platformId,
        userEmail,
        resetLink,
    }: {
        platformId: string | null
        userEmail: string
        resetLink: string
    }): Promise<void> {
        const platform = platformId ? await platformService.getOneOrThrow(platformId) : null
        const smtpConfig = getSmtpConfig(platform)

        if (!smtpConfig) {
            log.warn({
                email: userEmail,
                resetLink,
            }, `[NO SMTP] Password reset link for ${userEmail} (copy this link): ${resetLink}`)
            return
        }

        const transporter = createSmtpTransporter(smtpConfig)
        const primaryColor = defaultTheme.colors.primary.default

        const emailBody = brandedEmailTemplate({
            heading: 'Reset Your Password',
            bodyHtml: `
              <p style="margin:0 0 16px">You requested to reset your password. Click the button below to choose a new one:</p>
              <p style="text-align:center;margin:24px 0">
                <a href="${resetLink}" style="display:inline-block;padding:12px 32px;background-color:${primaryColor};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px">Reset Password</a>
              </p>
              <p style="margin:0 0 8px;font-size:13px;color:#94a3b8">This link will expire in 10 minutes.</p>
              <p style="margin:0;font-size:13px;color:#94a3b8">If you didn&rsquo;t request this, please ignore this email.</p>`,
        })

        try {
            await transporter.sendMail({
                from: smtpConfig.from,
                to: userEmail,
                subject: 'Reset Your Password — OpSyn',
                html: emailBody,
            })
            log.info({ email: userEmail }, 'Password reset email sent')
        }
        catch (error) {
            log.error({ error, email: userEmail }, 'Failed to send password reset email')
            throw error
        }
    },

    async sendEmailVerificationEmail({
        platformId,
        userEmail,
        verificationLink,
    }: {
        platformId: string | null
        userEmail: string
        verificationLink: string
    }): Promise<void> {
        const platform = platformId ? await platformService.getOneOrThrow(platformId) : null
        const smtpConfig = getSmtpConfig(platform)

        if (!smtpConfig) {
            log.warn({
                email: userEmail,
                verificationLink,
            }, `[NO SMTP] Email verification link for ${userEmail} (copy this link): ${verificationLink}`)
            return
        }

        const transporter = createSmtpTransporter(smtpConfig)
        const primaryColor = defaultTheme.colors.primary.default

        const emailBody = brandedEmailTemplate({
            heading: 'Verify Your Email',
            bodyHtml: `
              <p style="margin:0 0 16px">Please click the button below to verify your email address:</p>
              <p style="text-align:center;margin:24px 0">
                <a href="${verificationLink}" style="display:inline-block;padding:12px 32px;background-color:${primaryColor};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px">Verify Email</a>
              </p>
              <p style="margin:0 0 8px;font-size:13px;color:#94a3b8">This link will expire in 10 minutes.</p>
              <p style="margin:0;font-size:13px;color:#94a3b8">If you didn&rsquo;t create an account, please ignore this email.</p>`,
        })

        try {
            await transporter.sendMail({
                from: smtpConfig.from,
                to: userEmail,
                subject: 'Verify Your Email — OpSyn',
                html: emailBody,
            })
            log.info({ email: userEmail }, 'Email verification email sent')
        }
        catch (error) {
            log.error({ error, email: userEmail }, 'Failed to send email verification email')
            throw error
        }
    },
})
