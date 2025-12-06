import { useMutation, useQuery } from '@tanstack/react-query';
import { t } from 'i18next';

import { DashboardPageHeader } from '@/app/components/dashboard-page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { aiProviderApi } from '@/features/platform-admin/lib/ai-provider-api';
import { flagsHooks } from '@/hooks/flags-hooks';
import { SUPPORTED_AI_PROVIDERS } from '@activepieces/common-ai';
import { ApFlagId, ApEdition } from '@activepieces/shared';

import { AIProviderCard } from './universal-pieces/ai-provider-card';

export default function AIProvidersPage() {
  const {
    data: providers,
    refetch,
    isLoading,
  } = useQuery({
    queryKey: ['ai-providers'],
    queryFn: () => aiProviderApi.list(),
  });
  const { data: flags } = flagsHooks.useFlags();
  // Allow all users to write - no restrictions
  const allowWrite = true;
  const edition = flags?.[ApFlagId.EDITION];

  const { mutate: deleteProvider, isPending: isDeleting } = useMutation({
    mutationFn: (provider: string) => aiProviderApi.delete(provider),
    onSuccess: () => {
      refetch();
    },
  });

  // Allow all users to configure AI providers - no admin restriction
  return (
    <div className="flex flex-col w-full gap-4">
      <DashboardPageHeader
        title={t('AI Providers')}
        description={
          allowWrite
            ? t(
                'Set provider credentials that will be used by universal AI pieces, i.e Text AI. These settings are project-specific.',
              )
            : t(
                'Available AI providers that will be used by universal AI pieces, i.e Text AI.',
              )
        }
      ></DashboardPageHeader>
      <div className="flex flex-col gap-4">
        {SUPPORTED_AI_PROVIDERS.map((metadata) => {
          const isConfigured =
            providers?.data.some((p) => p.provider === metadata.provider) ??
            false;
          const showAzureOpenAI =
            metadata.provider === 'openai' &&
            edition === ApEdition.ENTERPRISE;

          return isLoading ? (
            <Skeleton key={metadata.provider} className="h-24 w-full" />
          ) : (
            <AIProviderCard
              key={metadata.provider}
              providerMetadata={metadata}
              isConfigured={isConfigured}
              isDeleting={isDeleting}
              onDelete={() => deleteProvider(metadata.provider)}
              onSave={() => refetch()}
              allowWrite={allowWrite}
              showAzureOpenAI={showAzureOpenAI}
            />
          );
        })}
      </div>
    </div>
  );
}

