import { typeboxResolver } from '@hookform/resolvers/typebox';
import { Type } from '@sinclair/typebox';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { t } from 'i18next';
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Form, FormField, FormItem } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { PiecesFilterType } from '@activepieces/shared';

import { MultiSelectPieceProperty } from '../../../../components/custom/multi-select-piece-property';
import { piecesHooks } from '../../../../features/pieces/lib/pieces-hooks';
import { authenticationSession } from '../../../../lib/authentication-session';
import { projectApi } from '../../../../lib/project-api';

type ManagePiecesDialogProps = {
  onSuccess: () => void;
};

export const ManagePiecesDialog = React.memo(
  ({ onSuccess }: ManagePiecesDialogProps) => {
    const [open, setOpen] = useState(false);
    const { pieces: visiblePieces, isLoading: isLoadingVisiblePieces, refetch: refetchVisiblePieces } =
      piecesHooks.usePieces({ searchQuery: '', includeHidden: false });
    
    const form = useForm<{
      pieces: string[];
    }>({
      resolver: typeboxResolver(
        Type.Object({
          pieces: Type.Array(Type.String()),
        }),
      ),
      defaultValues: {
        pieces: [],
      },
    });

    // Only reset form when dialog opens, not when loading state changes
    useEffect(() => {
      if (open && !isLoadingVisiblePieces && visiblePieces) {
        form.setValue(
          'pieces',
          (visiblePieces ?? []).map((p) => p.name),
        );
      }
    }, [open, isLoadingVisiblePieces, visiblePieces]);

    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { pieces: allPieces, isLoading: isLoadingAllPieces } =
      piecesHooks.usePieces({ searchQuery: '', includeHidden: true });

    const { mutate, isPending } = useMutation({
      mutationFn: () => {
        const pieces = form.getValues().pieces;
        const projectId = authenticationSession.getProjectId()!;
        const requestBody = {
          plan: {
            piecesFilterType: PiecesFilterType.ALLOWED,
            pieces: pieces ?? [],
          },
        };
        console.log('[ManagePiecesDialog] Saving pieces:', {
          projectId,
          piecesCount: pieces.length,
          pieces: pieces.slice(0, 10),
          piecesFilterType: PiecesFilterType.ALLOWED,
        });
        // Always send pieces array, even if empty, to ensure it's saved
        return projectApi.update(projectId, requestBody);
      },
      onSuccess: async () => {
        // Invalidate pieces query cache to force refetch with updated filter
        await queryClient.invalidateQueries({ queryKey: ['pieces'] });
        // Also invalidate pieces-metadata cache used by flow builder
        await queryClient.invalidateQueries({ queryKey: ['pieces-metadata'] });
        // Also invalidate steps metadata cache used by flow builder piece selector
        await queryClient.invalidateQueries({ queryKey: ['steps-metadata'] });
        // Also invalidate current project query to refresh project data
        await queryClient.invalidateQueries({ queryKey: ['current-project'] });
        // Refetch visible pieces to ensure form shows updated list when reopened
        await refetchVisiblePieces();
        onSuccess();
        toast({
          title: t('Success'),
          description: t('Pieces list updated'),
        });
        setOpen(false);
      },
    });

    return (
      <Dialog open={open} onOpenChange={(open) => setOpen(open)}>
        <DialogTrigger asChild>
          <Button variant="default" className="flex gap-2 items-center">
            {t('Manage Pieces')}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Manage Pieces')}</DialogTitle>
            <DialogDescription>
              {t(
                'Choose which pieces you want to be available for your current project users',
              )}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              className="flex flex-col gap-4 mb-4"
              onSubmit={(e) => form.handleSubmit(() => mutate())(e)}
            >
              <FormField
                name="pieces"
                render={({ field }) => (
                  <FormItem className="grid space-y-2">
                    <Label htmlFor="pieces">{t('Pieces')}</Label>
                    <MultiSelectPieceProperty
                      placeholder={t('Pieces')}
                      options={
                        allPieces?.map((piece) => ({
                          value: piece.name,
                          label: piece.displayName,
                        })) ?? []
                      }
                      loading={isLoadingAllPieces || isLoadingVisiblePieces}
                      onChange={(e) => {
                        field.onChange(e);
                      }}
                      initialValues={field.value}
                      showDeselect={field.value.length > 0}
                    ></MultiSelectPieceProperty>
                  </FormItem>
                )}
              />
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
  },
);
ManagePiecesDialog.displayName = 'ManagePiecesDialog';
