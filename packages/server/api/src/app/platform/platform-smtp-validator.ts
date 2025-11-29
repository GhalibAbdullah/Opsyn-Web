import { ActivepiecesError, ErrorCode, SMTPInformation } from '@activepieces/shared'
import { FastifyBaseLogger } from 'fastify'
import nodemailer, { Transporter } from 'nodemailer'

/**
 * Open source SMTP validation - validates SMTP credentials by testing the connection
 */
export const validateSmtpCredentials = async (smtp: SMTPInformation, log: FastifyBaseLogger): Promise<void> => {
    const transporter = createSmtpTransporter(smtp)
    
    try {
        await transporter.verify()
        log.info('SMTP credentials validated successfully')
    } catch (e) {
        log.error({ error: e }, 'SMTP validation failed')
        throw new ActivepiecesError({
            code: ErrorCode.INVALID_SMTP_CREDENTIALS,
            params: {
                message: e instanceof Error ? e.message : JSON.stringify(e),
            },
        })
    }
}

function createSmtpTransporter(smtp: SMTPInformation): Transporter {
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

