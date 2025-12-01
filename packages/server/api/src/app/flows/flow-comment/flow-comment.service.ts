import {
    ActivepiecesError,
    ApId,
    apId,
    Cursor,
    ErrorCode,
    FlowComment,
    FlowCommentWithUser,
    FlowId,
    isNil,
    ProjectId,
    SeekPage,
    spreadIfDefined,
    UserId,
} from '@activepieces/shared';
import { FastifyBaseLogger } from 'fastify';
import { Server } from 'socket.io';
import { repoFactory } from '../../core/db/repo-factory';
import { buildPaginator } from '../../helper/pagination/build-paginator';
import { paginationHelper } from '../../helper/pagination/pagination-utils';
import { Order } from '../../helper/pagination/paginator';
import { userService } from '../../user/user-service';
import { projectMemberService } from '../../project-members/project-member.service';
import { projectService } from '../../project/project-service';
import { flowCommentSideEffects } from './flow-comment-side-effects';
import { FlowCommentEntity } from './flow-comment.entity';

const repo = repoFactory(FlowCommentEntity);

export const flowCommentService = (log: FastifyBaseLogger) => ({
    async create(params: CreateParams): Promise<FlowComment> {
        const comment = repo().create({
            id: apId(),
            ...spreadIfDefined('userId', params.userId),
            flowId: params.flowId,
            content: params.content,
            stepName: params.stepName ?? null,
            parentCommentId: params.parentCommentId ?? null,
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
        });
        const savedComment = await repo().save(comment);
        
        // Parse mentions and notify mentioned users
        const mentionedUserIds = await parseMentions(params.content, params.projectId, log);
        
        await flowCommentSideEffects(log).notifyCommentCreated({
            socket: params.socket,
            flowId: params.flowId,
            projectId: params.projectId,
            commentId: savedComment.id,
            mentionedUserIds,
        });
        return savedComment;
    },

    async update(params: UpdateParams): Promise<FlowComment> {
        const comment = await repo().findOneByOrFail({ id: params.id });
        await repo().update(comment.id, {
            ...spreadIfDefined('content', params.content),
            updated: new Date().toISOString(),
        });
        await flowCommentSideEffects(log).notifyCommentChanged({
            socket: params.socket,
            projectId: params.projectId,
            commentId: params.id,
            flowId: comment.flowId,
            content: params.content,
        });
        return this.getOneOrThrow({ id: params.id });
    },

    async delete(params: DeleteParams): Promise<void> {
        const comment = await repo().findOneByOrFail({ id: params.id });
        await repo().delete(comment.id);
        await flowCommentSideEffects(log).notifyCommentDeleted({
            socket: params.socket,
            projectId: params.projectId,
            commentId: params.id,
            flowId: comment.flowId,
        });
    },

    async getOne(params: GetParams): Promise<FlowComment | null> {
        return repo().findOneBy({ id: params.id });
    },

    async getOneOrThrow(params: GetParams): Promise<FlowComment> {
        const comment = await this.getOne(params);
        if (!comment) {
            throw new ActivepiecesError({
                code: ErrorCode.ENTITY_NOT_FOUND,
                params: { entityType: 'flow_comment', entityId: params.id, message: 'Flow comment by id not found' },
            });
        }
        return comment;
    },

    async list(params: ListParams): Promise<SeekPage<FlowCommentWithUser>> {
        const decodedCursor = paginationHelper.decodeCursor(params.cursor);
        const paginator = buildPaginator<FlowComment>({
            entity: FlowCommentEntity,
            query: {
                limit: params.limit,
                order: Order.ASC,
                orderBy: 'created',
                afterCursor: decodedCursor.nextCursor,
                beforeCursor: decodedCursor.previousCursor,
            },
        });

        let query = repo().createQueryBuilder('flow_comment').where({
            flowId: params.flowId,
        });

        if (!isNil(params.stepName)) {
            query = query.andWhere('flow_comment.stepName = :stepName', { stepName: params.stepName });
        } else {
            // If stepName is not provided, get workflow-level comments (where stepName is null)
            query = query.andWhere('flow_comment.stepName IS NULL');
        }

        // Filter by parent comment if specified (for replies)
        if (!isNil(params.parentCommentId)) {
            query = query.andWhere('flow_comment.parentCommentId = :parentCommentId', { parentCommentId: params.parentCommentId });
        } else {
            // If parentCommentId is not provided, get top-level comments (where parentCommentId is null)
            query = query.andWhere('flow_comment.parentCommentId IS NULL');
        }

        const { data, cursor: newCursor } = await paginator.paginate(query);
        const enrichedData = await Promise.all(
            data.map(async (comment) => {
                return enrichFlowCommentWithUser(comment);
            }),
        );
        return paginationHelper.createPage<FlowCommentWithUser>(enrichedData, newCursor);
    },
});

