import {
    ApId,
    CreateFlowCommentRequestBody,
    ListFlowCommentsQueryParams,
    PrincipalType,
    UpdateFlowCommentRequestBody,
} from '@activepieces/shared';
import {
    FastifyPluginAsyncTypebox,
    Type,
} from '@fastify/type-provider-typebox';
import { assertCanEditFlow } from '../../authentication/permission-helpers';
import { authenticationUtils } from '../../authentication/authentication-utils';
import { flowCommentService } from './flow-comment.service';

const DEFAULT_LIMIT = 50;
const DEFAULT_CURSOR = null;

export const flowCommentController: FastifyPluginAsyncTypebox = async (app) => {
    app.get('/', ListFlowCommentsRequest, async (request) => {
        return flowCommentService(request.log).list({
            flowId: request.params.flowId,
            projectId: request.principal.projectId!,
            limit: request.query.limit ?? DEFAULT_LIMIT,
            cursor: request.query.cursor ?? DEFAULT_CURSOR,
            stepName: request.query.stepName ?? null,
            parentCommentId: request.query.parentCommentId ?? null,
        });
    });

    app.post('/', CreateFlowCommentRequest, async (request) => {
        const userId = await authenticationUtils.extractUserIdFromPrincipal(request.principal);
        if (userId) {
            await assertCanEditFlow(request.principal.projectId!, userId, request.log);
        }

        const { content, stepName, parentCommentId } = request.body;
        return flowCommentService(request.log).create({
            content,
            projectId: request.principal.projectId!,
            userId: request.principal.id,
            flowId: request.params.flowId,
            stepName: stepName ?? null,
            parentCommentId: parentCommentId ?? null,
            socket: app.io,
        });
    });

    app.patch('/:commentId', UpdateFlowCommentRequest, async (request) => {
        const userId = await authenticationUtils.extractUserIdFromPrincipal(request.principal);
        if (userId) {
            await assertCanEditFlow(request.principal.projectId!, userId, request.log);
        }

        const { content } = request.body;
        return flowCommentService(request.log).update({
            id: request.params.commentId,
            content,
            socket: app.io,
            projectId: request.principal.projectId!,
        });
    });

    app.delete('/:commentId', DeleteFlowCommentRequest, async (request) => {
        const userId = await authenticationUtils.extractUserIdFromPrincipal(request.principal);
        if (userId) {
            await assertCanEditFlow(request.principal.projectId!, userId, request.log);
        }

        await flowCommentService(request.log).delete({
            id: request.params.commentId,
            socket: app.io,
            projectId: request.principal.projectId!,
        });
        return { success: true };
    });
};

const ListFlowCommentsRequest = {
    schema: {
        params: Type.Object({
            flowId: ApId,
        }),
        querystring: Type.Omit(ListFlowCommentsQueryParams, ['flowId']),
    },
    config: {
        allowedPrincipals: [PrincipalType.USER] as const,
    },
};

const CreateFlowCommentRequest = {
    schema: {
        params: Type.Object({
            flowId: ApId,
        }),
        body: CreateFlowCommentRequestBody,
    },
    config: {
        allowedPrincipals: [PrincipalType.USER] as const,
    },
};

const UpdateFlowCommentRequest = {
    schema: {
        params: Type.Object({
            flowId: ApId,
            commentId: ApId,
        }),
        body: UpdateFlowCommentRequestBody,
    },
    config: {
        allowedPrincipals: [PrincipalType.USER] as const,
    },
};

const DeleteFlowCommentRequest = {
    schema: {
        params: Type.Object({
            flowId: ApId,
            commentId: ApId,
        }),
    },
    config: {
        allowedPrincipals: [PrincipalType.USER] as const,
    },
};

