import { t } from 'i18next'
import { History, User, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useMemo, useState } from 'react'

import {
    LeftSideBarType,
    useBuilderStateContext,
} from '@/app/builder/builder-hooks'
import { CardList, CardListItemSkeleton } from '@/components/custom/card-list'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { flowActivityHooks } from '@/features/flows/lib/flow-activity-hooks'
import { FlowActivityAction } from '@activepieces/shared'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { SidebarHeader } from '../sidebar-header'

const FlowActivityList = () => {
    const [flow, setLeftSidebar, leftSidebar] = useBuilderStateContext(
        (state) => [state.flow, state.setLeftSidebar, state.leftSidebar],
    )

    const isVisible = leftSidebar === LeftSideBarType.ACTIVITY
    const [activeCategory, setActiveCategory] = useState<'all' | 'steps' | 'flow'>('all')

    const {
        data: activitiesData,
        isLoading,
        isError,
    } = flowActivityHooks.useFlowActivities(flow.id, {
        limit: 50,
        cursor: undefined,
    })

    const allActivities = activitiesData?.data || []
    
    // Categorize activities
    const categorizedActivities = useMemo(() => {
        if (activeCategory === 'all') return allActivities
        if (activeCategory === 'steps') {
            return allActivities.filter(a => 
                a.actionType === FlowActivityAction.STEP_ADDED ||
                a.actionType === FlowActivityAction.STEP_REMOVED ||
                a.actionType === FlowActivityAction.STEP_UPDATED
            )
        }
        if (activeCategory === 'flow') {
            return allActivities.filter(a => 
                a.actionType === FlowActivityAction.CREATED ||
                a.actionType === FlowActivityAction.UPDATED ||
                a.actionType === FlowActivityAction.DELETED ||
                a.actionType === FlowActivityAction.PUBLISHED ||
                a.actionType === FlowActivityAction.UNPUBLISHED ||
                a.actionType === FlowActivityAction.STATUS_CHANGED ||
                a.actionType === FlowActivityAction.NAME_CHANGED
            )
        }
        return allActivities
    }, [allActivities, activeCategory])

    const getActionLabel = (actionType: string, metadata?: unknown) => {
        const meta = metadata as Record<string, unknown> | null | undefined
        
        switch (actionType) {
            case FlowActivityAction.CREATED:
                return t('created')
            case FlowActivityAction.UPDATED:
                return t('updated')
            case FlowActivityAction.DELETED:
                return t('deleted')
            case FlowActivityAction.PUBLISHED:
                return t('published')
            case FlowActivityAction.UNPUBLISHED:
                return t('unpublished')
            case FlowActivityAction.STATUS_CHANGED:
                return t('changed status')
            case FlowActivityAction.NAME_CHANGED:
                return t('renamed')
            case FlowActivityAction.STEP_ADDED:
                // Check if it's a duplicate operation
                if (meta?.operation === 'DUPLICATE') {
                    return t('duplicated step')
                }
                return t('added step')
            case FlowActivityAction.STEP_REMOVED:
                return t('removed step')
            case FlowActivityAction.STEP_UPDATED:
                // Check if it's a replacement
                if (meta?.replaced) {
                    return t('replaced step')
                }
                return t('updated step')
            default:
                return actionType.toLowerCase()
        }
    }

    const getActionIcon = (actionType: string, metadata?: unknown) => {
        const meta = metadata as Record<string, unknown> | null | undefined
        
        switch (actionType) {
            case FlowActivityAction.CREATED:
                return '✨'
            case FlowActivityAction.UPDATED:
                return '✏️'
            case FlowActivityAction.DELETED:
                return '🗑️'
            case FlowActivityAction.PUBLISHED:
                return '🚀'
            case FlowActivityAction.STATUS_CHANGED:
                return '🔄'
            case FlowActivityAction.NAME_CHANGED:
                return '🏷️'
            case FlowActivityAction.STEP_ADDED:
                // Use copy icon for duplicates
                if (meta?.operation === 'DUPLICATE') {
                    return '📋'
                }
                return '➕'
            case FlowActivityAction.STEP_REMOVED:
                return '➖'
            case FlowActivityAction.STEP_UPDATED:
                // Use swap icon for replacements
                if (meta?.replaced) {
                    return '🔀'
                }
                return '🔧'
            default:
                return '📝'
        }
    }
    
    const getStepDisplayInfo = (metadata: unknown): { stepName?: string; stepType?: string; displayName?: string } | null => {
        if (!metadata || typeof metadata !== 'object' || metadata === null) {
            return null
        }
        
        const meta = metadata as Record<string, unknown>
        return {
            stepName: typeof meta.stepName === 'string' ? meta.stepName : undefined,
            stepType: typeof meta.stepType === 'string' ? meta.stepType : undefined,
            displayName: typeof meta.displayName === 'string' ? meta.displayName : undefined,
        }
    }

    if (!isVisible) {
        return null
    }

    return (
        <div className="flex flex-col h-full">
            <SidebarHeader onClose={() => setLeftSidebar(LeftSideBarType.NONE)}>
                <div className="flex items-center gap-2">
                    <History className="w-5 h-5" />
                    {t('Activity')}
                </div>
            </SidebarHeader>

            <ScrollArea className="flex-1">
                {isLoading && (
                    <div className="space-y-4 px-4 py-4">
                        {[1, 2, 3].map((i) => (
                            <CardListItemSkeleton key={i} />
                        ))}
                    </div>
                )}

                {isError && (
                    <div className="text-center py-8 text-muted-foreground px-4">
                        {t('Failed to load activity')}
                    </div>
                )}

                {!isLoading && !isError && allActivities.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground px-4">
                        {t('No activity yet')}
                    </div>
                )}

                {!isLoading && !isError && allActivities.length > 0 && (
                    <div className="flex flex-col h-full">
                        <div className="px-4 pt-4 border-b">
                            <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as 'all' | 'steps' | 'flow')}>
                                <TabsList className="grid w-full grid-cols-3">
                                    <TabsTrigger value="all">{t('All')}</TabsTrigger>
                                    <TabsTrigger value="steps">{t('Steps')}</TabsTrigger>
                                    <TabsTrigger value="flow">{t('Flow')}</TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>
                        <div className="flex-1 overflow-auto px-4">
                            {categorizedActivities.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    {t('No activity in this category')}
                                </div>
                            ) : (
                                <div className="space-y-3 py-4">
                                    {categorizedActivities.map((activity) => {
                            const stepInfo = getStepDisplayInfo(activity.metadata)
                            const metadata = activity.metadata as Record<string, unknown> | null | undefined
                            
                            return (
                                <div
                                    key={activity.id}
                                    className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                                >
                                    <div className="text-xl mt-0.5">
                                        {getActionIcon(activity.actionType, activity.metadata)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <Badge 
                                                variant="outline" 
                                                className="text-xs font-medium"
                                            >
                                                {getActionLabel(activity.actionType, activity.metadata)}
                                            </Badge>
                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {formatDistanceToNow(
                                                    new Date(activity.created),
                                                    { addSuffix: true },
                                                )}
                                            </span>
                                        </div>
                                        
                                        {/* Show step/flow details with position */}
                                        {(stepInfo?.displayName || metadata?.displayName) ? (
                                            <div className="text-sm font-medium mb-1.5 text-foreground">
                                                {metadata && 'stepPosition' in metadata && typeof metadata.stepPosition === 'number' ? (
                                                    <span className="text-muted-foreground mr-1">
                                                        Step {metadata.stepPosition}:
                                                    </span>
                                                ) : null}
                                                {stepInfo?.displayName || String(metadata?.displayName || '')}
                                            </div>
                                        ) : null}
                                        
                                        {/* Show step type for step operations */}
                                        {(activity.actionType === FlowActivityAction.STEP_ADDED ||
                                          activity.actionType === FlowActivityAction.STEP_UPDATED ||
                                          activity.actionType === FlowActivityAction.STEP_REMOVED) && 
                                         stepInfo?.stepType && 
                                         typeof stepInfo.stepType === 'string' ? (
                                            <div className="text-xs text-muted-foreground mb-1">
                                                Type: {stepInfo.stepType}
                                            </div>
                                        ) : null}
                                        
                                        {/* Show replacement info */}
                                        {activity.actionType === FlowActivityAction.STEP_UPDATED &&
                                         metadata && 
                                         typeof metadata === 'object' &&
                                         'replaced' in metadata &&
                                         metadata.replaced && 
                                         'oldStepType' in metadata && 
                                         'oldDisplayName' in metadata ? (
                                            <div className="text-xs text-amber-600 dark:text-amber-400 mb-1 font-medium">
                                                Replaced "{String(metadata.oldDisplayName)}" ({String(metadata.oldStepType)}) 
                                                <br />
                                                → "{String(metadata.displayName)}" ({String(metadata.newStepType || metadata.stepType)})
                                            </div>
                                        ) : null}
                                        
                                        {/* Show source step for duplicates */}
                                        {activity.actionType === FlowActivityAction.STEP_ADDED &&
                                         metadata && 
                                         typeof metadata === 'object' &&
                                         'operation' in metadata &&
                                         metadata.operation === 'DUPLICATE' &&
                                         'sourceStepName' in metadata ? (
                                            <div className="text-xs text-muted-foreground mb-1">
                                                From: {String(metadata.sourceStepName)}
                                            </div>
                                        ) : null}
                                        
                                        {/* Show step names for deleted actions */}
                                        {activity.actionType === FlowActivityAction.STEP_REMOVED && 
                                         metadata && 
                                         typeof metadata === 'object' &&
                                         'stepNames' in metadata &&
                                         Array.isArray(metadata.stepNames) && 
                                         metadata.stepNames.length > 0 && (
                                            <div className="text-xs text-muted-foreground mb-1">
                                                {metadata.stepNames.length === 1 
                                                    ? `Step: ${String(metadata.stepNames[0])}`
                                                    : `Steps: ${metadata.stepNames.map(s => String(s)).join(', ')}`}
                                            </div>
                                        )}
                                        
                                        {/* Show old/new name for rename */}
                                        {activity.actionType === FlowActivityAction.NAME_CHANGED && 
                                         metadata && 
                                         typeof metadata === 'object' &&
                                         'oldDisplayName' in metadata &&
                                         typeof metadata.oldDisplayName === 'string' && (
                                            <div className="text-xs text-muted-foreground mb-1">
                                                From: {metadata.oldDisplayName}
                                            </div>
                                        )}
                                        
                                        {/* Show status change */}
                                        {activity.actionType === FlowActivityAction.STATUS_CHANGED && 
                                         metadata && 
                                         typeof metadata === 'object' &&
                                         'status' in metadata && (
                                            <div className="text-xs text-muted-foreground mb-1">
                                                Status: {String(metadata.status)}
                                            </div>
                                        )}
                                        
                                        {/* Show user */}
                                        {activity.user && (
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1.5">
                                                <User className="w-3 h-3" />
                                                <span>
                                                    {activity.user.firstName}{' '}
                                                    {activity.user.lastName}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                    )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </ScrollArea>
        </div>
    )
}

FlowActivityList.displayName = 'FlowActivityList'

export { FlowActivityList }

