import { Platform } from '@activepieces/shared'
import nodemailer, { Transporter } from 'nodemailer'
import { defaultTheme } from '../flags/theme'

export type SmtpConfig = {
    host: string
    port: number
    user: string
    password: string
    from: string
}

export function getSmtpConfig(platform: Platform | null): SmtpConfig | null {
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

export function createSmtpTransporter(smtp: SmtpConfig): Transporter {
    return nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.port === 465,
        auth: {
            user: smtp.user,
            pass: smtp.password,
        },
    })
}

export function brandedEmailTemplate({ heading, bodyHtml }: { heading: string, bodyHtml: string }): string {
    const primaryColor = defaultTheme.colors.primary.default
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 0">
<tr><td align="center">
  <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
    <tr><td style="background:linear-gradient(135deg,${primaryColor},#1D4ED8);padding:28px 32px;text-align:center">
      <div style="display:inline-block;width:40px;height:40px;background:rgba(255,255,255,0.15);border-radius:10px;vertical-align:middle;margin-right:10px;position:relative">
        <div style="position:absolute;width:10px;height:10px;background:#ffffff;border-radius:50%;top:10px;left:10px;opacity:0.95"></div>
        <div style="position:absolute;width:10px;height:10px;background:#ffffff;border-radius:50%;bottom:10px;right:10px;opacity:0.9"></div>
        <div style="position:absolute;width:16px;height:2px;background:rgba(255,255,255,0.8);top:50%;left:50%;transform:translate(-50%,-50%) rotate(45deg);border-radius:1px"></div>
      </div>
      <span style="color:#ffffff;font-size:22px;font-weight:700;vertical-align:middle;letter-spacing:-.3px">OpSyn</span>
    </td></tr>
    <tr><td style="padding:32px 32px 8px">
      <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#1e293b">${heading}</h2>
    </td></tr>
    <tr><td style="padding:0 32px 32px;font-size:15px;line-height:1.6;color:#475569">
      ${bodyHtml}
    </td></tr>
    <tr><td style="padding:0 32px 32px;text-align:center;font-size:13px;color:#94a3b8;border-top:1px solid #f1f5f9;padding-top:20px">
      <p style="margin:0">&copy; ${new Date().getFullYear()} OpSyn Team. All rights reserved.</p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`
}
