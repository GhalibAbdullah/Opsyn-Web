import { Static, Type } from '@sinclair/typebox'
import { BaseModelSchema } from '../common/base-model'


export const AnalyticsPieceReportItem = Type.Object({
    name: Type.String(),        
    displayName: Type.String(),
    logoUrl: Type.String(),
    usageCount: Type.Number(),
})
export type AnalyticsPieceReportItem = Static<typeof AnalyticsPieceReportItem>

export const AnalyticsPieceReport = Type.Array(AnalyticsPieceReportItem)
export type AnalyticsPieceReport = Static<typeof AnalyticsPieceReport>

export const AnalyticsProjectReportItem = Type.Object({
    id: Type.String(),
    displayName: Type.String(),
    activeFlows: Type.Number(),
    totalFlows: Type.Number(),
})
export type AnalyticsProjectReportItem = Static<typeof AnalyticsProjectReportItem>

export const AnalyticsProjectReport = Type.Array(AnalyticsProjectReportItem)
export type AnalyticsProjectReport = Static<typeof AnalyticsProjectReport>

export const AnalyticsRunsUsageItem = Type.Object({
    day: Type.String(),
    totalRuns: Type.Number(),
})
export type AnalyticsRunsUsageItem = Static<typeof AnalyticsRunsUsageItem>

export const AnalyticsRunsUsage = Type.Array(AnalyticsRunsUsageItem)
export type AnalyticsRunsUsage = Static<typeof AnalyticsRunsUsage>

export const PlatformAnalyticsReport = Type.Object({
    ...BaseModelSchema,
    totalFlows: Type.Number(),
    activeFlows: Type.Number(),
    totalUsers: Type.Number(),
    activeUsers: Type.Number(),
    totalProjects: Type.Number(),
    activeProjects: Type.Number(),
    uniquePiecesUsed: Type.Number(),
    activeFlowsWithAI: Type.Number(),
    topPieces: AnalyticsPieceReport,
    topProjects: AnalyticsProjectReport,
    runsUsage: AnalyticsRunsUsage,
    platformId: Type.String(),
})
export type PlatformAnalyticsReport = Static<typeof PlatformAnalyticsReport>

export const FlowAnalyticsRunsOverTimeItem = Type.Object({
    day: Type.String(),
    totalRuns: Type.Number(),
    successfulRuns: Type.Number(),
    failedRuns: Type.Number(),
    averageExecutionTime: Type.Optional(Type.Number()),
})
export type FlowAnalyticsRunsOverTimeItem = Static<typeof FlowAnalyticsRunsOverTimeItem>

export const FlowAnalyticsRunsOverTime = Type.Array(FlowAnalyticsRunsOverTimeItem)
export type FlowAnalyticsRunsOverTime = Static<typeof FlowAnalyticsRunsOverTime>

export const FlowAnalytics = Type.Object({
    flowId: Type.String(),
    totalRuns: Type.Number(),
    successfulRuns: Type.Number(),
    failedRuns: Type.Number(),
    successRate: Type.Number(),
    failureRate: Type.Number(),
    averageExecutionTime: Type.Optional(Type.Number()),
    runsOverTime: FlowAnalyticsRunsOverTime,
    latestRun: Type.Optional(Type.Any()), // FlowRun type - using Any to avoid circular dependency
})
export type FlowAnalytics = Static<typeof FlowAnalytics>