import { ApplicationEventName } from '@activepieces/ee-shared'
import {
    FlowRun,
    FlowRunFinishedNotification,
    isFlowRunStateTerminal,
    RunEnvironment,
    WebsocketClientEvent,
} from '@activepieces/shared'
import { FastifyBaseLogger } from 'fastify'
import { eventsHooks } from '../../helper/application-events'
import { app } from '../../server'
import { flowVersionService } from '../flow-version/flow-version.service'
import { flowRunHooks } from './flow-run-hooks'

export const flowRunSideEffects = (log: FastifyBaseLogger) => ({
    async onFinish(flowRun: FlowRun): Promise<void> {
        if (!isFlowRunStateTerminal({
            status: flowRun.status,
            ignoreInternalError: true,
        })) {
            return
        }
        await flowRunHooks(log).onFinish(flowRun)
        eventsHooks.get(log).sendWorkerEvent(flowRun.projectId, {
            action: ApplicationEventName.FLOW_RUN_FINISHED,
            data: {
                flowRun,
            },
        })
        
        // Emit in-app notification for production runs
        if (flowRun.environment === RunEnvironment.PRODUCTION && app?.io) {
            // Look up the flow version to get the display name
            let flowDisplayName = flowRun.flowId
            try {
                const flowVersion = await flowVersionService(log).getOneOrThrow(flowRun.flowVersionId)
                flowDisplayName = flowVersion.displayName
            }
            catch (e) {
                log.warn({ flowVersionId: flowRun.flowVersionId, error: e }, 'Failed to get flow version for notification')
            }
            
            const notification: FlowRunFinishedNotification = {
                flowRunId: flowRun.id,
                flowId: flowRun.flowId,
                flowDisplayName,
                status: flowRun.status,
                failedStepName: flowRun.failedStep?.displayName,
                errorMessage: flowRun.failedStep?.name ? `Step "${flowRun.failedStep.displayName}" failed` : undefined,
                finishTime: flowRun.finishTime ?? new Date().toISOString(),
            }
            app.io.to(flowRun.projectId).emit(WebsocketClientEvent.FLOW_RUN_FINISHED_NOTIFICATION, notification)
            log.debug({ flowRunId: flowRun.id, status: flowRun.status, flowDisplayName }, 'Emitted flow run finished notification')
        }
    },
    async onResume(flowRun: FlowRun): Promise<void> {
        eventsHooks.get(log).sendWorkerEvent(flowRun.projectId, {
            action: ApplicationEventName.FLOW_RUN_RESUMED,
            data: {
                flowRun,
            },
        })
    },
    async onStart(flowRun: FlowRun): Promise<void> {
       
        eventsHooks.get(log).sendWorkerEvent(flowRun.projectId, {
            action: ApplicationEventName.FLOW_RUN_STARTED,
            data: {
                flowRun,
            },
        })
    },
})