async function enrichFlowCommentWithUser(
    comment: FlowComment,
): Promise<FlowCommentWithUser> {
    const user = isNil(comment.userId) ? null : await userService.getMetaInformation({
        id: comment.userId,
    });
    return {
        ...comment,
        user,
    };
}

type GetParams = {
    id: string;
};

type ListParams = {
    flowId: FlowId;
    projectId: ProjectId;
    limit: number;
    cursor: Cursor | null;
    stepName?: string | null;
    parentCommentId?: string | null;
};

type CreateParams = {
    content: string;
    projectId: ProjectId;
    userId: UserId | null;
    flowId: FlowId;
    stepName?: string | null;
    parentCommentId?: string | null;
    socket: Server;
};

type UpdateParams = {
    id: string;
    content: string;
    socket: Server;
    projectId: ProjectId;
};

type DeleteParams = {
    id: string;
    socket: Server;
    projectId: ProjectId;
};

/**
 * Parse @mentions from comment content and return user IDs
 * Supports @email and @firstName lastName formats
 */
async function parseMentions(
    content: string,
    projectId: ProjectId,
    log: FastifyBaseLogger,
): Promise<string[]> {
    // Simple regex to match @mentions (email or name)
    const mentionRegex = /@([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|[a-zA-Z]+(?:\s+[a-zA-Z]+)?)/g;
    const matches = content.match(mentionRegex);
    
    if (!matches || matches.length === 0) {
        return [];
    }
    
    // Get project to find platformId
    const project = await projectService.getOneOrThrow(projectId);
    
    // Get all project members
    const membersPage = await projectMemberService(log).list({
        platformId: project.platformId,
        projectId,
        cursorRequest: null,
        limit: 1000, // Get all members for mention matching
    });
    
    const mentionedUserIds: string[] = [];
    
    for (const match of matches) {
        const mentionText = match.substring(1); // Remove @
        
        // Try to match by email first
        if (mentionText.includes('@')) {
            // It's an email
            const member = membersPage.data.find(
                (m) => m.user?.email?.toLowerCase() === mentionText.toLowerCase()
            );
            if (member?.user?.id) {
                mentionedUserIds.push(member.user.id);
            }
        } else {
            // It's a name - try to match by firstName lastName or firstName
            const nameParts = mentionText.trim().split(/\s+/);
            const member = membersPage.data.find((m) => {
                if (!m.user) return false;
                const firstName = m.user.firstName?.toLowerCase() || '';
                const lastName = m.user.lastName?.toLowerCase() || '';
                const fullName = `${firstName} ${lastName}`.trim();
                
                if (nameParts.length === 1) {
                    return firstName === nameParts[0].toLowerCase();
                } else if (nameParts.length === 2) {
                    return fullName === `${nameParts[0].toLowerCase()} ${nameParts[1].toLowerCase()}`;
                }
                return false;
            });
            if (member?.user?.id) {
                mentionedUserIds.push(member.user.id);
            }
        }
    }
    
    // Remove duplicates
    return [...new Set(mentionedUserIds)];
}

