import { t } from 'i18next';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

type BlockingOverlayProps = {
  blocked: boolean;
  message?: string;
  className?: string;
};

export function BlockingOverlay({
  blocked,
  message,
  className,
}: BlockingOverlayProps) {
  if (!blocked) {
    return null;
  }

  return (
    <div
      className={cn(
        'absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm',
        className,
      )}
    >
      <div className="flex flex-col items-center gap-3 rounded-lg border bg-card p-6 shadow-lg">
        <Lock className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">
          {message ||
            t('You do not have permission to perform this action')}
        </p>
      </div>
    </div>
  );
}

