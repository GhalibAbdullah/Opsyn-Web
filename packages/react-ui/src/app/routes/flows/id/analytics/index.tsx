import { useParams } from 'react-router-dom';
import { FlowAnalyticsDashboard } from '@/features/flow-runs/components/flow-analytics-dashboard';
import { LoadingSpinner } from '@/components/ui/spinner';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { flowsApi } from '@/features/flows/lib/flows-api';
import { authenticationSession } from '@/lib/authentication-session';
import { isNil } from '@activepieces/shared';
import { t } from 'i18next';
import { FileX } from 'lucide-react';
import { Link } from 'react-router-dom';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
    return (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
        <div className="rounded-full bg-muted p-4">
          <FileX className="size-9 text-muted-foreground" />
        </div>

        <div>
          <h2 className="text-lg font-semibold">{t('Flow not found')}</h2>
          <p className="text-sm text-muted-foreground">
            {t("The flow you are looking for doesn't exist or was removed.")}
          </p>
        </div>

        <Link
          className={cn(buttonVariants({ variant: 'outline' }))}
          to="/dashboard"
        >
          {t('Go to Dashboard')}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full p-6">
      <FlowAnalyticsDashboard flowId={flowId} />
    </div>
  );
};

export { FlowAnalyticsPage };

