import { t } from 'i18next';
import { useState } from 'react';

import {
  LeftSideBarType,
  useBuilderStateContext,
} from '@/app/builder/builder-hooks';
import { CardList, CardListItemSkeleton } from '@/components/custom/card-list';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { flowActivityHooks } from '@/features/flows/lib/flow-activity-hooks';
import { FlowActivityAction } from '@activepieces/shared';

import { SidebarHeader } from '../sidebar-header';
import { FlowActivityItem } from './flow-activity-item';

const FlowActivityList = () => {
  const [flow, setLeftSidebar, leftSidebar] = useBuilderStateContext(
    (state) => [state.flow, state.setLeftSidebar, state.leftSidebar],
  );

  const [search, setSearch] = useState('');
  const [selectedActions, setSelectedActions] = useState<FlowActivityAction[]>([]);

  const isVisible = leftSidebar === LeftSideBarType.ACTIVITY;

  const {
    data: activityPage,
    isLoading,
    isError,
  } = flowActivityHooks.useFlowActivities(flow.id, {
    limit: 50,
    cursor: undefined,
    search: search || undefined,
    action: selectedActions.length > 0 ? selectedActions : undefined,
    enabled: isVisible,
  });

  const toggleAction = (action: FlowActivityAction) => {
    setSelectedActions((prev) =>
      prev.includes(action)
        ? prev.filter((a) => a !== action)
        : [...prev, action],
    );
  };

  return (
    <>
      <SidebarHeader onClose={() => setLeftSidebar(LeftSideBarType.NONE)}>
        {t('Activity Log')}
      </SidebarHeader>
      <div className="flex flex-col h-full">
        <div className="p-4 border-b space-y-3">
          <Input
            placeholder={t('Search activities...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedActions.length === 0 ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedActions([])}
            >
              {t('All')}
            </Button>
            <Button
              variant={
                selectedActions.includes(FlowActivityAction.CREATED)
                  ? 'default'
                  : 'outline'
              }
              size="sm"
              onClick={() => toggleAction(FlowActivityAction.CREATED)}
            >
              {t('Created')}
            </Button>
            <Button
              variant={
                selectedActions.includes(FlowActivityAction.UPDATED)
                  ? 'default'
                  : 'outline'
              }
              size="sm"
              onClick={() => toggleAction(FlowActivityAction.UPDATED)}
            >
              {t('Updated')}
            </Button>
            <Button
              variant={
                selectedActions.includes(FlowActivityAction.PUBLISHED)
                  ? 'default'
                  : 'outline'
              }
              size="sm"
              onClick={() => toggleAction(FlowActivityAction.PUBLISHED)}
            >
              {t('Published')}
            </Button>
            <Button
              variant={
                selectedActions.includes(FlowActivityAction.DELETED)
                  ? 'default'
                  : 'outline'
              }
              size="sm"
              onClick={() => toggleAction(FlowActivityAction.DELETED)}
            >
              {t('Deleted')}
            </Button>
          </div>
        </div>
        <CardList className="flex-1">
          {isLoading && <CardListItemSkeleton numberOfCards={10} />}
          {isError && <div className="p-4 text-sm text-muted-foreground">{t('Error loading activities. Please try again.')}</div>}
          {activityPage && activityPage.data && (
            <ScrollArea className="w-full h-full">
              {activityPage.data.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground text-center">
                  {t('No activities found')}
                </div>
              ) : (
                activityPage.data.map((activity) => (
                  <FlowActivityItem key={activity.id} activity={activity} />
                ))
              )}
            </ScrollArea>
          )}
        </CardList>
      </div>
    </>
  );
};

FlowActivityList.displayName = 'FlowActivityList';

export { FlowActivityList };

