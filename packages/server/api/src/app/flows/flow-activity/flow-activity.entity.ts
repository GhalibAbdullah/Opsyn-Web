import { Flow, FlowActivity, User } from '@activepieces/shared'
import { EntitySchema } from 'typeorm'
import {
    ApIdSchema,
    BaseColumnSchemaPart,
    JSONB_COLUMN_TYPE,
} from '../../database/database-common'

export type FlowActivitySchema = FlowActivity & {
    flow: Flow
    user: User
}

export const FlowActivityEntity = new EntitySchema<FlowActivitySchema>({
    name: 'flow_activity',
    columns: {
        ...BaseColumnSchemaPart,
        flowId: {
            ...ApIdSchema,
            nullable: false,
        },
        projectId: {
            ...ApIdSchema,
            nullable: false,
        },
        userId: {
            ...ApIdSchema,
            nullable: true,
        },
        action: {
            type: String,
            nullable: false,
        },
        operationType: {
            type: String,
            nullable: true,
        },
        message: {
            type: String,
            nullable: false,
        },
        details: {
            type: JSONB_COLUMN_TYPE,
            nullable: true,
        },
    },
    indices: [
        {
            name: 'idx_flow_activity_flow_id_created_desc',
            columns: ['flowId', 'created'],
            unique: false,
        },
        {
            name: 'idx_flow_activity_project_id',
            columns: ['projectId'],
            unique: false,
        },
        {
            name: 'idx_flow_activity_user_id',
            columns: ['userId'],
            unique: false,
        },
    ],
    relations: {
        flow: {
            type: 'many-to-one',
            target: 'flow',
            cascade: true,
            onDelete: 'CASCADE',
            joinColumn: {
                name: 'flowId',
                foreignKeyConstraintName: 'fk_flow_activity_flow_id',
            },
        },
        user: {
            type: 'many-to-one',
            target: 'user',
            cascade: true,
            onDelete: 'SET NULL',
            joinColumn: {
                name: 'userId',
                foreignKeyConstraintName: 'fk_flow_activity_user_id',
            },
        },
    },
})

