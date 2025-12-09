import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import { useAuthorization } from '@/hooks/authorization-hooks';
import { LoadingScreen } from '@/components/ui/loading-screen';
import { Permission } from '@activepieces/shared';

export const RoutePermissionGuard = ({
  permission,
  children,
}: {
  children: ReactNode;
  permission: Permission;
}) => {
  const { checkAccess, isLoading } = useAuthorization();

  // While we are resolving project role/permissions, show a loading screen
  // instead of denying access. This prevents false 404s during project switches
  // or immediately after project creation.
  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!checkAccess(permission)) {
    return <Navigate replace={true} to="/404"></Navigate>;
  }

  return children;
};
