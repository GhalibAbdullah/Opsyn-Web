import { Flow, FlowComment, User } from '@activepieces/shared';
import { EntitySchema } from 'typeorm';
import {
    ApIdSchema,
    BaseColumnSchemaPart,
} from '../../database/database-common';

export type FlowCommentSchema = FlowComment & {
    flow: Flow;
    user: User;
    parentComment?: FlowComment;
};

export const FlowCommentEntity = new EntitySchema<FlowCommentSchema>({
    name: 'flow_comment',
    columns: {
        ...BaseColumnSchemaPart,
        flowId: {
            ...ApIdSchema,
            nullable: false,
        },
        userId: {
            ...ApIdSchema,
            nullable: true,
        },
        content: {
            type: String,
            nullable: false,
        },
        stepName: {
            type: String,
            nullable: true,
        },
        parentCommentId: {
            ...ApIdSchema,
            nullable: true,
        },
    },
    indices: [
        {
            name: 'idx_flow_comment_flow_id',
            columns: ['flowId'],
            unique: false,
        },
        {
            name: 'idx_flow_comment_step_name',
            columns: ['stepName'],
            unique: false,
        },
        {
            name: 'idx_flow_comment_user_id',
            columns: ['userId'],
            unique: false,
        },
        {
            name: 'idx_flow_comment_parent_id',
            columns: ['parentCommentId'],
            unique: false,
        },
        {
            name: 'idx_flow_comment_flow_id_created',
            columns: ['flowId', 'created'],
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
                foreignKeyConstraintName: 'fk_flow_comment_flow_id',
            },
        },
        user: {
            type: 'many-to-one',
            target: 'user',
            cascade: true,
            onDelete: 'SET NULL',
            joinColumn: {
                name: 'userId',
                foreignKeyConstraintName: 'fk_flow_comment_user_id',
            },
        },
        parentComment: {
            type: 'many-to-one',
            target: 'flow_comment',
            cascade: true,
            onDelete: 'CASCADE',
            nullable: true,
            joinColumn: {
                name: 'parentCommentId',
                foreignKeyConstraintName: 'fk_flow_comment_parent_id',
            },
        },
    },
});

