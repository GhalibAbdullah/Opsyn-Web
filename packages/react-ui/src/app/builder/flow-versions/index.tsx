import { useQuery, useQueryClient } from '@tanstack/react-query';
import { t } from 'i18next';
import { useEffect, useRef } from 'react';

import {
  LeftSideBarType,
  useBuilderStateContext,
} from '@/app/builder/builder-hooks';
import { CardList, CardListItemSkeleton } from '@/components/custom/card-list';
import { ScrollArea } from '@/components/ui/scroll-area';
import { flowsApi } from '@/features/flows/lib/flows-api';
import { FlowVersionMetadata, SeekPage } from '@activepieces/shared';

import { SidebarHeader } from '../sidebar-header';

import { FlowVersionDetailsCard } from './flow-versions-card';

const FlowVersionsList = () => {
  const [flow, setLeftSidebar, selectedFlowVersion] = useBuilderStateContext(
    (state) => [state.flow, state.setLeftSidebar, state.flowVersion],
  );
  const queryClient = useQueryClient();

  const {
    data: flowVersionPage,
    isLoading,
    isError,
    refetch,
  } = useQuery<SeekPage<FlowVersionMetadata>, Error>({
    queryKey: ['flow-versions', flow.id],
    queryFn: () =>
      flowsApi.listVersions(flow.id, {
        limit: 1000,
        cursor: undefined,
      }),
    staleTime: 0,
  });

  // Refetch version history when flow version is updated (e.g., after adding nodes)
  // Track the updated timestamp to detect when the draft version changes
  const previousVersionKeyRef = useRef<string | null>(null);
  const currentVersionKey = selectedFlowVersion
    ? `${selectedFlowVersion.id}-${selectedFlowVersion.updated}`
    : null;
  
  useEffect(() => {
    // Only invalidate if the version key actually changed (not on initial mount)
    if (
      currentVersionKey &&
      previousVersionKeyRef.current !== null &&
      previousVersionKeyRef.current !== currentVersionKey
    ) {
      // Invalidate and refetch when the current version is updated
      queryClient.invalidateQueries({
        queryKey: ['flow-versions', flow.id],
      });
    }
    previousVersionKeyRef.current = currentVersionKey;
  }, [currentVersionKey, flow.id, queryClient]);

  return (
    <>
      <SidebarHeader onClose={() => setLeftSidebar(LeftSideBarType.NONE)}>
        {t('Version History')}
      </SidebarHeader>
      <CardList>
        {isLoading && <CardListItemSkeleton numberOfCards={10} />}
        {isError && <div>{t('Error, please try again.')}</div>}
        {flowVersionPage && flowVersionPage.data && (
          <ScrollArea className="w-full h-full">
            {flowVersionPage.data.map((flowVersion, index) => (
              <FlowVersionDetailsCard
                selected={flowVersion.id === selectedFlowVersion?.id}
                publishedVersionId={flow.publishedVersionId}
                flowVersion={flowVersion}
                flowVersionNumber={flowVersionPage.data.length - index}
                key={flowVersion.id}
              />
            ))}
          </ScrollArea>
        )}
      </CardList>
    </>
  );
};

FlowVersionsList.displayName = 'FlowVersionsList';

export { FlowVersionsList };
