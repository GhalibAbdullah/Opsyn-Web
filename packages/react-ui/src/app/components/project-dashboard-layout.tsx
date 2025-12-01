import React, { createContext, useContext, useState } from 'react';
import { Navigate } from 'react-router-dom';

import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar-shadcn';
import { LoadingScreen } from '@/components/ui/loading-screen';
import { PurchaseExtraFlowsDialog } from '@/features/billing/components/active-flows-addon/purchase-active-flows-dialog';
import { projectHooks } from '@/hooks/project-hooks';
import { isNil, ProjectWithLimits } from '@activepieces/shared';

import { authenticationSession } from '../../lib/authentication-session';

import { ProjectDashboardSidebar } from './sidebar/dashboard';

const ProjectChangedRedirector = ({
  currentProjectId,
  children,
}: {
  currentProjectId: string;
  children: React.ReactNode;
}) => {
  projectHooks.useReloadPageIfProjectIdChanged(currentProjectId);
  return children;
};

export const CloseTaskLimitAlertContext = createContext({
  isAlertClosed: false,
  setIsAlertClosed: (_isAlertClosed: boolean) => {},
});

export const ProjectContext = createContext<ProjectWithLimits | null>(null);

export const useProject = (): ProjectWithLimits => {
  const project = useContext(ProjectContext);
  if (!project) {
    throw new Error('useProject must be used within ProjectDashboardLayout');
  }
  return project;
};

export function ProjectDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isAlertClosed, setIsAlertClosed] = useState(false);
  const currentProjectId = authenticationSession.getProjectId();
  const { project, isLoading } = projectHooks.useCurrentProject();

  if (isNil(currentProjectId) || currentProjectId === '') {
    return <Navigate to="/sign-in" replace />;
  }

  if (isLoading || !project) {
    return <LoadingScreen />;
  }

  return (
    <ProjectContext.Provider value={project}>
      <ProjectChangedRedirector currentProjectId={currentProjectId}>
        <CloseTaskLimitAlertContext.Provider
          value={{
            isAlertClosed,
            setIsAlertClosed,
          }}
        >
          <SidebarProvider>
            <ProjectDashboardSidebar />
            <SidebarInset className={`relative overflow-auto px-4 pb-4`}>
              {children}
            </SidebarInset>
          </SidebarProvider>
          <PurchaseExtraFlowsDialog />
        </CloseTaskLimitAlertContext.Provider>
      </ProjectChangedRedirector>
    </ProjectContext.Provider>
  );
}
