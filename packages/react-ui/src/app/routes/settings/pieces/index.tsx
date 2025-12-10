import { ColumnDef } from '@tanstack/react-table';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { t } from 'i18next';
import { CheckIcon, Package, Trash, RotateCcw } from 'lucide-react';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { DashboardPageHeader } from '@/app/components/dashboard-page-header';
import { RequestTrial } from '@/app/components/request-trial';
import { ConfirmationDeleteDialog } from '@/components/delete-dialog';
import { Button } from '@/components/ui/button';
import {
  DataTable,
  RowDataWithActions,
} from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table/data-table-column-header';
import { LockedAlert } from '@/components/ui/locked-alert';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { PieceIcon } from '@/features/pieces/components/piece-icon';
import { piecesApi } from '@/features/pieces/lib/pieces-api';
import { piecesHooks } from '@/features/pieces/lib/pieces-hooks';
import { flowsHooks } from '@/features/flows/lib/flows-hooks';
import { platformHooks } from '@/hooks/platform-hooks';
import { projectHooks } from '@/hooks/project-hooks';
import { userHooks } from '@/hooks/user-hooks';
import { authenticationSession } from '@/lib/authentication-session';
import { projectApi } from '@/lib/project-api';
import { PieceMetadataModelSummary } from '@activepieces/pieces-framework';
import { isNil, PieceType, PiecesFilterType } from '@activepieces/shared';

