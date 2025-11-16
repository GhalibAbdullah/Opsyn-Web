import { t } from 'i18next';
import { Activity, CheckCircle, Clock, FileText, Trash2, Upload } from 'lucide-react';
import React from 'react';

import { useEmbedding } from '@/components/embed-provider';
import { CardListItem } from '@/components/custom/card-list';
import { UserAvatar } from '@/components/ui/user-avatar';
import { formatUtils } from '@/lib/utils';
import { FlowActivityAction, FlowActivityWithUser } from '@activepieces/shared';

const getActivityIcon = (action: FlowActivityAction) => {
  switch (action) {
    case FlowActivityAction.CREATED:
      return <FileText className="w-4 h-4" />;
    case FlowActivityAction.DELETED:
      return <Trash2 className="w-4 h-4" />;
    case FlowActivityAction.PUBLISHED:
      return <Upload className="w-4 h-4" />;
    case FlowActivityAction.STATUS_CHANGED:
      return <CheckCircle className="w-4 h-4" />;
    default:
      return <Activity className="w-4 h-4" />;
  }
};

const getActivityColor = (action: FlowActivityAction): string => {
  switch (action) {
    case FlowActivityAction.CREATED:
      return 'text-blue-500';
    case FlowActivityAction.DELETED:
      return 'text-red-500';
    case FlowActivityAction.PUBLISHED:
      return 'text-green-500';
    case FlowActivityAction.STATUS_CHANGED:
      return 'text-yellow-500';
    default:
      return 'text-muted-foreground';
  }
};

interface FlowActivityItemProps {
  activity: FlowActivityWithUser;
}

export const FlowActivityItem = React.memo(({ activity }: FlowActivityItemProps) => {
  const showAvatar = !useEmbedding().embedState.isEmbedded;
  const user = activity.user;
  const userName = user
    ? `${user.firstName} ${user.lastName}`.trim() || user.email
    : t('System');
  const userEmail = user?.email;

  return (
    <CardListItem interactive={false} className="py-3">
      {showAvatar && user && userEmail && (
        <UserAvatar
          size={28}
          name={userName}
          email={userEmail}
        />
      )}
      <div className="grid gap-1 flex-1">
        <div className="flex items-center gap-2">
          <div className={getActivityColor(activity.action)}>
            {getActivityIcon(activity.action)}
          </div>
          <p className="text-sm font-medium leading-none">{activity.message}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>
            {formatUtils.formatDateToAgo(new Date(activity.created))}
          </span>
          {user && (
            <>
              <span>•</span>
              <span>{userName}</span>
            </>
          )}
        </div>
      </div>
    </CardListItem>
  );
});

FlowActivityItem.displayName = 'FlowActivityItem';

