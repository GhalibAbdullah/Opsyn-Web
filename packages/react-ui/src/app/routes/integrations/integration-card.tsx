import { t } from 'i18next';
import { CheckCircle2, Plus } from 'lucide-react';
import { useState } from 'react';

import { CreateOrEditConnectionDialog } from '@/app/connections/create-edit-connection-dialog';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import PieceIconWithPieceName from '@/features/pieces/components/piece-icon-from-name';
import { AppConnectionWithoutSensitiveData } from '@activepieces/shared';
import { PieceMetadataModelSummary } from '@activepieces/pieces-framework';

type IntegrationCardProps = {
  piece: PieceMetadataModelSummary;
  connections: AppConnectionWithoutSensitiveData[];
  onConnectionCreated: () => void;
};

export function IntegrationCard({ piece, connections, onConnectionCreated }: IntegrationCardProps) {
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);
  
  const pieceConnections = connections.filter(c => c.pieceName === piece.name);
  const isConnected = pieceConnections.length > 0;
  const connectionCount = pieceConnections.length;
  const hasAuth = !!piece.auth;

  return (
    <>
      <Card className="flex flex-col h-full hover:shadow-lg transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <PieceIconWithPieceName
                pieceName={piece.name}
                showTooltip={false}
                size="lg"
              />
              <div>
                <CardTitle className="text-base">{piece.displayName}</CardTitle>
                {isConnected && (
                  <div className="flex items-center gap-1 mt-1">
                    <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
                    <span className="text-xs text-muted-foreground">
                      {connectionCount} {connectionCount === 1 ? t('connection') : t('connections')}
                    </span>
                  </div>
                )}
              </div>
            </div>
            {isConnected && (
              <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                {t('Connected')}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pb-3 flex-1">
          <CardDescription className="text-sm line-clamp-2">
            {piece.description || piece.displayName}
          </CardDescription>
          {piece.categories && piece.categories.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {piece.categories.slice(0, 2).map((category: string) => (
                <Badge key={category} variant="outline" className="text-xs">
                  {category}
                </Badge>
              ))}
              {piece.categories.length > 2 && (
                <Badge variant="outline" className="text-xs">
                  +{piece.categories.length - 2}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="pt-0">
          {hasAuth ? (
            <Button
              className="w-full"
              variant={isConnected ? 'outline' : 'default'}
              onClick={() => setShowConnectionDialog(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              {isConnected ? t('Add Another Connection') : t('Connect')}
            </Button>
          ) : (
            <Button
              className="w-full"
              variant="outline"
              disabled
              title={t('This integration does not require a connection')}
            >
              {t('No Connection Required')}
            </Button>
          )}
        </CardFooter>
      </Card>

      {showConnectionDialog && hasAuth && (
        <CreateOrEditConnectionDialog
          piece={piece}
          reconnectConnection={null}
          open={showConnectionDialog}
          isGlobalConnection={false}
          setOpen={(open, connection) => {
            setShowConnectionDialog(open);
            if (connection) {
              onConnectionCreated();
            }
          }}
        />
      )}
    </>
  );
}

