import { FlowActivityAction, FlowOperationType, FlowStatus } from '@activepieces/shared'

export function mapFlowOperationToAction(
    operationType: FlowOperationType,
): FlowActivityAction {
    switch (operationType) {
        case FlowOperationType.LOCK_AND_PUBLISH:
            return FlowActivityAction.PUBLISHED
        case FlowOperationType.CHANGE_STATUS:
            return FlowActivityAction.STATUS_CHANGED
        case FlowOperationType.CHANGE_FOLDER:
            return FlowActivityAction.FOLDER_CHANGED
        case FlowOperationType.CHANGE_NAME:
            return FlowActivityAction.NAME_CHANGED
        case FlowOperationType.UPDATE_METADATA:
            return FlowActivityAction.METADATA_UPDATED
        case FlowOperationType.UPDATE_TRIGGER:
            return FlowActivityAction.TRIGGER_UPDATED
        case FlowOperationType.ADD_ACTION:
            return FlowActivityAction.ACTION_ADDED
        case FlowOperationType.UPDATE_ACTION:
            return FlowActivityAction.ACTION_UPDATED
        case FlowOperationType.DELETE_ACTION:
            return FlowActivityAction.ACTION_DELETED
        case FlowOperationType.MOVE_ACTION:
            return FlowActivityAction.ACTION_MOVED
        case FlowOperationType.DUPLICATE_ACTION:
            return FlowActivityAction.ACTION_DUPLICATED
        case FlowOperationType.ADD_BRANCH:
            return FlowActivityAction.BRANCH_ADDED
        case FlowOperationType.DELETE_BRANCH:
            return FlowActivityAction.BRANCH_DELETED
        case FlowOperationType.DUPLICATE_BRANCH:
            return FlowActivityAction.BRANCH_DUPLICATED
        default:
            return FlowActivityAction.UPDATED
    }
}

export function generateActivityMessage(
    action: FlowActivityAction,
    operationType?: FlowOperationType,
    details?: Record<string, unknown>,
): string {
    switch (action) {
        case FlowActivityAction.CREATED:
            return 'Flow created'
        case FlowActivityAction.DELETED:
            return 'Flow deleted'
        case FlowActivityAction.PUBLISHED:
            return 'Flow published'
        case FlowActivityAction.STATUS_CHANGED:
            const status = details?.status as string
            return `Flow status changed to ${status?.toLowerCase() || 'unknown'}`
        case FlowActivityAction.FOLDER_CHANGED:
            return 'Flow moved to a different folder'
        case FlowActivityAction.NAME_CHANGED:
            const newName = details?.displayName as string
            return newName ? `Flow renamed to "${newName}"` : 'Flow renamed'
        case FlowActivityAction.METADATA_UPDATED:
            return 'Flow metadata updated'
        case FlowActivityAction.TRIGGER_UPDATED:
            return 'Flow trigger updated'
        case FlowActivityAction.ACTION_ADDED:
            const actionName = details?.actionName as string
            return actionName ? `Action "${actionName}" added` : 'Action added'
        case FlowActivityAction.ACTION_UPDATED:
            const updatedActionName = details?.actionName as string
            return updatedActionName
                ? `Action "${updatedActionName}" updated`
                : 'Action updated'
        case FlowActivityAction.ACTION_DELETED:
            const deletedActionName = details?.actionName as string
            return deletedActionName
                ? `Action "${deletedActionName}" deleted`
                : 'Action deleted'
        case FlowActivityAction.ACTION_MOVED:
            return 'Action moved'
        case FlowActivityAction.ACTION_DUPLICATED:
            return 'Action duplicated'
        case FlowActivityAction.BRANCH_ADDED:
            return 'Branch added'
        case FlowActivityAction.BRANCH_DELETED:
            return 'Branch deleted'
        case FlowActivityAction.BRANCH_DUPLICATED:
            return 'Branch duplicated'
        default:
            const fallbackActionName = action.toLowerCase().replace(/_/g, ' ')
            return `Flow ${fallbackActionName}`
    }
}

