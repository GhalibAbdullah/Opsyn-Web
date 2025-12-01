import React from 'react';
import { Navigate } from 'react-router-dom';

import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar-shadcn';
import { PurchaseExtraFlowsDialog } from '@/features/billing/components/active-flows-addon/purchase-active-flows-dialog';
import { flagsHooks } from '@/hooks/flags-hooks';
import { ApEdition, ApFlagId } from '@activepieces/shared';

import { AllowOnlyLoggedInUserOnlyGuard } from './allow-logged-in-user-only-guard';
import { PlatformSidebar } from './sidebar/platform';

export function PlatformLayout({ children }: { children: React.ReactNode }) {
  const { data: edition } = flagsHooks.useFlag<ApEdition>(ApFlagId.EDITION);

  // Allow all logged-in users to access platform settings
  // No admin restriction - every user has full control
  return (
    <AllowOnlyLoggedInUserOnlyGuard>
      <SidebarProvider>
        <PlatformSidebar />
        <SidebarInset className="px-4 overflow-auto pb-4">
          {children}
        </SidebarInset>
      </SidebarProvider>
      {edition === ApEdition.CLOUD && <PurchaseExtraFlowsDialog />}
    </AllowOnlyLoggedInUserOnlyGuard>
  );
}
