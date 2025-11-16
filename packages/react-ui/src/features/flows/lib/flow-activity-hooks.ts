import { useQuery } from '@tanstack/react-query';
import { flowActivityApi } from './flow-activity-api';
import {
  FlowActivityWithUser,
  ListFlowActivitiesQueryParams,
  SeekPage,
} from '@activepieces/shared';

const createFlowActivityQueryKey = (flowId: string, params: Omit<ListFlowActivitiesQueryParams, 'flowId'>) => 
  ['flow-activity', flowId, params];

export const flowActivityHooks = {
  useFlowActivities: (
    flowId: string | undefined,
    params: Omit<ListFlowActivitiesQueryParams, 'flowId'> & { enabled?: boolean } = {},
  ) => {
    const { enabled: enabledParam, ...queryParams } = params;
    return useQuery<SeekPage<FlowActivityWithUser>>({
      queryKey: createFlowActivityQueryKey(flowId || '', queryParams),
      queryFn: async () => {
        if (!flowId) {
          throw new Error('Flow ID is required');
        }
        return await flowActivityApi.list(flowId, queryParams);
      },
      enabled: (enabledParam !== undefined ? enabledParam : true) && !!flowId,
      staleTime: 5 * 1000, // Consider data stale after 5 seconds
    });
  },
};

