import { randomUUID } from 'node:crypto'

export const passwordResetOtpGenerator = {
    generate(): string {
        // Generate a random UUID as the OTP token
        return randomUUID()
    },
}

