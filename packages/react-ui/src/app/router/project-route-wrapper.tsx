import React, { useEffect, useState } from 'react';
import { Navigate, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

import { ProjectNotFoundPage } from '@/app/components/project-not-found-page';
import { useAuthorization } from '@/hooks/authorization-hooks';
import { projectHooks } from '@/hooks/project-hooks';
import { useProjectMemberRemovalHandler } from '@/hooks/use-project-member-removal-handler';
import {
  FROM_QUERY_PARAM,
  useDefaultRedirectPath,
} from '@/lib/navigation-utils';
import { determineDefaultRoute } from '@/lib/utils';
import { isNil } from '@activepieces/shared';
import { projectApi } from '@/lib/project-api';

import { LoadingScreen } from '../../components/ui/loading-screen';
import { authenticationSession } from '../../lib/authentication-session';
import { AllowOnlyLoggedInUserOnlyGuard } from '../components/allow-logged-in-user-only-guard';

export const TokenCheckerWrapper: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [searchParams] = useSearchParams();
  // Check if we're coming from an invitation acceptance FIRST, before any hooks
  const fromInvitation = searchParams.get('fromInvitation') === 'true';
  const [invitationWaitTime, setInvitationWaitTime] = useState(fromInvitation ? Date.now() : null);
  
  const {
    isError,
    error,
    data: isProjectValid,
    projectIdFromParams,
    isLoading,
    isFetching,
  } = projectHooks.useSwitchToProjectInParams();

  const { checkAccess } = useAuthorization();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isRetryingInvitation, setIsRetryingInvitation] = useState(false);
  
  // Handle project member removal via WebSocket
  useProjectMemberRemovalHandler();

  // Handle automatic redirect when user loses project access
  // Skip redirect logic if we're retrying from invitation acceptance
  useEffect(() => {
    const failedToSwitchToProject =
      !isProjectValid && !isNil(projectIdFromParams);
    
    // Don't redirect if we're coming from invitation - let the retry logic handle it
    if (fromInvitation) {
      return;
    }
    
    if ((failedToSwitchToProject || (isError && !isProjectValid)) && !isRedirecting && !isLoading && !isFetching) {
      setIsRedirecting(true);
      
      // Try to automatically redirect the user immediately
      const attemptRedirect = async () => {
        try {
          // Check if user has platform admin access by checking platformRole in token
          const token = authenticationSession.getToken();
          let hasPlatformAccess = false;
          if (token) {
            try {
              const { jwtDecode } = await import('jwt-decode');
              const decoded = jwtDecode<any>(token);
              hasPlatformAccess = decoded?.platformRole === 'ADMIN';
            } catch (e) {
              // If we can't decode, assume no platform access
            }
          }
          
          // Check if user has any other projects
          let hasProjects = false;
          try {
            const projects = await projectApi.list({ limit: 1 });
            if (projects.data && projects.data.length > 0) {
              hasProjects = true;
              // Switch to first available project
              await authenticationSession.switchToProject(projects.data[0].id);
              window.location.href = `/projects/${projects.data[0].id}/flows`;
              return;
            }
          } catch (listError) {
            // If we can't fetch projects, assume no projects
            hasProjects = false;
          }
          
          // If user has no projects, redirect to dashboard
          if (!hasProjects) {
            window.location.href = '/dashboard';
            return;
          }
          
          // If user has platform access but no projects, still go to platform admin
          if (hasPlatformAccess) {
            window.location.href = '/platform';
            return;
          }
          
          // If we reach here, couldn't redirect - will show error page below
          setIsRedirecting(false);
        } catch (redirectError) {
          // If redirect fails, redirect to dashboard as fallback
          window.location.href = '/dashboard';
        }
      };
      
      // Run redirect immediately
      attemptRedirect();
    }
  }, [isProjectValid, isError, projectIdFromParams, navigate, isRedirecting, isLoading, isFetching, fromInvitation]);

  if (isNil(projectIdFromParams)) {
    return <Navigate to="/sign-in" replace />;
  }
  
  const failedToSwitchToProject =
    !isProjectValid && !isNil(projectIdFromParams);
  
  // If coming from invitation and switch failed, retry with exponential backoff
  useEffect(() => {
    if (fromInvitation && failedToSwitchToProject && !isRetryingInvitation && !isLoading && !isFetching && !isRedirecting) {
      setIsRetryingInvitation(true);
      
      const retrySwitch = async () => {
        const maxRetries = 20; // Retry for up to ~60 seconds
        const baseDelayMs = 2000; // Start with 2 seconds
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          if (attempt > 0) {
            const delayMs = baseDelayMs * Math.min(attempt, 4); // Cap at 8 seconds per retry
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
          
          try {
            // Try to switch to the project
            await authenticationSession.switchToProject(projectIdFromParams!);
            // If successful, invalidate and refetch the query to trigger a re-check
            await queryClient.invalidateQueries({ 
              queryKey: ['switch-to-project', projectIdFromParams] 
            });
            // Also invalidate projects list
            await queryClient.invalidateQueries({ 
              queryKey: ['projects'] 
            });
            // Refetch the switch-to-project query to update the component state
            await queryClient.refetchQueries({ 
              queryKey: ['switch-to-project', projectIdFromParams] 
            });
            // Remove the fromInvitation param - the component will re-render with the new state
            const newSearchParams = new URLSearchParams(searchParams);
            newSearchParams.delete('fromInvitation');
            navigate(`/projects/${projectIdFromParams}/flows?${newSearchParams.toString()}`, { replace: true });
            return;
          } catch (retryError) {
            // Continue retrying
            if (attempt === maxRetries - 1) {
              // Last attempt failed, stop retrying
              setIsRetryingInvitation(false);
            }
          }
        }
      };
      
      retrySwitch();
    }
  }, [fromInvitation, failedToSwitchToProject, isRetryingInvitation, isLoading, isFetching, isRedirecting, projectIdFromParams, queryClient, searchParams, navigate]);
  
  // CRITICAL: If coming from invitation, ALWAYS show loading screen until project is valid
  // This prevents the error page from EVER showing while waiting for member to become visible
  // The member can take up to 60+ seconds to become visible due to transaction isolation
  useEffect(() => {
    if (fromInvitation && isProjectValid && !isLoading && !isFetching) {
      // Project is now valid, remove the fromInvitation param
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete('fromInvitation');
      navigate(`/projects/${projectIdFromParams}/flows?${newSearchParams.toString()}`, { replace: true });
    }
  }, [fromInvitation, isProjectValid, isLoading, isFetching, searchParams, navigate, projectIdFromParams]);
  
  // If coming from invitation, show loading until project becomes valid
  if (fromInvitation && (!isProjectValid || isLoading || isFetching)) {
    return <LoadingScreen></LoadingScreen>;
  }
  
  if (failedToSwitchToProject || (isError && !isProjectValid)) {
    // If we're retrying after invitation acceptance, show loading
    if (isRetryingInvitation) {
      return <LoadingScreen></LoadingScreen>;
    }
    
    // If we're still trying to redirect, show loading
    if (isRedirecting) {
      return <LoadingScreen></LoadingScreen>;
    }
    
    // Show project not found page
    // The useEffect will handle redirecting to other projects if available
    // If no other projects exist, this error page will be shown
    return <ProjectNotFoundPage />;
  }
  
  //TODO: after upgrading react, we should use (use) hook to trigger suspense instead of this
  if (isLoading || isFetching) {
    return <LoadingScreen></LoadingScreen>;
  }
  return <>{children}</>;
};

