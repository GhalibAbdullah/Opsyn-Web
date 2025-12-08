import { FlowEditorInfo, FlowEditorJoined, FlowEditorLeft, FlowEditorsChanged, PrincipalType, UserPrincipal, WebsocketClientEvent, WebsocketServerEvent } from '@activepieces/shared'
import { FastifyBaseLogger } from 'fastify'
import { Socket } from 'socket.io'
import { userIdentityService } from '../../authentication/user-identity/user-identity-service'
import { userService } from '../../user/user-service'
import { websocketService } from '../../core/websockets.service'
import { app } from '../../server'
import { flowService } from './flow.service'

// Track active editors per flow: flowId -> userId -> Set<socketId>
const activeEditors = new Map<string, Map<string, Set<string>>>()

// Track which flows a socket is in: socketId -> Set<flowId>
const socketFlowMembership = new Map<string, Set<string>>()

// Track user info for active editors: userId -> { userId, userName, userEmail }
const editorInfoCache = new Map<string, FlowEditorInfo>()

export const flowWebsocketHandlers = (log: FastifyBaseLogger) => {
    const getFlowRoom = (flowId: string): string => `flow:${flowId}`

    const getUserIdsForFlow = (flowId: string): Set<string> | undefined => {
        const usersMap = activeEditors.get(flowId)
        if (!usersMap) {
            return undefined
        }
        return new Set(usersMap.keys())
    }

    const addSocketMembership = (socketId: string, flowId: string): void => {
        if (!socketFlowMembership.has(socketId)) {
            socketFlowMembership.set(socketId, new Set())
        }
        socketFlowMembership.get(socketId)!.add(flowId)
    }

    const removeSocketMembership = (socketId: string, flowId: string, userId: string): void => {
        const flows = socketFlowMembership.get(socketId)
        if (flows) {
            flows.delete(flowId)
            if (flows.size === 0) {
                socketFlowMembership.delete(socketId)
            }
        }

        const flowUsers = activeEditors.get(flowId)
        if (flowUsers) {
            const sockets = flowUsers.get(userId)
            if (sockets) {
                sockets.delete(socketId)
                if (sockets.size === 0) {
                    flowUsers.delete(userId)
                }
            }
            if (flowUsers.size === 0) {
                activeEditors.delete(flowId)
            }
        }
    }

    const broadcastEditorsChanged = async (flowId: string): Promise<void> => {
        if (!app?.io) {
            log.warn('Socket.IO not available, cannot broadcast editors changed')
            return
        }
        const roomName = getFlowRoom(flowId)
        const room = app.io.sockets.adapter.rooms.get(roomName)
        const socketsInRoom = room ? new Set(room.keys()) : new Set<string>()

        const userIds = getUserIdsForFlow(flowId)
        if (!userIds || userIds.size === 0) {
            // No editors, broadcast empty array
            app.io.to(roomName).emit(WebsocketClientEvent.FLOW_EDITORS_CHANGED, {
                flowId,
                editors: [],
            } as FlowEditorsChanged)
            return
        }

        // Get editor info for all active editors that still have a socket in the room
        const editors: FlowEditorInfo[] = []
        for (const userId of userIds) {
            const socketsForUser = activeEditors.get(flowId)?.get(userId)
            const hasSocketInRoom = socketsForUser ? [...socketsForUser].some((sid) => socketsInRoom.has(sid)) : false
            if (!hasSocketInRoom) {
                // Clean up stale membership
                activeEditors.get(flowId)?.delete(userId)
                continue
            }

            let editorInfo = editorInfoCache.get(userId)
            if (!editorInfo) {
                // Fetch user info if not cached
                try {
                    const user = await userService.getOneOrFail({ id: userId })
                    const identity = await userIdentityService(log).getOneOrFail({ id: user.identityId })
                    editorInfo = {
                        userId: user.id,
                        userName: `${identity.firstName} ${identity.lastName}`.trim() || identity.email,
                        userEmail: identity.email,
                    }
                    editorInfoCache.set(userId, editorInfo)
                } catch (error) {
                    log.warn({ userId, error }, 'Failed to fetch user info for editor')
                    continue
                }
            }
            editors.push(editorInfo)
        }

        // Broadcast to all clients in the flow room
        const socketsInRoomCount = socketsInRoom.size
        const payload = {
            flowId,
            editors,
        } as FlowEditorsChanged
        log.info({ 
            flowId, 
            editorsCount: editors.length, 
            roomName,
            socketsInRoom: socketsInRoomCount,
        }, 'Broadcasting editors changed to room (all users in room should receive this)')
        app.io.to(roomName).emit(WebsocketClientEvent.FLOW_EDITORS_CHANGED, payload)
    }

    return {
        handleEditorJoined: (socket: Socket) => {
            return async (data: FlowEditorJoined, principal: UserPrincipal): Promise<void> => {
                if (principal.type !== PrincipalType.USER) {
                    return
                }

                const { flowId } = data
                const userId = principal.id

                if (!principal.projectId) {
                    log.warn({ flowId, userId }, 'User principal missing projectId, rejecting join')
                    return
                }

                // Ensure flow belongs to the same project (prevents cross-project leakage)
                try {
                    await flowService(log).getOnePopulatedOrThrow({
                        id: flowId,
                        projectId: principal.projectId,
                    })
                } catch (error) {
                    log.warn({ flowId, userId, projectId: principal.projectId, error }, 'Flow join rejected (flow not in project or not found)')
                    return
                }

                log.info({ flowId, userId }, 'Flow editor joined')

                // Join the flow-specific room
                const roomName = getFlowRoom(flowId)
                await socket.join(roomName)
                const room = app?.io?.sockets.adapter.rooms.get(roomName)
                const socketsInRoom = room ? room.size : 0
                log.debug({ flowId, userId, roomName, socketsInRoom }, 'User joined flow room')

                // Add to active editors tracking per socket
                if (!activeEditors.has(flowId)) {
                    activeEditors.set(flowId, new Map())
                }
                const userSockets = activeEditors.get(flowId)!.get(userId) ?? new Set<string>()
                userSockets.add(socket.id)
                activeEditors.get(flowId)!.set(userId, userSockets)
                addSocketMembership(socket.id, flowId)

                // Cache user info if not already cached (must complete before broadcasting)
                if (!editorInfoCache.has(userId)) {
                    try {
                        const user = await userService.getOneOrFail({ id: userId })
                        const identity = await userIdentityService(log).getOneOrFail({ id: user.identityId })
                        editorInfoCache.set(userId, {
                            userId: user.id,
                            userName: `${identity.firstName} ${identity.lastName}`.trim() || identity.email,
                            userEmail: identity.email,
                        })
                    } catch (error) {
                        log.warn({ userId, error }, 'Failed to fetch user info for editor')
                    }
                }

                // Broadcast editors changed to all in room (including the newly joined user)
                // This will notify everyone, including User A who was already in the room
                await broadcastEditorsChanged(flowId)
                
                // Also send directly to the newly joined socket to ensure they receive it
                // This is important because the badge component might set up its listener
                // after the broadcast happens, or there might be a timing issue with room joins
                // We use a small delay to give the frontend time to set up its listener
                const userIds = getUserIdsForFlow(flowId)
                if (userIds && userIds.size > 0) {
                    const editors: FlowEditorInfo[] = []
                    for (const uid of userIds) {
                        const editorInfo = editorInfoCache.get(uid)
                        if (editorInfo) {
                            editors.push(editorInfo)
                        }
                    }
                    log.debug({ flowId, editorsCount: editors.length, userId }, 'Sending editors list directly to newly joined socket')
                    // Use setTimeout with a small delay to ensure the frontend listener is set up
                    // This is a workaround for the race condition where the component mounts
                    // after the event is sent
                    setTimeout(() => {
                        socket.emit(WebsocketClientEvent.FLOW_EDITORS_CHANGED, {
                            flowId,
                            editors,
                        } as FlowEditorsChanged)
                    }, 200)
                }
            }
        },

        handleEditorLeft: (socket: Socket) => {
            return async (data: FlowEditorLeft, principal: UserPrincipal): Promise<void> => {
                if (principal.type !== PrincipalType.USER) {
                    return
                }

                const { flowId } = data
                const userId = principal.id

                log.info({ flowId, userId }, 'Flow editor left')

                // Leave the flow-specific room
                await socket.leave(getFlowRoom(flowId))

                // Remove from active editors tracking for this socket
                removeSocketMembership(socket.id, flowId, userId)

                // Broadcast editors changed
                await broadcastEditorsChanged(flowId)
            }
        },

        // Helper to broadcast flow operation to all editors in a flow room
        broadcastFlowOperation: async (flowId: string, operation: unknown, flowVersionId: string, userId: string): Promise<void> => {
            if (!app?.io) {
                log.warn('Socket.IO not available, cannot broadcast flow operation')
                return
            }
            app.io.to(getFlowRoom(flowId)).emit(WebsocketClientEvent.FLOW_OPERATION_BROADCAST, {
                flowId,
                operation,
                flowVersionId,
                userId,
                timestamp: new Date().toISOString(),
            })
        },

        // Clean up on disconnect (optional, but good practice)
        handleDisconnect: (socket: Socket) => {
            return async (): Promise<void> => {
                log.info({ socketId: socket.id }, 'Socket disconnected, cleaning up flow editor tracking')
                const flows = socketFlowMembership.get(socket.id)
                if (flows) {
                    for (const flowId of flows) {
                        // Remove socket membership; userId is unknown here, so remove from all users that contain this socket
                        const usersMap = activeEditors.get(flowId)
                        if (usersMap) {
                            for (const [userId, sockets] of usersMap.entries()) {
                                if (sockets.has(socket.id)) {
                                    removeSocketMembership(socket.id, flowId, userId)
                                }
                            }
                        }
                        await broadcastEditorsChanged(flowId)
                    }
                }
            }
        },
    }
}

// Export a standalone broadcast function for use in controllers
export const broadcastFlowOperation = async (flowId: string, operation: unknown, flowVersionId: string, userId: string, log: FastifyBaseLogger): Promise<void> => {
    if (!app?.io) {
        log.warn('Socket.IO not available, cannot broadcast flow operation')
        return
    }
    const flowRoom = `flow:${flowId}`
    app.io.to(flowRoom).emit(WebsocketClientEvent.FLOW_OPERATION_BROADCAST, {
        flowId,
        operation,
        flowVersionId,
        userId,
        timestamp: new Date().toISOString(),
    })
    log.debug({ flowId, flowVersionId, userId }, 'Broadcasted flow operation')
}

