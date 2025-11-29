import { Project, User } from '@activepieces/shared'
import { EntitySchema } from 'typeorm'
import {
    ApIdSchema,
    BaseColumnSchemaPart,
} from '../database/database-common'

export type ProjectMemberRole = 'OWNER' | 'EDITOR' | 'VIEWER'

export type ProjectMemberSchema = {
    user: User
    project: Project
} & {
    id: string
    created: string
    updated: string
    projectId: string
    platformId: string
    userId: string
    role: ProjectMemberRole
}

export const ProjectMemberEntity = new EntitySchema<ProjectMemberSchema>({
    name: 'project_member',
    columns: {
        ...BaseColumnSchemaPart,
        projectId: ApIdSchema,
        platformId: ApIdSchema,
        userId: ApIdSchema,
        role: {
            type: String,
            length: 20,
        },
    },
    indices: [
        {
            name: 'idx_project_member_project_id_user_id_platform_id',
            columns: ['projectId', 'userId', 'platformId'],
            unique: true,
        },
        {
            name: 'idx_project_member_project_id',
            columns: ['projectId'],
        },
        {
            name: 'idx_project_member_user_id',
            columns: ['userId'],
        },
    ],
    relations: {
        project: {
            type: 'many-to-one',
            target: 'project',
            cascade: true,
            onDelete: 'CASCADE',
            joinColumn: {
                name: 'projectId',
                foreignKeyConstraintName: 'fk_project_member_project_id',
            },
        },
        user: {
            type: 'many-to-one',
            target: 'user',
            cascade: true,
            onDelete: 'CASCADE',
            joinColumn: {
                name: 'userId',
                foreignKeyConstraintName: 'fk_project_member_user_id',
            },
        },
    },
})

