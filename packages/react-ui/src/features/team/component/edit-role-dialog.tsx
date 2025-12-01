import { useMutation, useQuery } from '@tanstack/react-query';
import { t } from 'i18next';
import { Pencil } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { projectRoleApi } from '@/features/platform-admin/lib/project-role-api';
import { ProjectMemberWithUser } from '@/lib/project-member-types';

import { projectMembersApi } from '../lib/project-members-api';

interface EditRoleDialogProps {
  member: ProjectMemberWithUser;
  onSave: () => void;
  disabled: boolean;
}

export function EditRoleDialog({
  member,
  onSave,
  disabled,
}: EditRoleDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const initialRole = (member.projectRole?.name ?? member.role) as 'OWNER' | 'EDITOR' | 'VIEWER';
  const [selectedRole, setSelectedRole] = useState<'OWNER' | 'EDITOR' | 'VIEWER'>(initialRole);
  // For Community Edition, use simple roles
  const simpleRoles: ('OWNER' | 'EDITOR' | 'VIEWER')[] = ['OWNER', 'EDITOR', 'VIEWER'];
  const { data: rolesData } = useQuery({
    queryKey: ['project-roles'],
    queryFn: () => projectRoleApi.list(),
    enabled: false, // Disable for Community Edition - we'll use simple roles
  });

  // Use simple roles for Community Edition, or Enterprise roles if available
  const roles = rolesData?.data && rolesData.data.length > 0 
    ? rolesData.data 
    : simpleRoles.map(name => ({ name }));

  const { mutate, isPending } = useMutation({
    mutationFn: (newRole: 'OWNER' | 'EDITOR' | 'VIEWER') => {
      return projectMembersApi.update(member.id, {
        role: newRole,
      });
    },
    onSuccess: () => {
      toast({
        title: t('Role updated successfully'),
      });
      onSave();
      setIsOpen(false);
    },
    onError: () => {
      toast({
        title: t('Error updating role'),
        description: t('Please try again later'),
      });
    },
  });

  const handleRoleChange = (newRole: string) => {
    if (simpleRoles.includes(newRole as 'OWNER' | 'EDITOR' | 'VIEWER')) {
      setSelectedRole(newRole as 'OWNER' | 'EDITOR' | 'VIEWER');
    }
  };

  const handleSave = () => {
    mutate(selectedRole);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="size-8 p-0" disabled={disabled}>
          <Pencil className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t('Edit Role for')} {member.user.firstName} {member.user.lastName}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-2">
          <Select onValueChange={handleRoleChange} defaultValue={selectedRole}>
            <SelectTrigger>
              <SelectValue placeholder={t('Select Role')} />
            </SelectTrigger>
            <SelectContent>
              {roles.map((role) => (
                <SelectItem key={role.name} value={role.name}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} loading={isPending}>
            {t('Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
