import {
    ActivepiecesError,
    ApEdition,
    ApId,
    CountFlowsRequest,
    CreateFlowRequest,
    ErrorCode,
    FlowAction,
    FlowActionType,
    FlowOperationRequest,
    FlowOperationType,
    FlowStatus,
    flowStructureUtil,
    FlowTemplateWithoutProjectInformation,
    FlowTrigger,
    FlowTriggerType,
    FlowVersionState,
    GetFlowQueryParamsRequest,
    GetFlowTemplateRequestQuery,
    isNil,
    ListFlowsRequest,
    Permission,
    PieceActionSettings,
    PieceTriggerSettings,
    PopulatedFlow,
    PrincipalType,
    PropertyExecutionType,
    SeekPage,
    SERVICE_KEY_SECURITY_OPENAPI,
} from '@activepieces/shared'
import {
    FastifyPluginAsyncTypebox,
    Type,
} from '@fastify/type-provider-typebox'
import dayjs from 'dayjs'
import { StatusCodes } from 'http-status-codes'
import { assertProjectId, authenticationUtils } from '../../authentication/authentication-utils'
import { entitiesMustBeOwnedByCurrentProject } from '../../authentication/authorization'
import { assertCanEditFlow } from '../../authentication/permission-helpers'
import { system } from '../../helper/system/system'
import { ApplicationEventName } from '../../helper/application-events/application-event-names'
import { eventsHooks } from '../../helper/application-events'
import { flowMigrations } from '../flow-version/migrations'
import { flowService } from './flow.service'

const DEFAULT_PAGE_SIZE = 10

