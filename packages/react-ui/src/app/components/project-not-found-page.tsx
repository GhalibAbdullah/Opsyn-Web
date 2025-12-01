import { t } from 'i18next';
import { FileX, Home, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ProjectNotFoundPageProps {
  showPlatformAdminLink?: boolean;
  platformAdminLinkText?: string;
  showHomeLink?: boolean;
  homeLinkText?: string;
}

export const ProjectNotFoundPage: React.FC<ProjectNotFoundPageProps> = ({
  showPlatformAdminLink = true,
  platformAdminLinkText = 'Go to Platform Admin Settings',
  showHomeLink = true,
  homeLinkText = 'Go to Dashboard',
}) => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center space-y-4 p-6 min-h-[60vh]">
      <div className="rounded-full bg-muted p-4">
        <FileX className="size-12 text-muted-foreground" />
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">{t('Project Not Found')}</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          {t("You don't have access to this project. You may have been removed from it.")}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mt-4">
        {showHomeLink && (
          <Link
            to="/dashboard"
            className={cn('inline-flex items-center gap-2')}
          >
            <Button variant="default" size="lg">
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
            <Button variant="outline" size="lg">
              <Settings className="h-4 w-4 mr-2" />
              {t(platformAdminLinkText)}
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
};

