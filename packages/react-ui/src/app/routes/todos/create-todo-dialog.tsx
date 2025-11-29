import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { t } from 'i18next';
import { Plus } from 'lucide-react';
import { useState } from 'react';

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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { todosHooks } from '@/features/todos/lib/todo-hook';
import { projectMembersHooks } from '@/features/team/lib/project-members-hooks';
import { userHooks } from '@/hooks/user-hooks';
import { useToast } from '@/components/ui/use-toast';
import { STATUS_VARIANT, StatusOption } from '@activepieces/shared';

const createTodoSchema = z.object({
  title: z.string().min(1, t('Title is required')),
  description: z.string().optional(),
  assigneeId: z.string().optional(),
  statusOptions: z.array(
    z.object({
      name: z.string(),
      description: z.string().optional().nullable(),
      variant: z.enum([
        STATUS_VARIANT.POSITIVE,
        STATUS_VARIANT.NEGATIVE,
        STATUS_VARIANT.NEUTRAL,
      ]),
      continueFlow: z.boolean(),
    })
  ).min(1, t('At least one status option is required')),
});

type CreateTodoFormValues = z.infer<typeof createTodoSchema>;

const DEFAULT_STATUS_OPTIONS: StatusOption[] = [
  {
    name: 'Accepted',
    description: 'Accepted',
    variant: STATUS_VARIANT.POSITIVE,
    continueFlow: true,
  },
  {
    name: 'Rejected',
    description: 'Rejected',
    variant: STATUS_VARIANT.NEGATIVE,
    continueFlow: true,
  },
];

export function CreateTodoDialog({ onSuccess }: { onSuccess?: () => void }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const { data: currentUser } = userHooks.useCurrentUser();
  const { projectMembers = [] } = projectMembersHooks.useProjectMembers();

  const form = useForm<CreateTodoFormValues>({
    resolver: zodResolver(createTodoSchema),
    defaultValues: {
      title: '',
      description: '',
      assigneeId: currentUser?.id,
      statusOptions: DEFAULT_STATUS_OPTIONS,
    },
  });

  const { mutate: createTodo, isPending } = todosHooks.useCreateTodo(() => {
    setOpen(false);
    form.reset({
      title: '',
      description: '',
      assigneeId: currentUser?.id,
      statusOptions: DEFAULT_STATUS_OPTIONS,
    });
    toast({
      title: t('Success'),
      description: t('Todo created successfully'),
    });
    onSuccess?.();
  });

  const assigneeOptions = [
    ...(currentUser
      ? [
          {
            label: `${currentUser.firstName} ${currentUser.lastName} (${currentUser.email})`,
            value: currentUser.id,
          },
        ]
      : []),
    ...(projectMembers || [])
      .filter((member) => member.user.email !== currentUser?.email)
      .map((member) => ({
        label: `${member.user.firstName} ${member.user.lastName} (${member.user.email})`,
        value: member.user.id,
      })),
  ];

  const onSubmit = (data: CreateTodoFormValues) => {
    createTodo({
      title: data.title,
      description: data.description || '',
      statusOptions: data.statusOptions,
      assigneeId: data.assigneeId,
      // flowId is optional for manual todos
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          {t('New Todo')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('Create Todo')}</DialogTitle>
          <DialogDescription>
            {t('Create a new todo item for your project')}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Title')}</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={t('Enter todo title')} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Description')}</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder={t('Enter todo description (optional)')}
                      rows={4}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Add details about what needs to be done')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="assigneeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Assignee')}</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('Select assignee')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {assigneeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {t('Who should handle this todo?')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="statusOptions"
              render={() => (
                <FormItem>
                  <FormLabel>{t('Status Options')}</FormLabel>
                  <FormDescription>
                    {t('Default status options: Accepted, Rejected')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                {t('Cancel')}
              </Button>
              <Button type="submit" loading={isPending}>
                {t('Create Todo')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

