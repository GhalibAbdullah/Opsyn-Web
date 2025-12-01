import { t } from 'i18next';
import { FileX, Home, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NotAvailablePageProps {
  title?: string;
  description?: string;
  showPlatformAdminLink?: boolean;
  platformAdminLinkText?: string;
  showHomeLink?: boolean;
  homeLinkText?: string;
}

export const NotAvailablePage: React.FC<NotAvailablePageProps> = ({
  title = 'Flow not available',
  description = "The flow you're looking for doesn't exist or was removed.",
  showPlatformAdminLink = true,
  platformAdminLinkText = 'Go to Platform Admin Settings',
  showHomeLink = false,
  homeLinkText = 'Go to Home',
}) => {

  return (
    <div className="flex flex-col items-center justify-center h-full text-center space-y-4 p-6">
      <div className="rounded-full bg-muted p-4">
        <FileX className="size-9 text-muted-foreground" />
      </div>

      <div>
        <h2 className="text-lg font-semibold">{t(title)}</h2>
        <p className="text-sm text-muted-foreground mt-2">
          {t(description)}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        {showHomeLink && (
          <Link
            to="/dashboard"
            className={cn('inline-flex items-center gap-2')}
          >
            <Button variant="default">
              <Home className="h-4 w-4 mr-2" />
              {t(homeLinkText)}
            </Button>
          </Link>
        )}
        {showPlatformAdminLink && (
          <Link
            to="/platform"
            className={cn('inline-flex items-center gap-2')}
          >
            <Button variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              {t(platformAdminLinkText)}
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
};

