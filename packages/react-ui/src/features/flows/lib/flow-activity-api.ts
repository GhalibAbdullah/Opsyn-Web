import { api } from '@/lib/api';
import {
  FlowActivityWithUser,
  ListFlowActivitiesQueryParams,
  SeekPage,
} from '@activepieces/shared';

export const flowActivityApi = {
  list(
    flowId: string,
    request: Omit<ListFlowActivitiesQueryParams, 'flowId'>,
  ): Promise<SeekPage<FlowActivityWithUser>> {
    return api.get<SeekPage<FlowActivityWithUser>>(
      `/v1/flows/${flowId}/activity`,
      request,
    );
  },
};

