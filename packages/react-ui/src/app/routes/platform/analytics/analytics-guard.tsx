import { Navigate } from 'react-router-dom';

import { flagsHooks } from '@/hooks/flags-hooks';
import { ApEdition, ApFlagId } from '@activepieces/shared';

import AnalyticsPage from './index';

export function AnalyticsGuard() {
  const { data: edition } = flagsHooks.useFlag<ApEdition>(ApFlagId.EDITION);

  if (edition === ApEdition.COMMUNITY) {
    return <Navigate to="/platform/projects" replace />;
  }

  return <AnalyticsPage />;
}
