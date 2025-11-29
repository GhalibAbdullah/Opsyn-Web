import {
  Project,
  ProjectWithLimits,
  ProjectPlan,
  ProjectUsage,
  PiecesFilterType,
} from '@activepieces/shared';

/**
 * Converts a basic Project to ProjectWithLimits with stub values for CE.
 * In Community Edition, we don't have plan/usage/analytics, so we provide defaults.
 */
export function projectToProjectWithLimits(project: Project): ProjectWithLimits {
  const stubPlan: ProjectPlan = {
    id: project.id,
    created: project.created,
    updated: project.updated,
    projectId: project.id,
    locked: false,
    name: 'Community',
    piecesFilterType: PiecesFilterType.NONE,
    pieces: [],
    aiCredits: null,
  };

  const stubUsage: ProjectUsage = {
    aiCredits: 0,
    nextLimitResetDate: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days from now
  };

  const stubAnalytics = {
    totalUsers: 0,
    activeUsers: 0,
    totalFlows: 0,
    activeFlows: 0,
  };

  return {
    ...project,
    plan: stubPlan,
    usage: stubUsage,
    analytics: stubAnalytics,
  };
}

