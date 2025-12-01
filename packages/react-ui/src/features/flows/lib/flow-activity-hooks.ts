import { useQuery } from '@tanstack/react-query'
import { flowActivityApi } from './flow-activity-api'
import {
    FlowActivityWithUser,
    FlowId,
    ListFlowActivitiesQueryParams,
    SeekPage,
} from '@activepieces/shared'

export const flowActivityHooks = {
    useFlowActivities: (
        flowId: FlowId,
        params: ListFlowActivitiesQueryParams,
    ) => {
        return useQuery<SeekPage<FlowActivityWithUser>>({
            queryKey: ['flow-activities', flowId, params],
            queryFn: () => flowActivityApi.list(flowId, params),
            enabled: !!flowId,
        })
    },
}