export const flowController: FastifyPluginAsyncTypebox = async (app) => {
    app.addHook('preSerialization', entitiesMustBeOwnedByCurrentProject)
    app.post('/', CreateFlowRequestOptions, async (request, reply) => {
        assertProjectId(request.principal)
        const userId = await authenticationUtils.extractUserIdFromPrincipal(request.principal)
        await assertCanEditFlow(request.principal.projectId!, userId, request.log)
        const newFlow = await flowService(request.log).create({
            projectId: request.principal.projectId,
            request: request.body,
            userId,
        })

        eventsHooks.get(request.log).sendUserEventFromRequest(request, {
            action: ApplicationEventName.FLOW_CREATED,
            data: {
                flow: newFlow,
            },
        })

        return reply.status(StatusCodes.CREATED).send(newFlow)
    })

    app.post('/:id', {
        config: {
            allowedPrincipals: [PrincipalType.USER, PrincipalType.SERVICE] as const,
            permission: Permission.UPDATE_FLOW_STATUS,
        },
        schema: {
            tags: ['flows'],
            description: 'Apply an operation to a flow',
            security: [SERVICE_KEY_SECURITY_OPENAPI],
            body: FlowOperationRequest,
            params: Type.Object({
                id: ApId,
            }),
        },
        preValidation: (request, _, done) => {
            if (request.body?.type === FlowOperationType.IMPORT_FLOW) {
                flowMigrations.apply({
                    agentIds: [],
                    connectionIds: [],
                    created: new Date().toISOString(),
                    displayName: '',
                    flowId: '',
                    id: '',
                    updated: new Date().toISOString(),
                    updatedBy: '',
                    valid: false,
                    trigger: request.body.request.trigger,
                    state: FlowVersionState.DRAFT,
                    schemaVersion: request.body.request.schemaVersion,
                }).then((migratedFlowVersion) => {
                    request.body.request = {
                        ...request.body.request,
                        trigger: migratedFlowVersion.trigger,
                        schemaVersion: migratedFlowVersion.schemaVersion,
                    }
                    done()
                }).catch((error) => {
                    request.log.error(error)
               
                })
            }
            else {
                done()
            }
        },
    }, async (request) => {
        const userId = await authenticationUtils.extractUserIdFromPrincipal(request.principal)
        assertProjectId(request.principal)
        await assertCanEditFlow(request.principal.projectId!, userId, request.log)
        const edition = system.getEdition()
        if ([ApEdition.CLOUD, ApEdition.ENTERPRISE].includes(edition)) {
            const { assertUserHasPermissionToFlow } = await import('../../ee/authentication/project-role/rbac-middleware')
            await assertUserHasPermissionToFlow(request.principal, request.body.type, request.log)
        }

        const flow = await flowService(request.log).getOnePopulatedOrThrow({
            id: request.params.id,
            projectId: request.principal.projectId,
        })

        const turnOnFlow = request.body.type === FlowOperationType.CHANGE_STATUS && request.body.request.status === FlowStatus.ENABLED
        const publishDisabledFlow = request.body.type === FlowOperationType.LOCK_AND_PUBLISH && flow.status === FlowStatus.DISABLED
        if (turnOnFlow || publishDisabledFlow) {
            if ([ApEdition.CLOUD, ApEdition.ENTERPRISE].includes(edition)) {
                const { platformPlanService } = await import('../../ee/platform/platform-plan/platform-plan.service')
                const { PlatformUsageMetric } = await import('@activepieces/shared')
                await platformPlanService(request.log).checkActiveFlowsExceededLimit(
                    request.principal.platform.id,
                    PlatformUsageMetric.ACTIVE_FLOWS,
                )
            }
        }
        // Only check if flow is being used for published flows (allow concurrent editing of drafts)
        if (flow.version.state !== FlowVersionState.DRAFT) {
            await assertThatFlowIsNotBeingUsed(flow, userId)
        }
        eventsHooks.get(request.log).sendUserEventFromRequest(request, {
            action: ApplicationEventName.FLOW_UPDATED,
            data: {
                request: request.body,
                flowVersion: flow.version,
            },
        })
        const updatedFlow = await flowService(request.log).update({
            id: request.params.id,
            userId: request.principal.type === PrincipalType.SERVICE ? null : userId,
            platformId: request.principal.platform.id,
            projectId: request.principal.projectId,
            operation: cleanOperation(request.body),
        })

        // Broadcast the change to all users editing this flow (only for draft flows to allow concurrent editing)
        if (updatedFlow.version.state === FlowVersionState.DRAFT && request.principal.type === PrincipalType.USER) {
            const { broadcastFlowOperation } = await import('./flow-websocket-handlers')
            await broadcastFlowOperation(
                request.params.id,
                request.body,
                updatedFlow.version.id,
                userId,
                request.log,
            ).catch((error) => {
                // Don't fail the request if broadcast fails
                request.log.warn({ error, flowId: request.params.id }, 'Failed to broadcast flow operation')
            })
        }

        return updatedFlow
    })

    app.get('/', ListFlowsRequestOptions, async (request) => {
        assertProjectId(request.principal)
        return flowService(request.log).list({
            projectId: request.principal.projectId,
            folderId: request.query.folderId,
            cursorRequest: request.query.cursor ?? null,
            limit: request.query.limit ?? DEFAULT_PAGE_SIZE,
            status: request.query.status,
            name: request.query.name,
            versionState: request.query.versionState,
            externalIds: request.query.externalIds,
            connectionExternalIds: request.query.connectionExternalIds,
            agentExternalIds: request.query.agentExternalIds,
        })
    })

    app.get('/count', CountFlowsRequestOptions, async (request) => {
        assertProjectId(request.principal)
        return flowService(request.log).count({
            folderId: request.query.folderId,
            projectId: request.principal.projectId,
        })
    })

    app.get('/:id/template', GetFlowTemplateRequestOptions, async (request) => {
        assertProjectId(request.principal)
        return flowService(request.log).getTemplate({
            flowId: request.params.id,
            projectId: request.principal.projectId,
            versionId: undefined,
        })
    })

    app.get('/:id', GetFlowRequestOptions, async (request) => {
        assertProjectId(request.principal)
        return flowService(request.log).getOnePopulatedOrThrow({
            id: request.params.id,
            projectId: request.principal.projectId,
            versionId: request.query.versionId,
        })
    })

    app.delete('/:id', DeleteFlowRequestOptions, async (request, reply) => {
        assertProjectId(request.principal)
        const userId = await authenticationUtils.extractUserIdFromPrincipal(request.principal)
        await assertCanEditFlow(request.principal.projectId!, userId, request.log)
        const flow = await flowService(request.log).getOnePopulatedOrThrow({
            id: request.params.id,
            projectId: request.principal.projectId,
        })
        eventsHooks.get(request.log).sendUserEventFromRequest(request, {
            action: ApplicationEventName.FLOW_DELETED,
            data: {
                flow,
                flowVersion: flow.version,
            },
        })
        const deleteEdition = system.getEdition()
        if ([ApEdition.CLOUD, ApEdition.ENTERPRISE].includes(deleteEdition)) {
            const { gitRepoService } = await import('../../ee/projects/project-release/git-sync/git-sync.service')
            const { GitPushOperationType } = await import('@activepieces/ee-shared')
            await gitRepoService(request.log).onDeleted({
                type: GitPushOperationType.DELETE_FLOW,
                externalId: flow.externalId,
                userId: request.principal.id,
                projectId: request.principal.projectId,
                platformId: request.principal.platform.id,
                log: request.log,
            })
        }
        await flowService(request.log).delete({
            id: request.params.id,
            projectId: request.principal.projectId,
            userId,
        })
        return reply.status(StatusCodes.NO_CONTENT).send()
    })
}

