import { useQuery } from '@tanstack/react-query';

import { flagsHooks } from '@/hooks/flags-hooks';
import { userHooks } from '@/hooks/user-hooks';
import { authenticationApi } from '@/lib/authentication-api';
import { authenticationSession } from '@/lib/authentication-session';
import { platformApi } from '@/lib/platforms-api';
import {
  ApEdition,
  ApFlagId,
  isNil,
  Permission,
  PlatformRole,
} from '@activepieces/shared';

const COMMUNITY_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  OWNER: [
    Permission.READ_PROJECT,
    Permission.READ_FLOW,
    Permission.READ_FOLDER,
    Permission.READ_APP_CONNECTION,
    Permission.READ_INVITATION,
    Permission.READ_PROJECT_MEMBER,
    Permission.READ_RUN,
    Permission.READ_ALERT,
    Permission.READ_TODOS,
    Permission.READ_TABLE,
    Permission.READ_MCP,
    Permission.WRITE_FLOW,
    Permission.UPDATE_FLOW_STATUS,
    Permission.WRITE_FOLDER,
    Permission.WRITE_APP_CONNECTION,
    Permission.WRITE_INVITATION,
    Permission.WRITE_PROJECT_MEMBER,
    Permission.WRITE_PROJECT_RELEASE,
    Permission.WRITE_RUN,
    Permission.WRITE_ALERT,
    Permission.WRITE_TODOS,
    Permission.WRITE_TABLE,
    Permission.WRITE_MCP,
    Permission.WRITE_PROJECT,
  ],
  EDITOR: [
    Permission.READ_PROJECT,
    Permission.READ_FLOW,
    Permission.READ_FOLDER,
    Permission.READ_APP_CONNECTION,
    Permission.READ_INVITATION,
    Permission.READ_PROJECT_MEMBER,
    Permission.READ_RUN,
    Permission.READ_ALERT,
    Permission.READ_TODOS,
    Permission.READ_TABLE,
    Permission.READ_MCP,
    Permission.WRITE_FLOW,
    Permission.UPDATE_FLOW_STATUS,
    Permission.WRITE_FOLDER,
    Permission.WRITE_APP_CONNECTION,
    Permission.WRITE_RUN,
    Permission.WRITE_ALERT,
    Permission.WRITE_TODOS,
    Permission.WRITE_TABLE,
    Permission.WRITE_MCP,
  ],
  VIEWER: [
    Permission.READ_PROJECT,
    Permission.READ_FLOW,
    Permission.READ_FOLDER,
    Permission.READ_APP_CONNECTION,
    Permission.READ_INVITATION,
    Permission.READ_PROJECT_MEMBER,
    Permission.READ_RUN,
    Permission.READ_ALERT,
    Permission.READ_TODOS,
    Permission.READ_TABLE,
    Permission.READ_MCP,
  ],
};

export const useAuthorization = () => {
  const { data: edition } = flagsHooks.useFlag(ApFlagId.EDITION);

  const platformId = authenticationSession.getPlatformId();
  const { data: projectRole, isLoading } = useQuery({
    queryKey: ['project-role', authenticationSession.getProjectId()],
    queryFn: async () => {
      const platform = await platformApi.getCurrentPlatform();
      if (platform.plan.projectRolesEnabled) {
        const projectRole = await authenticationApi.getCurrentProjectRole();
        return projectRole;
      }
      // Community edition: still call the endpoint (returns { role: OWNER|EDITOR|VIEWER })
      return authenticationApi.getCurrentProjectRole();
    },
    retry: false,
    enabled: !isNil(edition) && !isNil(platformId),
  });

  const checkAccess = (permission: Permission) => {
    if (isLoading) {
      return false;
    }

    if (edition === ApEdition.COMMUNITY) {
      const roleName =
        (projectRole as any)?.role?.toUpperCase?.() ??
        (projectRole as any)?.name?.toUpperCase?.() ??
        'EDITOR';
      const allowed = COMMUNITY_ROLE_PERMISSIONS[roleName] || COMMUNITY_ROLE_PERMISSIONS.EDITOR;
      return allowed.includes(permission);
    }

    return projectRole?.permissions?.includes(permission) ?? false;
  };

  return { checkAccess };
};

export const useShowPlatformAdminDashboard = () => {
  const { data: user } = userHooks.useCurrentUser();
  return user?.platformRole === PlatformRole.ADMIN;
};
