import { AIProvider } from '@activepieces/common-ai'
import { Platform, Project } from '@activepieces/shared'
import { Static, Type } from '@sinclair/typebox'
import { EntitySchema } from 'typeorm'
import { ApIdSchema, BaseColumnSchemaPart, JSON_COLUMN_TYPE } from '../database/database-common'
import { EncryptedObject } from '../helper/encryption'

const AIProviderEncrypted = Type.Composite([Type.Omit(AIProvider, ['config']), Type.Object({
    config: EncryptedObject,
})])

type AIProviderEncrypted = Static<typeof AIProviderEncrypted>

export type AIProviderSchema = AIProviderEncrypted & {
    platform: Platform
    project?: Project
    projectId?: string | null
}

export const AIProviderEntity = new EntitySchema<AIProviderSchema>({
    name: 'ai_provider',
    columns: {
        ...BaseColumnSchemaPart,
        config: {
            type: JSON_COLUMN_TYPE,
            nullable: false,
        },
        provider: {
            type: String,
            nullable: false,
        },
        platformId: {
            ...ApIdSchema,
            nullable: false,
        },
        projectId: {
            ...ApIdSchema,
            nullable: true, // Nullable for backward compatibility with existing records
        } as any,
    },
    indices: [
        {
            name: 'idx_ai_provider_platform_project_provider',
            columns: ['platformId', 'projectId', 'provider'],
            unique: true,
            where: 'projectId IS NOT NULL',
        },
        {
            name: 'idx_ai_provider_platform_provider_null',
            columns: ['platformId', 'provider'],
            unique: true,
            where: 'projectId IS NULL',
        },
    ],
    relations: {
        platform: {
            type: 'many-to-one',
            target: 'platform',
            cascade: true,
            onDelete: 'CASCADE',
            joinColumn: {
                name: 'platformId',
                foreignKeyConstraintName: 'fk_ai_provider_platform_id',
            },
        },
        project: {
            type: 'many-to-one',
            target: 'project',
            cascade: true,
            onDelete: 'CASCADE',
            nullable: true,
            joinColumn: {
                name: 'projectId',
                foreignKeyConstraintName: 'fk_ai_provider_project_id',
            },
        },
    },
})
