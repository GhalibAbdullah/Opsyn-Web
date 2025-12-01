import { useParams } from 'react-router-dom';
import { NotAvailablePage } from '@/app/components/not-available-page';
import { FlowAnalyticsDashboard } from '@/features/flow-runs/components/flow-analytics-dashboard';
import { LoadingSpinner } from '@/components/ui/spinner';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { flowsApi } from '@/features/flows/lib/flows-api';
import { authenticationSession } from '@/lib/authentication-session';
import { isNil } from '@activepieces/shared';

const FlowAnalyticsPage = () => {
  const { flowId } = useParams();

  const {
    data: flow,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['flow', flowId, authenticationSession.getProjectId()],
    queryFn: () => flowsApi.get(flowId!),
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    enabled: !!flowId,
  });

  useEffect(() => {
    if (error) {
      console.error('FlowAnalyticsPage - error fetching flow:', error);
    }
  }, [error]);

  if (isLoading) {
    return (
      <div className="bg-background flex h-full w-full items-center justify-center">
        <LoadingSpinner isLarge={true}></LoadingSpinner>
      </div>
    );
  }

  if (isNil(flow) || isError || !flowId) {
    return <NotAvailablePage />;
  }

  return (
    <div className="flex flex-col gap-6 w-full p-6">
      <FlowAnalyticsDashboard flowId={flowId} />
    </div>
  );
};

export { FlowAnalyticsPage };

