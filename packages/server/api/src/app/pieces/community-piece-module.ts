import { PieceMetadataModel } from '@activepieces/pieces-framework'
import { AddPieceRequestBody, PrincipalType } from '@activepieces/shared'
import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { StatusCodes } from 'http-status-codes'
import { assertProjectId } from '../authentication/authentication-utils'
import { pieceService } from './piece-service'

export const communityPiecesModule: FastifyPluginAsyncTypebox = async (app) => {
    await app.register(communityPiecesController, { prefix: '/v1/pieces' })
}

const communityPiecesController: FastifyPluginAsyncTypebox = async (app) => {
    app.post(
        '/',
        {
            config: {
                allowedPrincipals: [PrincipalType.USER],
            },
            schema: {
                body: AddPieceRequestBody,
            },
        },
        async (req, res): Promise<PieceMetadataModel> => {
            assertProjectId(req.principal)
            const pieceMetadata = await pieceService(req.log).installPiece(
                req.principal.platform.id,
                req.principal.projectId,
                req.body,
            )
            return res.code(StatusCodes.CREATED).send(pieceMetadata)
        },
    )
}
