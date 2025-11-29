import { AppSystemProp, WorkerSystemProp } from '@activepieces/server-shared'
import { Platform, SMTPInformation } from '@activepieces/shared'
import { FastifyBaseLogger } from 'fastify'
import { isNil } from '@activepieces/shared'
import nodemailer, { Transporter } from 'nodemailer'
import { system } from '../../helper/system/system'
import { platformService } from '../../platform/platform.service'

const TEN_MINUTES_MS = 10 * 60 * 1000

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
            log.warn('Password reset email requested but SMTP is not configured')
            return
        }

        const transporter = createSmtpTransporter(smtpConfig)
        
        const emailSubject = 'Reset Your Password'
        const emailBody = `
            <html>
                <body>
                    <h2>Password Reset Request</h2>
                    <p>You requested to reset your password. Click the link below to reset it:</p>
                    <p><a href="${resetLink}">${resetLink}</a></p>
                    <p>This link will expire in 10 minutes.</p>
                    <p>If you didn't request this, please ignore this email.</p>
                </body>
            </html>
        `

        try {
            await transporter.sendMail({
                from: smtpConfig.from,
                to: userEmail,
                subject: emailSubject,
                html: emailBody,
            })
            log.info({ email: userEmail }, 'Password reset email sent')
        } catch (error) {
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
            log.warn('Email verification requested but SMTP is not configured')
            return
        }

        const transporter = createSmtpTransporter(smtpConfig)
        
        const emailSubject = 'Verify Your Email'
        const emailBody = `
            <html>
                <body>
                    <h2>Email Verification</h2>
                    <p>Please click the link below to verify your email address:</p>
                    <p><a href="${verificationLink}">${verificationLink}</a></p>
                    <p>This link will expire in 10 minutes.</p>
                    <p>If you didn't create an account, please ignore this email.</p>
                </body>
            </html>
        `

        try {
            await transporter.sendMail({
                from: smtpConfig.from,
                to: userEmail,
                subject: emailSubject,
                html: emailBody,
            })
            log.info({ email: userEmail }, 'Email verification email sent')
        } catch (error) {
            log.error({ error, email: userEmail }, 'Failed to send email verification email')
            throw error
        }
    },
})

type SmtpConfig = {
    host: string
    port: number
    user: string
    password: string
    from: string
}

function getSmtpConfig(platform: Platform | null): SmtpConfig | null {
    // Check platform SMTP first
    if (platform?.smtp) {
        const smtp = platform.smtp
        if (smtp.host && smtp.port && smtp.user && smtp.password) {
            return {
                host: smtp.host,
                port: smtp.port,
                user: smtp.user,
                password: smtp.password,
                from: smtp.senderEmail || smtp.user,
            }
        }
    }

    // Fall back to system environment variables
    // Use process.env directly for open source compatibility
    const host = process.env.AP_SMTP_HOST
    const port = process.env.AP_SMTP_PORT
    const username = process.env.AP_SMTP_USERNAME
    const password = process.env.AP_SMTP_PASSWORD
    const senderEmail = process.env.AP_SMTP_SENDER_EMAIL

    if (host && port && username && password) {
        return {
            host,
            port: Number.parseInt(port),
            user: username,
            password,
            from: senderEmail || username,
        }
    }

    return null
}

function createSmtpTransporter(smtp: SmtpConfig): Transporter {
    return nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.port === 465, // SSL
        auth: {
            user: smtp.user,
            pass: smtp.password,
        },
    })
}

