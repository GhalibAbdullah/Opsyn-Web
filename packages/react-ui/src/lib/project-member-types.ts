import { UserWithMetaInformation, Project } from '@activepieces/shared';

/**
 * CE version of ProjectMemberWithUser.
 * In Community Edition, we define this locally instead of importing from EE.
 * This matches the backend ProjectMemberWithUser type from project-member.service.ts
 */
export type ProjectMemberWithUser = {
  id: string;
  created: string;
  updated: string;
  projectId: string;
  platformId: string;
  userId: string;
  role: 'OWNER' | 'EDITOR' | 'VIEWER';
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    platformId: string;
    platformRole: string;
    status: string;
    externalId: string | null;
    created: string;
    updated: string;
  };
  // Optional: project may be included in some responses
  project?: Project;
  // For compatibility with EE code that expects projectRole.name
  // In CE, we map role to a simple object
  projectRole?: {
    name: string;
  };
};

