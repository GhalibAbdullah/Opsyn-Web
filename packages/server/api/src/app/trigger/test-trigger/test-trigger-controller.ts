import { CancelTestTriggerRequestBody, PrincipalType, TestTriggerRequestBody } from '@activepieces/shared'
import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { assertProjectId } from '../../authentication/authentication-utils'
import { testTriggerService } from '../../trigger/test-trigger/test-trigger-service'

export const testTriggerController: FastifyPluginAsyncTypebox = async (app) => {
    app.post('/', TestTriggerRequest, async (req) => {
        assertProjectId(req.principal)
        const { projectId } = req.principal
        const { flowId, flowVersionId, testStrategy } = req.body

        return testTriggerService(req.log).test({
            flowId,
            flowVersionId,
            projectId: projectId!,
            testStrategy,
        })
    })
    app.delete('/', CancelTestTriggerRequest, async (req) => {
        assertProjectId(req.principal)
        const { projectId } = req.principal
        const { flowId } = req.body

        return testTriggerService(req.log).cancel({
            flowId,
            projectId: projectId!,
        })
    })
}

const TestTriggerRequest = {
    schema: {
        body: TestTriggerRequestBody,
    },
    config: {
        allowedPrincipals: [PrincipalType.USER] as const,
    },
}

const CancelTestTriggerRequest = {
    schema: {
        body: CancelTestTriggerRequestBody,
    },
    config: {
        allowedPrincipals: [PrincipalType.USER] as const,
    },
}