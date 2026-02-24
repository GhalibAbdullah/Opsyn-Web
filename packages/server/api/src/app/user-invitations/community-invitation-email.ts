import { UserInvitation } from '@activepieces/shared'
import { FastifyBaseLogger } from 'fastify'
import { platformService } from '../platform/platform.service'
import { projectService } from '../project/project-service'
import { defaultTheme } from '../flags/theme'
import { brandedEmailTemplate, getSmtpConfig, createSmtpTransporter } from '../helper/community-email'

export const communityInvitationEmailService = (log: FastifyBaseLogger) => ({
    async sendInvitation({
        userInvitation,
        invitationLink,
    }: {
        userInvitation: UserInvitation
        invitationLink: string
    }): Promise<void> {
        const platform = await platformService.getOneOrThrow(userInvitation.platformId)
        const smtpConfig = getSmtpConfig(platform)

        if (!smtpConfig) {
            log.warn({
                email: userInvitation.email,
                invitationLink,
            }, `[NO SMTP] Invitation link for ${userInvitation.email} (copy this link): ${invitationLink}`)
            return
        }

        const projectName = userInvitation.projectId
            ? (await projectService.getOneOrThrow(userInvitation.projectId)).displayName
            : platform.name

        const roleName = userInvitation.projectRole
            ?? userInvitation.platformRole
            ?? 'Member'

        const transporter = createSmtpTransporter(smtpConfig)
        const primaryColor = defaultTheme.colors.primary.default

        log.info({ 
            host: smtpConfig.host, 
            port: smtpConfig.port, 
            from: smtpConfig.from,
            to: userInvitation.email 
        }, '[sendInvitation] Attempting to send email via SMTP')

        const emailBody = brandedEmailTemplate({
            heading: `Join ${projectName}`,
            bodyHtml: `
              <p style="margin:0 0 16px">You&rsquo;ve been invited to join <strong>${projectName}</strong> as <strong>${capitalize(roleName)}</strong>.</p>
              <p style="margin:0 0 16px">Click the button below to accept the invitation:</p>
              <p style="text-align:center;margin:24px 0">
                <a href="${invitationLink}" style="display:inline-block;padding:12px 32px;background-color:${primaryColor};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px">Accept Invitation</a>
              </p>
              <p style="margin:0 0 8px;font-size:13px;color:#94a3b8">This link expires in 24 hours.</p>
              <p style="margin:0;font-size:13px;color:#94a3b8">If you didn&rsquo;t expect this, you can safely ignore this email.</p>`,
        })

        try {
            const info = await transporter.sendMail({
                from: smtpConfig.from,
                to: userInvitation.email,
                subject: `You've been invited to ${projectName} — OpSyn`,
                html: emailBody,
            })
            log.info({ messageId: info.messageId, response: info.response }, 'Invitation email sent successfully')
        }
        catch (error) {
            log.error({ error, email: userInvitation.email }, 'Failed to send invitation email')
        }
    },

    isSmtpConfigured(platformId: string | null): boolean {
        return getSmtpConfig(null) !== null
    },
})

function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}
