import { useQuery } from '@tanstack/react-query';
import React from 'react';

import { flowRunsApi } from './flow-runs-api';
import {
  FlowAnalytics,
  GetFlowAnalyticsRequestQuery,
} from '@activepieces/shared';
import { authenticationSession } from '@/lib/authentication-session';

export const flowRunsHooks = {
  useFlowAnalytics: (request: Omit<GetFlowAnalyticsRequestQuery, 'projectId'>) => {
    const projectId = authenticationSession.getProjectId()!;
    // Use a stable query key that doesn't change on every render
    // If endDate is undefined, it means "now" which should be in the key as null
    const queryKey = ['flow-analytics', request.flowId, request.startDate, request.endDate ?? null, projectId];
    
    const queryResult = useQuery<FlowAnalytics>({
      queryKey,
      queryFn: () => flowRunsApi.getAnalytics({
        ...request,
        projectId,
      }),
      staleTime: 0, // Always consider data stale to allow fresh fetches
      gcTime: 0, // Don't cache data when component unmounts
      enabled: !!request.flowId && !!projectId,
      retry: 1,
      refetchOnWindowFocus: true, // Refetch when user focuses the window
      refetchInterval: 10000, // Refetch every 10 seconds to get updated analytics
    });

    // Handle errors using useEffect
    React.useEffect(() => {
      if (queryResult.error) {
        console.error('Error fetching flow analytics:', queryResult.error);
      }
    }, [queryResult.error]);

    return queryResult;
  },
};

