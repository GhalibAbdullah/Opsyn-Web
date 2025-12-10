import {
  ListUserInvitationsRequest,
  SeekPage,
  SendUserInvitationRequest,
  UserInvitation,
  UserInvitationWithLink,
} from '@activepieces/shared';

import { api } from '../../../lib/api';

export const userInvitationApi = {
  invite: (request: SendUserInvitationRequest) => {
    return api.post<UserInvitationWithLink>('/v1/user-invitations', request);
  },
  list: (request: ListUserInvitationsRequest) => {
    return api.get<SeekPage<UserInvitation>>('/v1/user-invitations', request);
  },
  delete(id: string): Promise<void> {
    return api.delete<void>(`/v1/user-invitations/${id}`);
  },
  accept(token: string, email?: string, projectId?: string): Promise<{ registered: boolean; platformId?: string; projectId?: string }> {
    // Include email and projectId in query params for idempotent checking
    const queryParams = new URLSearchParams();
    if (email) queryParams.set('email', email);
    if (projectId) queryParams.set('projectId', projectId);
    const queryString = queryParams.toString();
    const url = `/v1/user-invitations/accept${queryString ? `?${queryString}` : ''}`;
    return api.post<{ registered: boolean; platformId?: string; projectId?: string }>(url, {
      invitationToken: token,
    });
  },
};
