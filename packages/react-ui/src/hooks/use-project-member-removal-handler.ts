import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSocket } from '@/components/socket-provider';
import { WebsocketClientEvent } from '@activepieces/shared';
import { authenticationSession } from '@/lib/authentication-session';
import { projectApi } from '@/lib/project-api';
import { projectMembersApi } from '@/features/team/lib/project-members-api';
import { useQueryClient } from '@tanstack/react-query';

type ProjectMembersChanged = {
  projectId: string;
};

/**
 * Hook to handle when a user is removed from a project.
 * Listens to PROJECT_MEMBERS_CHANGED WebSocket event and redirects the user
 * if they were removed from the current project.
 */
export const useProjectMemberRemovalHandler = () => {
  const socket = useSocket();
  const navigate = useNavigate();
  const params = useParams();
  const queryClient = useQueryClient();
  const currentProjectId = params.projectId || authenticationSession.getProjectId();

  useEffect(() => {
    if (!currentProjectId || !socket.connected) {
      return;
    }

    const handleProjectMembersChanged = async (data: ProjectMembersChanged) => {
      // Only handle if it's for the current project
      if (data.projectId !== currentProjectId) {
        return;
      }

      // Check if user still has access to this project
      try {
        // Try to verify access by checking project members
        const members = await projectMembersApi.list({ projectId: currentProjectId });
        const currentUserId = authenticationSession.getCurrentUserId();
        
        // Check if current user is still a member
        const isStillMember = members.data?.some(
          (member: any) => member.user?.id === currentUserId
        );

        if (!isStillMember) {
          // User was removed from project - redirect them
          console.log('User removed from project, redirecting...');
          
          // Invalidate all project-related queries
          queryClient.invalidateQueries();
          
          // All users have access to their own platform admin settings
          // Check if user has any other projects
          try {
            const projects = await projectApi.list({ limit: 1 });
            if (projects.data && projects.data.length > 0) {
              // Switch to first available project
              await authenticationSession.switchToProject(projects.data[0].id);
              navigate(`/projects/${projects.data[0].id}/flows`, { replace: true });
            } else {
              // No projects - don't redirect, let the error page show
              // The error page will have a link to platform admin
              // The TokenCheckerWrapper will handle showing the error page
            }
          } catch (error) {
            // If we can't fetch projects, don't redirect - let the error page show
            // The error page will have a link to platform admin
          }
        }
      } catch (error: any) {
        // If we get a 403 or 404, user was definitely removed
        if (error?.response?.status === 403 || error?.response?.status === 404) {
          console.log('User lost access to project (403/404), redirecting...');
          
          // Invalidate all project-related queries
          queryClient.invalidateQueries();
          
          // All users have access to their own platform admin settings
          // Check if user has any other projects
          try {
            const projects = await projectApi.list({ limit: 1 });
            if (projects.data && projects.data.length > 0) {
              // Switch to first available project
              await authenticationSession.switchToProject(projects.data[0].id);
              navigate(`/projects/${projects.data[0].id}/flows`, { replace: true });
            } else {
              // No projects - redirect to dashboard (create your first project page)
              navigate('/dashboard', { replace: true });
            }
          } catch (listError) {
            // If we can't fetch projects, redirect to platform admin (user's own settings)
            navigate('/platform', { replace: true });
          }
        }
      }
    };

    socket.on(WebsocketClientEvent.PROJECT_MEMBERS_CHANGED, handleProjectMembersChanged);

    return () => {
      socket.off(WebsocketClientEvent.PROJECT_MEMBERS_CHANGED, handleProjectMembersChanged);
    };
  }, [socket, currentProjectId, navigate, queryClient]);
};