type RedirectToCurrentProjectRouteProps = {
  path: string;
  children: React.ReactNode;
};
const RedirectToCurrentProjectRoute: React.FC<
  RedirectToCurrentProjectRouteProps
> = ({ path }) => {
  const currentProjectId = authenticationSession.getProjectId();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const defaultRedirectPath = useDefaultRedirectPath();
  const from = searchParams.get(FROM_QUERY_PARAM) ?? defaultRedirectPath;
  if (isNil(currentProjectId)) {
    return (
      <Navigate
        to={`/sign-in?${new URLSearchParams({ from }).toString()}`}
        replace
      />
    );
  }

  const pathWithParams = `${path.startsWith('/') ? path : `/${path}`}`.replace(
    /:(\w+)/g,
    (_, param) => params[param] ?? '',
  );

  const searchParamsString = searchParams.toString();
  const pathWithParamsAndSearchParams = `${pathWithParams}${
    searchParamsString ? `?${searchParamsString}` : ''
  }`;
  return (
    <Navigate
      to={`/projects/${currentProjectId}${pathWithParamsAndSearchParams}`}
      replace
    />
  );
};

interface ProjectRouterWrapperProps {
  path: string;
  element: React.ReactNode;
}

export const ProjectRouterWrapper = ({
  element,
  path,
}: ProjectRouterWrapperProps) => [
  {
    path: `/projects/:projectId${path.startsWith('/') ? path : `/${path}`}`,
    element: (
      <AllowOnlyLoggedInUserOnlyGuard>
        <TokenCheckerWrapper>{element}</TokenCheckerWrapper>
      </AllowOnlyLoggedInUserOnlyGuard>
    ),
  },
  {
    path,
    element: (
      <AllowOnlyLoggedInUserOnlyGuard>
        <RedirectToCurrentProjectRoute path={path}>
          {element}
        </RedirectToCurrentProjectRoute>
      </AllowOnlyLoggedInUserOnlyGuard>
    ),
  },
];

export const projectSettingsRoutes = {
  pieces: '/settings/pieces',
  environments: '/settings/environments',
  ai: '/settings/ai',
} as const;