/**
 * Normalize propertySettings to ensure all entries have the required 'type' field
 */
function normalizePropertySettings(
    propertySettings: Record<string, unknown> | undefined | null,
): Record<string, { type: PropertyExecutionType; schema?: unknown }> {
    const normalized: Record<string, { type: PropertyExecutionType; schema?: unknown }> = {}
    
    if (propertySettings && typeof propertySettings === 'object') {
        for (const [key, value] of Object.entries(propertySettings)) {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                const propSetting = value as Record<string, unknown>
                // Ensure type field exists, defaulting to 'MANUAL' if missing or invalid
                normalized[key] = {
                    type: (propSetting.type === PropertyExecutionType.DYNAMIC 
                        ? PropertyExecutionType.DYNAMIC 
                        : PropertyExecutionType.MANUAL),
                    ...(propSetting.schema !== undefined ? { schema: propSetting.schema } : {}),
                }
            } else {
                // If value is not an object, create a valid PropertySettings entry
                normalized[key] = { type: PropertyExecutionType.MANUAL }
            }
        }
    }
    
    return normalized
}

/**
 * Recursively normalize propertySettings in a step (trigger or action)
 */
function normalizeStepPropertySettings(step: FlowTrigger | FlowAction): FlowTrigger | FlowAction {
    let normalizedStep: FlowTrigger | FlowAction = { ...step }
    
    // Normalize propertySettings for PIECE triggers and actions
    if (normalizedStep.type === FlowTriggerType.PIECE || normalizedStep.type === FlowActionType.PIECE) {
        const settings = normalizedStep.settings as PieceTriggerSettings | PieceActionSettings
        if (settings && typeof settings === 'object') {
            const normalizedPropertySettings = normalizePropertySettings(settings.propertySettings)
            normalizedStep = {
                ...normalizedStep,
                settings: {
                    ...settings,
                    propertySettings: normalizedPropertySettings,
                },
            }
        }
    }
    
    // Recursively normalize nextAction
    if ('nextAction' in normalizedStep && normalizedStep.nextAction) {
        normalizedStep = {
            ...normalizedStep,
            nextAction: normalizeStepPropertySettings(normalizedStep.nextAction) as FlowAction,
        }
    }
    
    // Recursively normalize firstLoopAction
    if ('firstLoopAction' in normalizedStep && normalizedStep.firstLoopAction) {
        normalizedStep = {
            ...normalizedStep,
            firstLoopAction: normalizeStepPropertySettings(normalizedStep.firstLoopAction) as FlowAction,
        }
    }
    
    // Recursively normalize router children
    if ('children' in normalizedStep && Array.isArray(normalizedStep.children)) {
        normalizedStep = {
            ...normalizedStep,
            children: normalizedStep.children.map(child => 
                child ? normalizeStepPropertySettings(child) as FlowAction : null
            ),
        }
    }
    
    return normalizedStep
}

