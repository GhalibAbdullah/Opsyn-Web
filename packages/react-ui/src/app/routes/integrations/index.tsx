import { t } from 'i18next';
import { Grid3x3, List, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { DashboardPageHeader } from '@/app/components/dashboard-page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { appConnectionsQueries } from '@/features/connections/lib/app-connections-hooks';
import { piecesHooks } from '@/features/pieces/lib/pieces-hooks';
import { authenticationSession } from '@/lib/authentication-session';
import { AppConnectionStatus, PieceCategory } from '@activepieces/shared';
import { PieceMetadataModelSummary } from '@activepieces/pieces-framework';

import { IntegrationCard } from './integration-card';

type FilterStatus = 'all' | 'connected' | 'not_connected';
type ViewMode = 'grid' | 'list';

function IntegrationsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  
  const projectId = authenticationSession.getProjectId()!;

  // Fetch all available pieces
  const { pieces, isLoading: piecesLoading } = piecesHooks.usePieces({});

  // Fetch user's connections
  const {
    data: connectionsData,
    isLoading: connectionsLoading,
    refetch: refetchConnections,
  } = appConnectionsQueries.useAppConnections({
    request: {
      projectId,
      limit: 1000, // Get all connections
      status: [AppConnectionStatus.ACTIVE],
    },
    extraKeys: [projectId],
  });

  const connections = connectionsData?.data || [];
  const isLoading = piecesLoading || connectionsLoading;

  // Extract unique categories from pieces
  const categories = useMemo(() => {
    if (!pieces) return [];
    const categorySet = new Set<string>();
    pieces.forEach((piece) => {
      piece.categories?.forEach((cat) => categorySet.add(cat));
    });
    return Array.from(categorySet).sort();
  }, [pieces]);

  // Filter pieces based on search, status, and category
  const filteredPieces = useMemo(() => {
    if (!pieces) return [];

    return pieces.filter((piece) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          piece.displayName.toLowerCase().includes(query) ||
          piece.name.toLowerCase().includes(query) ||
          piece.description?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Status filter
      const pieceConnections = connections.filter(c => c.pieceName === piece.name);
      const isConnected = pieceConnections.length > 0;
      
      if (statusFilter === 'connected' && !isConnected) return false;
      if (statusFilter === 'not_connected' && isConnected) return false;

      // Category filter
      if (categoryFilter !== 'all') {
        if (!piece.categories?.includes(categoryFilter as PieceCategory)) return false;
      }

      return true;
    });
  }, [pieces, connections, searchQuery, statusFilter, categoryFilter]);

  const connectedCount = useMemo(() => {
    if (!pieces) return 0;
    return pieces.filter(piece => 
      connections.some(c => c.pieceName === piece.name)
    ).length;
  }, [pieces, connections]);

  return (
    <div className="flex flex-col h-full w-full">
      <DashboardPageHeader
        title={t('Integrations')}
        description={t('Connect and manage your app integrations')}
      >
        <div className="flex items-center gap-2">
          <div className="text-sm text-muted-foreground">
            {connectedCount} {t('of')} {pieces?.length || 0} {t('connected')}
          </div>
        </div>
      </DashboardPageHeader>

      <div className="flex flex-col gap-4 p-4">
        {/* Filters Section */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('Search integrations...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as FilterStatus)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('All Status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('All Status')}</SelectItem>
                <SelectItem value="connected">{t('Connected')}</SelectItem>
                <SelectItem value="not_connected">{t('Not Connected')}</SelectItem>
              </SelectContent>
            </Select>

            {/* Category Filter */}
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('All Categories')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('All Categories')}</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex gap-1 border rounded-md p-1">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <Grid3x3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Results Count */}
        <div className="text-sm text-muted-foreground">
          {isLoading ? (
            <Skeleton className="h-4 w-32" />
          ) : (
            <>
              {t('Showing {{count}} integration(s)', { count: filteredPieces.length })}
            </>
          )}
        </div>

        {/* Integrations Grid/List */}
        {isLoading ? (
          <div className={viewMode === 'grid' ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'flex flex-col gap-4'}>
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-64 w-full" />
            ))}
          </div>
        ) : filteredPieces.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">
              {searchQuery || statusFilter !== 'all' || categoryFilter !== 'all'
                ? t('No integrations found matching your filters')
                : t('No integrations available')}
            </p>
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'flex flex-col gap-4'}>
            {filteredPieces.map((piece) => (
              <IntegrationCard
                key={piece.name}
                piece={piece}
                connections={connections}
                onConnectionCreated={refetchConnections}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

IntegrationsPage.displayName = 'IntegrationsPage';
export default IntegrationsPage;

