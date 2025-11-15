import { Static, Type } from '@sinclair/typebox';
import { t } from 'i18next';
import React from 'react';
import { useFormContext } from 'react-hook-form';

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { SecretTextProperty } from '@activepieces/pieces-framework';
import { UpsertSecretTextRequest } from '@activepieces/shared';

type SecretTextConnectionSettingsProps = {
  authProperty: SecretTextProperty<boolean>;
};

const SecretTextConnectionSettings = React.memo(
  ({ authProperty }: SecretTextConnectionSettingsProps) => {
    const formSchema = Type.Object({
      request: UpsertSecretTextRequest,
    });

    const form = useFormContext<Static<typeof formSchema>>();

    return (
      <FormField
        name="request.value.secret_text"
        control={form.control}
        render={({ field }) => (
          <FormItem className="flex flex-col">
            <FormLabel>
              {authProperty.displayName}
              {authProperty.required && (
                <span className="text-destructive ml-1">*</span>
              )}
            </FormLabel>
            <FormControl>
              <Input
                {...field}
                type="password"
                placeholder={
                  authProperty.description
                    ? undefined
                    : t('Enter your API key')
                }
              />
            </FormControl>
            {authProperty.description && (
              <FormDescription>{authProperty.description}</FormDescription>
            )}
            <FormMessage />
          </FormItem>
        )}
      ></FormField>
    );
  },
);

SecretTextConnectionSettings.displayName = 'SecretTextConnectionSettings';
export { SecretTextConnectionSettings };
