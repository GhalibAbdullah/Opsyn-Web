import { api } from '@/lib/api'
import {
    FlowActivityWithUser,
    FlowId,
    ListFlowActivitiesQueryParams,
    SeekPage,
} from '@activepieces/shared'

export const flowActivityApi = {
    async list(flowId: FlowId, params: ListFlowActivitiesQueryParams) {
        return await api.get<SeekPage<FlowActivityWithUser>>(
            `/v1/flows/${flowId}/activity`,
            params,
        )
    },
}

