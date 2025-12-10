import { t } from 'i18next';
import { LogOut, Trash } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

import { PermissionNeededTooltip } from '@/components/custom/permission-needed-tooltip';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useAuthorization } from '@/hooks/authorization-hooks';
import { projectHooks } from '@/hooks/project-hooks';
import { ProjectMemberWithUser } from '@/lib/project-member-types';
import { authenticationSession } from '@/lib/authentication-session';
import { projectApi } from '@/lib/project-api';
import { Permission } from '@activepieces/shared';

import { ConfirmationDeleteDialog } from '../../../components/delete-dialog';
import { Button } from '../../../components/ui/button';
import { projectMembersApi } from '../lib/project-members-api';
import { projectMembersHooks } from '../lib/project-members-hooks';

import { EditRoleDialog } from './edit-role-dialog';

type ProjectMemberCardProps = {
  member: ProjectMemberWithUser;
  onUpdate: () => void;
};

export function ProjectMemberCard({
  member,
  onUpdate,
}: ProjectMemberCardProps) {
  const { refetch } = projectMembersHooks.useProjectMembers();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { checkAccess } = useAuthorization();
  const userHasPermissionToRemoveMember = checkAccess(
    Permission.WRITE_PROJECT_MEMBER,
  );
  const { project } = projectHooks.useCurrentProject();
  const currentUserId = authenticationSession.getCurrentUserId();
  const isCurrentUser = member.user.id === currentUserId;
  const isOwner = project?.ownerId === member.userId;

  const deleteMember = async () => {
    await projectMembersApi.delete(member.id);
    refetch();
    onUpdate();
  };

  const leaveProject = async () => {
    // Delete current user's membership on the backend via self-service endpoint
    await projectMembersApi.leaveCurrentProject();

    // Clear cached project data so lists refresh without this project
    await queryClient.invalidateQueries({ queryKey: ['projects'], exact: false });
    await queryClient.invalidateQueries({
      queryKey: ['current-project'],
      exact: false,
    });

    // Always take the user to a project-less dashboard view
    navigate('/dashboard', { replace: true });
  };

  return (
    <div
      className="w-full flex items-center justify-between space-x-4"
      key={member.id}
    >
      <div className="flex items-center space-x-4">
        <UserAvatar
          name={member.user.firstName + ' ' + member.user.lastName}
          email={member.user.email}
          size={32}
          disableTooltip={true}
        ></UserAvatar>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium leading-none">
            {member.user.firstName} {member.user.lastName} (
            {project?.ownerId === member.userId ? 'OWNER' : (member.projectRole?.name ?? member.role)})
          </p>
          <p className="text-sm text-muted-foreground">{member.user.email}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {/* Admin actions for managing OTHER members (cannot act on owner) */}
        {!isOwner && !isCurrentUser && (
          <PermissionNeededTooltip
            hasPermission={userHasPermissionToRemoveMember}
          >
            <EditRoleDialog
              member={member}
              onSave={() => {
                refetch();
              }}
              disabled={!userHasPermissionToRemoveMember}
            />
            <ConfirmationDeleteDialog
              title={`${t('Remove')} ${member.user.firstName} ${
                member.user.lastName
              }`}
              message={t('Are you sure you want to remove this member?')}
              mutationFn={() => deleteMember()}
              entityName={`${member.user.firstName} ${member.user.lastName}`}
            >
              <Button
                disabled={!userHasPermissionToRemoveMember}
                variant="ghost"
                className="size-8 p-0"
              >
                <Trash className="text-destructive size-4" />
              </Button>
            </ConfirmationDeleteDialog>
          </PermissionNeededTooltip>
        )}

        {/* Self-service "Leave project" for non-owners viewing themselves */}
        {!isOwner && isCurrentUser && (
          <ConfirmationDeleteDialog
            title={t('Leave project')}
            message={t(
              'Are you sure you want to leave this project? You will lose access until you are invited again.',
            )}
            mutationFn={leaveProject}
            entityName={project?.displayName ?? t('this project')}
          >
            <Button variant="ghost" className="size-8 p-0 text-destructive">
              <LogOut className="size-4" />
            </Button>
          </ConfirmationDeleteDialog>
        )}
      </div>
    </div>
  );
}
