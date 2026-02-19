export enum OtpType {
    EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
    PASSWORD_RESET = 'PASSWORD_RESET',
}

export type CreateOtpRequestBody = {
    email: string
    type: OtpType
}

export type ResetPasswordRequestBody = {
    identityId: string
    otp: string
    newPassword: string
}

export type VerifyEmailRequestBody = {
    identityId: string
    otp: string
}
