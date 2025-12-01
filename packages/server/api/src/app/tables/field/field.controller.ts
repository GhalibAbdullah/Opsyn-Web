import { CreateFieldRequest, Field, PrincipalType, UpdateFieldRequest } from '@activepieces/shared'
import { FastifyPluginAsyncTypebox, Type } from '@fastify/type-provider-typebox'
import { StatusCodes } from 'http-status-codes'
import { assertProjectId } from '../../authentication/authentication-utils'
import { fieldService } from './field.service'

export const fieldController: FastifyPluginAsyncTypebox = async (fastify) => {

    fastify.post('/', CreateRequest, async (request, reply) => {
        assertProjectId(request.principal)
        const response = await fieldService.create({ request: request.body, projectId: request.principal.projectId })
        await reply.status(StatusCodes.CREATED).send(response)
    },
    )

    fastify.get('/', GetFieldsRequest, async (request) => {
        assertProjectId(request.principal)
        return fieldService.getAll({
            projectId: request.principal.projectId,
            tableId: request.query.tableId,
        })
    },
    )

    fastify.get('/:id', GetFieldByIdRequest, (request) => {
        assertProjectId(request.principal)
        return fieldService.getById({
            id: request.params.id,
            projectId: request.principal.projectId,
        })
    },
    )

    fastify.delete('/:id', DeleteFieldRequest, async (request) => {
        assertProjectId(request.principal)
        return fieldService.delete({
            id: request.params.id,
            projectId: request.principal.projectId,
        })
    },
    )

    fastify.post('/:id', UpdateRequest, async (request) => {
        assertProjectId(request.principal)
        return fieldService.update({
            id: request.params.id,
            projectId: request.principal.projectId,
            request: request.body,
        })
    },
    )
}
const CreateRequest = {
    config: {
        allowedPrincipals: [PrincipalType.ENGINE, PrincipalType.USER] as const,
    },
    schema: {
        body: CreateFieldRequest,
    },
    response: {
        [StatusCodes.CREATED]: Field,
    },
}

const GetFieldByIdRequest = {
    config: {
        allowedPrincipals: [PrincipalType.ENGINE, PrincipalType.USER] as const,
    },
    schema: {
        params: Type.Object({
            id: Type.String(),
        }),
    },
}

const DeleteFieldRequest = {
    config: {
        allowedPrincipals: [PrincipalType.ENGINE, PrincipalType.USER] as const,
    },
    schema: {
        params: Type.Object({
            id: Type.String(),
        }),
    },
}

const GetFieldsRequest = {
    config: {
        allowedPrincipals: [PrincipalType.ENGINE, PrincipalType.USER] as const,
    },
    schema: {
        querystring: Type.Object({
            tableId: Type.String(),
        }),
    },
}

const UpdateRequest = {
    config: {
        allowedPrincipals: [PrincipalType.ENGINE, PrincipalType.USER] as const,
    },
    schema: {
        params: Type.Object({
            id: Type.String(),
        }),
        body: UpdateFieldRequest,
    },
}
