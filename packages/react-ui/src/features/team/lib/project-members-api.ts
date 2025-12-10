import { api } from '@/lib/api';
import { ProjectMemberWithUser } from '@/lib/project-member-types';
import { SeekPage } from '@activepieces/shared';

type ListProjectMembersRequest = {
  projectId: string;
  cursor?: string;
  limit?: number;
};

type UpdateProjectMemberRoleRequest = {
  role: 'OWNER' | 'EDITOR' | 'VIEWER';
};

export const projectMembersApi = {
  list(request: ListProjectMembersRequest) {
    return api.get<SeekPage<ProjectMemberWithUser>>(
      '/v1/project-members',
      request,
    );
  },
  update(memberId: string, request: UpdateProjectMemberRoleRequest) {
    return api.post<void>(`/v1/project-members/${memberId}`, request);
  },
  delete(id: string): Promise<void> {
    return api.delete<void>(`/v1/project-members/${id}`);
  },
  leaveCurrentProject(): Promise<void> {
    return api.delete<void>('/v1/project-members/self');
  },
};