const ProjectPiecesPage = () => {
  const { platform } = platformHooks.useCurrentPlatform();
  const { project, refetch: refetchProject } = projectHooks.useCurrentProject();
  const { data: currentUser } = userHooks.useCurrentUser();
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('name') ?? '';
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Get all pieces (including disabled ones) for the toggle UI
  // We use includeHidden: true to show all pieces so users can enable/disable them
  const { pieces: allPieces, isLoading, refetch } = piecesHooks.usePieces({
    searchQuery,
    includeHidden: true, // Show all pieces so we can enable/disable them
  });

  // Allow project owners to manage pieces even without enterprise feature
  const isProjectOwner = project?.ownerId === currentUser?.id;
  const canManagePieces = platform.plan.managePiecesEnabled || isProjectOwner;

  // Get enabled pieces from project plan
  const enabledPieces = useMemo(() => {
    // Default: all pieces are enabled when plan doesn't exist or filter type is NONE
    const allPieceNames = new Set(allPieces?.map(p => p.name) || []);
    
    if (!project?.plan) {
      console.log('[EnabledPieces] No plan exists, all pieces enabled:', allPieceNames.size);
      return allPieceNames;
    }
    
    // If filter type is NONE, all pieces are enabled
    if (project.plan.piecesFilterType === PiecesFilterType.NONE) {
      console.log('[EnabledPieces] Filter type is NONE, all pieces enabled:', allPieceNames.size);
      return allPieceNames;
    }
    
    // If filter type is ALLOWED, only pieces in the array are enabled
    const allowedPieces = new Set(project.plan.pieces || []);
    console.log('[EnabledPieces] Filter type is ALLOWED, enabled pieces:', {
      allowedCount: allowedPieces.size,
      totalPieces: allPieceNames.size,
      allowedPieces: Array.from(allowedPieces).slice(0, 10),
    });
    return allowedPieces;
  }, [project?.plan, allPieces]);

  // Check if we're in ALLOWED mode (pieces are being filtered)
  const isFilteringActive = project?.plan?.piecesFilterType === PiecesFilterType.ALLOWED;

  // Reset all pieces to enabled (set filter type to NONE)
  const resetAllPiecesMutation = useMutation({
    mutationFn: async () => {
      const projectId = authenticationSession.getProjectId()!;
      console.log('[ResetAllPieces] Resetting to NONE (all pieces enabled)');
      
      await projectApi.update(projectId, {
        plan: {
          piecesFilterType: PiecesFilterType.NONE,
          pieces: [],
        },
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['pieces'] });
      await queryClient.invalidateQueries({ queryKey: ['pieces-metadata'] });
      await queryClient.invalidateQueries({ queryKey: ['steps-metadata'] });
      await queryClient.invalidateQueries({ queryKey: ['current-project'] });
      flowsHooks.invalidateFlowsQuery(queryClient);
      await refetchProject();
      await refetch();
      
      toast({
        title: t('Success'),
        description: t('All pieces have been enabled'),
      });
    },
    onError: (error) => {
      toast({
        title: t('Error'),
        description: error instanceof Error ? error.message : t('Failed to reset pieces'),
        variant: 'destructive',
      });
    },
  });

  // Enable all pieces (set all pieces to enabled in ALLOWED mode)
  const enableAllPiecesMutation = useMutation({
    mutationFn: async () => {
      const projectId = authenticationSession.getProjectId()!;
      const allPieceNames = allPieces?.map(p => p.name) || [];
      console.log('[EnableAllPieces] Enabling all pieces:', allPieceNames.length);
      
      await projectApi.update(projectId, {
        plan: {
          piecesFilterType: PiecesFilterType.ALLOWED,
          pieces: allPieceNames,
        },
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['pieces'] });
      await queryClient.invalidateQueries({ queryKey: ['pieces-metadata'] });
      await queryClient.invalidateQueries({ queryKey: ['steps-metadata'] });
      await queryClient.invalidateQueries({ queryKey: ['current-project'] });
      flowsHooks.invalidateFlowsQuery(queryClient);
      await refetchProject();
      await refetch();
      
      toast({
        title: t('Success'),
        description: t('All pieces have been enabled'),
      });
    },
    onError: (error) => {
      toast({
        title: t('Error'),
        description: error instanceof Error ? error.message : t('Failed to enable all pieces'),
        variant: 'destructive',
      });
    },
  });

  const togglePieceMutation = useMutation({
    mutationFn: async ({ pieceName, enabled }: { pieceName: string; enabled: boolean }) => {
      const projectId = authenticationSession.getProjectId()!;
      
      // Get current state - if NONE, all pieces are enabled
      let currentEnabled: string[];
      if (!project?.plan || project.plan.piecesFilterType === PiecesFilterType.NONE) {
        // If currently NONE (all enabled), start with all pieces
        currentEnabled = allPieces?.map(p => p.name) || [];
      } else {
        // If already ALLOWED, use the current list
        currentEnabled = project.plan.pieces || [];
      }
      
      let newEnabledPieces: string[];
      if (enabled) {
        // Add piece to enabled list (avoid duplicates)
        if (!currentEnabled.includes(pieceName)) {
          newEnabledPieces = [...currentEnabled, pieceName];
        } else {
          newEnabledPieces = currentEnabled;
        }
      } else {
        // Remove piece from enabled list
        newEnabledPieces = currentEnabled.filter(name => name !== pieceName);
      }

      console.log('[TogglePiece] Updating:', {
        projectId,
        pieceName,
        enabled,
        currentFilterType: project?.plan?.piecesFilterType,
        currentEnabledCount: currentEnabled.length,
        newEnabledCount: newEnabledPieces.length,
        newEnabledPieces: newEnabledPieces.slice(0, 10),
      });

      // Always set filter type to ALLOWED when managing pieces
      await projectApi.update(projectId, {
        plan: {
          piecesFilterType: PiecesFilterType.ALLOWED,
          pieces: newEnabledPieces,
        },
      });
    },
    onSuccess: async (data, variables) => {
      // Invalidate all relevant caches first
      await queryClient.invalidateQueries({ queryKey: ['pieces'] });
      await queryClient.invalidateQueries({ queryKey: ['pieces-metadata'] });
      await queryClient.invalidateQueries({ queryKey: ['steps-metadata'] });
      await queryClient.invalidateQueries({ queryKey: ['current-project'] });
      
      // Invalidate flows to force flow builder to re-render with updated piece status
      flowsHooks.invalidateFlowsQuery(queryClient);
      
      // Refetch project to get updated plan - wait for it to complete
      const updatedProject = await refetchProject();
      console.log('[TogglePiece] After update:', {
        pieceName: variables.pieceName,
        enabled: variables.enabled,
        updatedPlan: updatedProject.data?.plan,
        piecesFilterType: updatedProject.data?.plan?.piecesFilterType,
        piecesCount: updatedProject.data?.plan?.pieces?.length,
        pieces: updatedProject.data?.plan?.pieces?.slice(0, 10),
      });
      
      // Refetch pieces list
      await refetch();
      
      toast({
        title: t('Success'),
        description: t('Piece updated successfully'),
      });
    },
    onError: (error) => {
      toast({
        title: t('Error'),
        description: error instanceof Error ? error.message : t('Failed to update piece'),
        variant: 'destructive',
      });
    },
  });

  const columns: ColumnDef<RowDataWithActions<PieceMetadataModelSummary>>[] = useMemo(() => {
    const baseColumns: ColumnDef<RowDataWithActions<PieceMetadataModelSummary>>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t('App')} />
    ),
    cell: ({ row }) => {
      return (
        <div className="text-left">
          <PieceIcon
            circle={true}
            size={'md'}
            border={true}
            displayName={row.original.displayName}
            logoUrl={row.original.logoUrl}
            showTooltip={false}
          />
        </div>
      );
    },
  },
  {
    accessorKey: 'displayName',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t('Display Name')} />
    ),
    cell: ({ row }) => {
      return <div className="text-left">{row.original.displayName}</div>;
    },
  },
  {
    accessorKey: 'packageName',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t('Package Name')} />
    ),
    cell: ({ row }) => {
      return <div className="text-left">{row.original.name}</div>;
    },
  },
  {
    accessorKey: 'version',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t('Version')} />
    ),
    cell: ({ row }) => {
      return <div className="text-left">{row.original.version}</div>;
    },
  },
    ];

    if (canManagePieces) {
      baseColumns.push({
        accessorKey: 'enabled',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('Enabled')} />
        ),
        cell: ({ row }) => {
          const pieceName = row.original.name;
          const isEnabled = enabledPieces.has(pieceName);
          const isPending = togglePieceMutation.isPending;
          
          return (
            <div className="flex items-center justify-center">
              <Switch
                checked={isEnabled}
                onCheckedChange={(checked) => {
                  togglePieceMutation.mutate({ pieceName, enabled: checked });
                }}
                disabled={isPending}
              />
            </div>
          );
        },
      });
    }

    baseColumns.push({
    accessorKey: 'actions',
    header: ({ column }) => <DataTableColumnHeader column={column} title="" />,
    cell: ({ row }) => {
      if (
        row.original.pieceType === PieceType.CUSTOM &&
        !isNil(row.original.projectId)
      ) {
        return (
          <ConfirmationDeleteDialog
            title={t('Delete {name}', { name: row.original.name })}
            entityName={t('Piece')}
            message={t(
              'This will permanently delete this piece, all steps using it will fail.',
            )}
            mutationFn={async () => {
              row.original.delete();
              await piecesApi.delete(row.original.id!);
            }}
          >
            <div className="flex items-end justify-end">
              <Button variant="ghost" className="size-8 p-0">
                <Trash className="size-4 text-destructive" />
              </Button>
            </div>
          </ConfirmationDeleteDialog>
        );
      }
      return null;
    },
    });

    return baseColumns;
  }, [canManagePieces, enabledPieces, togglePieceMutation]);

  // Count enabled pieces
  const enabledCount = enabledPieces.size;
  const totalCount = allPieces?.length || 0;
  const disabledCount = totalCount - enabledCount;

  return (
    <div className="w-fullj flex-col">
      <DashboardPageHeader
        title={t('Pieces')}
        description={t('Enable or disable pieces for your project')}
      >
        {canManagePieces && (
          <div className="flex items-center gap-2">
            {isFilteringActive && (
              <span className="text-sm text-muted-foreground">
                {t('{{enabled}} of {{total}} enabled', { enabled: enabledCount, total: totalCount })}
              </span>
            )}
            {isFilteringActive && disabledCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => enableAllPiecesMutation.mutate()}
                disabled={enableAllPiecesMutation.isPending || resetAllPiecesMutation.isPending}
              >
                {t('Enable All')}
              </Button>
            )}
            {isFilteringActive && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => resetAllPiecesMutation.mutate()}
                disabled={resetAllPiecesMutation.isPending || enableAllPiecesMutation.isPending}
              >
                <RotateCcw className="size-4 mr-2" />
                {t('Reset Filters')}
              </Button>
            )}
          </div>
        )}
      </DashboardPageHeader>
      {!canManagePieces && (
        <LockedAlert
          title={t('Control Pieces')}
          description={t(
            "Show the pieces that matter most to your users and hide the ones you don't like.",
          )}
          button={
            <RequestTrial
              featureKey="ENTERPRISE_PIECES"
              buttonVariant="outline-primary"
            />
          }
        />
      )}
      <DataTable
        emptyStateTextTitle={t('No pieces found')}
        emptyStateTextDescription={t(
          'Add a piece to your project that you want to use in your automations',
        )}
        emptyStateIcon={<Package className="size-14" />}
        columns={columns}
        filters={[
          {
            type: 'input',
            title: t('Piece Name'),
            accessorKey: 'name',
            icon: CheckIcon,
          },
        ]}
        page={{
          data: allPieces ?? [],
          next: null,
          previous: null,
        }}
        isLoading={isLoading}
        hidePagination={true}
      />
    </div>
  );
};

ProjectPiecesPage.displayName = 'ProjectPiecesPage';
export { ProjectPiecesPage };
