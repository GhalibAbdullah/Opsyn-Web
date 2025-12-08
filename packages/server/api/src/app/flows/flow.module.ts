import { EmitTestStepProgressRequest, FlowEditorJoined, FlowEditorLeft, PrincipalType, TestFlowRunRequestBody, UserPrincipal, WebsocketClientEvent, WebsocketServerEvent, WorkerPrincipal } from '@activepieces/shared'
import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { assertProjectId } from '../authentication/authentication-utils'
import { websocketService } from '../core/websockets.service'
import { flowWorkerController } from '../workers/worker-controller'
import { flowVersionController } from './flow/flow-version.controller'
import { flowController } from './flow/flow.controller'
import { flowWebsocketHandlers } from './flow/flow-websocket-handlers'
import { flowRunService } from './flow-run/flow-run-service'
import { sampleDataController } from './step-run/sample-data.controller'
import { flowCommentController } from './flow-comment/flow-comment.controller'
import { flowActivityController } from './flow-activity/flow-activity.controller'

export const flowModule: FastifyPluginAsyncTypebox = async (app) => {
    await app.register(flowWorkerController, { prefix: '/v1/worker/flows' })
    await app.register(flowVersionController, { prefix: '/v1/flows' })
    await app.register(flowController, { prefix: '/v1/flows' })
    await app.register(sampleDataController, { prefix: '/v1/sample-data' })
    await app.register(flowCommentController, { prefix: '/v1/flows/:flowId/comments' })
    await app.register(flowActivityController, { prefix: '/v1/flows/:flowId/activity' })
    websocketService.addListener(PrincipalType.USER, WebsocketServerEvent.TEST_FLOW_RUN, (socket) => {
        return async (data: TestFlowRunRequestBody, principal: UserPrincipal) => {
            assertProjectId(principal)
            const flowRun = await flowRunService(app.log).test({
                projectId: principal.projectId,
                flowVersionId: data.flowVersionId,
            })
            socket.emit(WebsocketClientEvent.TEST_FLOW_RUN_STARTED, flowRun)
        }
    })
    websocketService.addListener(PrincipalType.WORKER, WebsocketServerEvent.EMIT_TEST_STEP_PROGRESS, (socket) => {
        return async (data: EmitTestStepProgressRequest, _principal: WorkerPrincipal, callback?: (data?: unknown) => void): Promise<void> => {
            socket.to(data.projectId).emit(WebsocketClientEvent.TEST_STEP_PROGRESS, data)
            callback?.()
        }
    })
    websocketService.addListener(PrincipalType.WORKER, WebsocketServerEvent.EMIT_TEST_STEP_FINISHED, (socket) => {
        return async (data: EmitTestStepProgressRequest, _principal: WorkerPrincipal, callback?: (data?: unknown) => void): Promise<void> => {
            socket.to(data.projectId).emit(WebsocketClientEvent.TEST_STEP_FINISHED, data)
            callback?.()
        }
    })

    // Register flow collaboration handlers
    const flowHandlers = flowWebsocketHandlers(app.log)
    websocketService.addListener(PrincipalType.USER, WebsocketServerEvent.FLOW_EDITOR_JOINED, (socket) => {
        return flowHandlers.handleEditorJoined(socket)
    })
    websocketService.addListener(PrincipalType.USER, WebsocketServerEvent.FLOW_EDITOR_LEFT, (socket) => {
        return flowHandlers.handleEditorLeft(socket)
    })
    websocketService.addListener(PrincipalType.USER, WebsocketServerEvent.DISCONNECT, (socket) => {
        return flowHandlers.handleDisconnect(socket)
    })

}
