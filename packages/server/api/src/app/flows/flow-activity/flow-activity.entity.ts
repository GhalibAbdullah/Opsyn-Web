import { Flow, Project, User } from '@activepieces/shared'
import { EntitySchema } from 'typeorm'
import {
    ApIdSchema,
    BaseColumnSchemaPart,
    JSONB_COLUMN_TYPE,
} from '../../database/database-common'

export enum FlowActivityAction {
    CREATED = 'CREATED',
    UPDATED = 'UPDATED',
    DELETED = 'DELETED',
    PUBLISHED = 'PUBLISHED',
    UNPUBLISHED = 'UNPUBLISHED',
    STATUS_CHANGED = 'STATUS_CHANGED',
    NAME_CHANGED = 'NAME_CHANGED',
    STEP_ADDED = 'STEP_ADDED',
    STEP_REMOVED = 'STEP_REMOVED',
    STEP_UPDATED = 'STEP_UPDATED',
}

export type FlowActivitySchema = {
    user: User
    project: Project
    flow: Flow
} & {
    id: string
    created: string
    updated: string
    projectId: string
    flowId: string
    userId: string | null
    actionType: FlowActivityAction
    metadata: Record<string, unknown> | null
}

export const FlowActivityEntity = new EntitySchema<FlowActivitySchema>({
    name: 'flow_activity',
    columns: {
        ...BaseColumnSchemaPart,
        projectId: ApIdSchema,
        flowId: ApIdSchema,
        userId: {
            ...ApIdSchema,
            nullable: true,
        },
        actionType: {
            type: String,
            length: 50,
            name: 'actionType',
        },
        metadata: {
            type: JSONB_COLUMN_TYPE,
            nullable: true,
        },
    },
    indices: [
        {
            name: 'idx_flow_activity_flow_id',
            columns: ['flowId'],
        },
        {
            name: 'idx_flow_activity_project_id',
            columns: ['projectId'],
        },
        {
            name: 'idx_flow_activity_created',
            columns: ['created'],
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
                foreignKeyConstraintName: 'fk_flow_activity_project_id',
            },
        },
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
            nullable: true,
            joinColumn: {
                name: 'userId',
                foreignKeyConstraintName: 'fk_flow_activity_user_id',
            },
        },
    },
})

