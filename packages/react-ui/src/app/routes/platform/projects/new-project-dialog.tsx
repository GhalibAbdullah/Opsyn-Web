import { typeboxResolver } from '@hookform/resolvers/typebox';
import { Type } from '@sinclair/typebox';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { t } from 'i18next';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Form, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { projectApi } from '@/lib/project-api';
import { CreatePlatformProjectRequest } from '@activepieces/ee-shared';
import { ProjectWithLimits } from '@activepieces/shared';

type NewProjectDialogProps = {
  children: React.ReactNode;
  onCreate?: (project?: ProjectWithLimits) => void;
};

export const NewProjectDialog = ({
  children,
  onCreate,
}: NewProjectDialogProps) => {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const form = useForm<CreatePlatformProjectRequest>({
    resolver: typeboxResolver(
      Type.Object({
        displayName: Type.String({
          minLength: 1,
          errorMessage: t('Name is required'),
        }),
      }),
    ),
    defaultValues: {
      displayName: '',
    },
  });

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      form.reset({ displayName: '' });
    }
  }, [open, form]);

  const { mutate, isPending } = useMutation({
    mutationKey: ['create-project'],
    mutationFn: () => projectApi.create(form.getValues()),
    onSuccess: async (createdProject) => {
      try {
        // Invalidate all project-related queries to ensure the new project appears
        // Using exact: false (default) to invalidate all queries that start with these keys
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['projects'] }),
          queryClient.invalidateQueries({ queryKey: ['projects-for-platforms'] }),
        ]);
        setOpen(false);
        form.reset({ displayName: '' });
        onCreate?.(createdProject);
      } catch (error) {
        console.error('Error invalidating queries:', error);
        // Still close dialog and call onCreate even if invalidation fails
      setOpen(false);
        form.reset({ displayName: '' });
        onCreate?.(createdProject);
      }
    },
    onError: (error) => {
      console.error('Error creating project:', error);
      form.setError('root.serverError', {
        message: t('Failed to create project. Please try again.'),
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(open) => setOpen(open)}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('Create New Project')}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            className="grid space-y-4"
            onSubmit={(e) => form.handleSubmit(() => mutate())(e)}
          >
            <FormField
              name="displayName"
              render={({ field }) => (
                <FormItem className="grid space-y-2">
                  <Label htmlFor="displayName">{t('Project Name')}</Label>
                  <Input
                    {...field}
                    id="displayName"
                    placeholder={t('Project Name')}
                    className="rounded-sm"
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            {form?.formState?.errors?.root?.serverError && (
              <FormMessage>
                {form.formState.errors.root.serverError.message}
              </FormMessage>
            )}
          </form>
        </Form>
        <DialogFooter>
          <Button
            variant={'outline'}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setOpen(false);
            }}
          >
            {t('Cancel')}
          </Button>
          <Button
            disabled={isPending}
            loading={isPending}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              form.handleSubmit(() => mutate())(e);
            }}
          >
            {t('Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
