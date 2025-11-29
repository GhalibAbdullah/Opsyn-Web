import { UserIdentity } from '@activepieces/shared'
import { EntitySchema } from 'typeorm'
import {
    ApIdSchema,
    BaseColumnSchemaPart,
} from '../../database/database-common'

export enum PasswordResetOtpState {
    PENDING = 'PENDING',
    CONFIRMED = 'CONFIRMED',
    EXPIRED = 'EXPIRED',
}

export type PasswordResetOtpSchema = {
    id: string
    created: string
    updated: string
    identityId: string
    value: string
    state: PasswordResetOtpState
    userIdentity: UserIdentity
}

export const PasswordResetOtpEntity = new EntitySchema<PasswordResetOtpSchema>({
    name: 'password_reset_otp',
    columns: {
        ...BaseColumnSchemaPart,
        identityId: {
            ...ApIdSchema,
            nullable: false,
        },
        value: {
            type: String,
            nullable: false,
        },
        state: {
            type: String,
            enum: PasswordResetOtpState,
            nullable: false,
        },
    },
    indices: [
        {
            name: 'idx_password_reset_otp_identity_id',
            columns: ['identityId'],
            unique: true,
        },
    ],
    relations: {
        userIdentity: {
            type: 'many-to-one',
            target: 'user_identity',
            cascade: true,
            onDelete: 'CASCADE',
            joinColumn: {
                name: 'identityId',
                foreignKeyConstraintName: 'fk_password_reset_otp_identity_id',
            },
        },
    },
})

