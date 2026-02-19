import { Type } from '@sinclair/typebox'
import { FastifyRequest } from 'fastify'
import { hooksFactory } from '../hooks-factory'

export type AuditEventParam = {
    action: string
    data: Record<string, unknown>
}


export const eventsHooks = hooksFactory.create<ApplicationEventHooks>(() => {
    return {
        async sendUserEvent(_requestInformation, _params) {
            return
        },
        async sendUserEventFromRequest(_request, _params) {
            return
        },
        async sendWorkerEvent(_params) {
            return
        },
    }
})

export type ApplicationEventHooks = {
    sendUserEvent(requestInformation: MetaInformation, params: AuditEventParam): void
    sendUserEventFromRequest(request: FastifyRequest, params: AuditEventParam): void
    sendWorkerEvent(projectId: string, params: AuditEventParam): void
}

type MetaInformation = {
    platformId: string
    userId: string
    projectId?: string
    ip: string
}