function cleanOperation(operation: FlowOperationRequest): FlowOperationRequest {
    if (operation.type === FlowOperationType.IMPORT_FLOW) {
        const clearSampleData = {
            sampleDataFileId: undefined,
            sampleDataInputFileId: undefined,
            lastTestDate: undefined,
        }
        const trigger = flowStructureUtil.transferStep(operation.request.trigger, (step) => {
            return {
                ...step,
                settings: {
                    ...step.settings,
                    sampleData: {
                        ...step.settings.sampleData,
                        ...clearSampleData,
                    },
                },
            }
        }) as FlowTrigger
        
        // Normalize propertySettings in the trigger and all nested actions
        const normalizedTrigger = normalizeStepPropertySettings(trigger) as FlowTrigger
        
        return {
            ...operation,
            request: {
                ...operation.request,
                trigger: {
                    ...normalizedTrigger,
                    settings: {
                        ...normalizedTrigger.settings,
                        sampleData: {
                            ...normalizedTrigger.settings.sampleData,
                            ...clearSampleData,
                        },
                    },
                },
            },
        }
    }
    return operation
}

async function assertThatFlowIsNotBeingUsed(
    flow: PopulatedFlow,
    userId: string,
): Promise<void> {
    const currentTime = dayjs()
    if (
        !isNil(flow.version.updatedBy) &&
        flow.version.updatedBy !== userId &&
        currentTime.diff(dayjs(flow.version.updated), 'minute') <= 1
    ) {
        throw new ActivepiecesError({
            code: ErrorCode.FLOW_IN_USE,
            params: {
                flowVersionId: flow.version.id,
                message:
                    'Flow is being used by another user in the last minute. Please try again later.',
            },
        })
    }
}

const CreateFlowRequestOptions = {
    config: {
        allowedPrincipals: [PrincipalType.USER, PrincipalType.SERVICE] as const,
        permission: Permission.WRITE_FLOW,
    },
    schema: {
        tags: ['flows'],
        description: 'Create a flow',
        security: [SERVICE_KEY_SECURITY_OPENAPI],
        body: CreateFlowRequest,
        response: {
            [StatusCodes.CREATED]: PopulatedFlow,
        },
    },
}


const ListFlowsRequestOptions = {
    config: {
        allowedPrincipals: [PrincipalType.USER, PrincipalType.SERVICE] as const,
        permission: Permission.READ_FLOW,
    },
    schema: {
        tags: ['flows'],
        description: 'List flows',
        security: [SERVICE_KEY_SECURITY_OPENAPI],
        querystring: ListFlowsRequest,
        response: {
            [StatusCodes.OK]: SeekPage(PopulatedFlow),
        },
    },
}

const CountFlowsRequestOptions = {
    config: {
        allowedPrincipals: [PrincipalType.USER, PrincipalType.SERVICE] as const,
        permission: Permission.READ_FLOW,
    },
    schema: {
        querystring: CountFlowsRequest,
    },
}

const GetFlowTemplateRequestOptions = {
    config: {
        allowedPrincipals: [PrincipalType.USER, PrincipalType.SERVICE] as const,
        permission: Permission.READ_FLOW,
    },
    schema: {
        tags: ['flows'],
        security: [SERVICE_KEY_SECURITY_OPENAPI],
        description: 'Export flow as template',
        params: Type.Object({
            id: ApId,
        }),
        querystring: GetFlowTemplateRequestQuery,
        response: {
            [StatusCodes.OK]: FlowTemplateWithoutProjectInformation,
        },
    },
}

const GetFlowRequestOptions = {
    config: {
        allowedPrincipals: [PrincipalType.USER, PrincipalType.SERVICE] as const,
        permission: Permission.READ_FLOW,
    },
    schema: {
        tags: ['flows'],
        security: [SERVICE_KEY_SECURITY_OPENAPI],
        description: 'Get a flow by id',
        params: Type.Object({
            id: ApId,
        }),
        querystring: GetFlowQueryParamsRequest,
        response: {
            [StatusCodes.OK]: PopulatedFlow,
        },
    },
}

const DeleteFlowRequestOptions = {
    config: {
        allowedPrincipals: [PrincipalType.USER, PrincipalType.SERVICE] as const,
        permission: Permission.WRITE_FLOW,
    },
    schema: {
        tags: ['flows'],
        security: [SERVICE_KEY_SECURITY_OPENAPI],
        description: 'Delete a flow',
        params: Type.Object({
            id: ApId,
        }),
        response: {
            [StatusCodes.NO_CONTENT]: Type.Never(),
        },
    },
}


