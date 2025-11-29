import { t } from 'i18next';
import { useState } from 'react';
import { MessageSquare, Send, Info } from 'lucide-react';

import {
    LeftSideBarType,
    useBuilderStateContext,
} from '@/app/builder/builder-hooks';
import { CardList, CardListItemSkeleton } from '@/components/custom/card-list';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { flowCommentHooks } from '@/features/flows/lib/flow-comment-hooks';
import { flowStructureUtil, isNil } from '@activepieces/shared';

import { SidebarHeader } from '../sidebar-header';
import { FlowCommentItem } from './flow-comment-item';

const FlowCommentsList = () => {
    const [flow, setLeftSidebar, leftSidebar, selectedStep, flowVersion] = useBuilderStateContext(
        (state) => [state.flow, state.setLeftSidebar, state.leftSidebar, state.selectedStep, state.flowVersion],
    );

    const [newComment, setNewComment] = useState('');
    const [activeTab, setActiveTab] = useState<'workflow' | 'step'>('workflow');

    const isVisible = leftSidebar === LeftSideBarType.COMMENTS;
    const currentStepName = activeTab === 'step' && selectedStep ? selectedStep : null;
    
    // Get the step display name if a step is selected
    const selectedStepDisplayName = !isNil(selectedStep) && !isNil(flowVersion)
        ? (() => {
            try {
                const step = flowStructureUtil.getStep(selectedStep, flowVersion.trigger);
                return step?.displayName || step?.settings?.actionName || selectedStep;
            } catch {
                return selectedStep;
            }
        })()
        : null;

    const {
        data: workflowComments,
        isLoading: isLoadingWorkflow,
        isError: isErrorWorkflow,
    } = flowCommentHooks.useFlowComments(flow.id, {
        limit: 50,
        cursor: undefined,
        stepName: undefined,
        parentCommentId: undefined,
        enabled: isVisible && activeTab === 'workflow',
    });

    const {
        data: stepComments,
        isLoading: isLoadingStep,
        isError: isErrorStep,
    } = flowCommentHooks.useFlowComments(flow.id, {
        limit: 50,
        cursor: undefined,
        stepName: currentStepName ?? undefined,
        parentCommentId: undefined,
        enabled: isVisible && activeTab === 'step' && !!currentStepName,
    });

    const { mutate: createComment, isPending: isCreating } = flowCommentHooks.useCreateFlowComment();

    const handleCreateComment = () => {
        if (!newComment.trim()) return;
        createComment(
            {
                flowId: flow.id,
                request: {
                    flowId: flow.id,
                    content: newComment,
                    stepName: currentStepName ?? undefined,
                },
            },
            {
                onSuccess: () => {
                    setNewComment('');
                },
            },
        );
    };

    const comments = activeTab === 'workflow' ? workflowComments : stepComments;
    const isLoading = activeTab === 'workflow' ? isLoadingWorkflow : isLoadingStep;
    const isError = activeTab === 'workflow' ? isErrorWorkflow : isErrorStep;

    return (
        <>
            <SidebarHeader onClose={() => setLeftSidebar(LeftSideBarType.NONE)}>
                {t('Comments')}
            </SidebarHeader>
            <div className="flex flex-col h-full">
                <div className="p-4 border-b space-y-3">
                    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'workflow' | 'step')}>
                        <TabsList className="w-full">
                            <TabsTrigger value="workflow" className="flex-1">
                                {t('Workflow')}
                            </TabsTrigger>
                            <TabsTrigger value="step" className="flex-1" disabled={!selectedStep}>
                                {t('Step')} {selectedStepDisplayName && `(${selectedStepDisplayName})`}
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                    {activeTab === 'step' && !selectedStep && (
                        <Alert className="bg-muted">
                            <Info className="h-4 w-4" />
                            <AlertDescription className="text-xs">
                                {t('Select a step in the workflow to add step-specific comments')}
                            </AlertDescription>
                        </Alert>
                    )}
                    {activeTab === 'step' && selectedStepDisplayName && (
                        <div className="text-xs text-muted-foreground px-1">
                            {t('Commenting on step:')} <span className="font-medium">{selectedStepDisplayName}</span>
                        </div>
                    )}
                    <div className="space-y-2">
                        <Textarea
                            placeholder={
                                activeTab === 'step' && selectedStepDisplayName
                                    ? `${t('Add a comment about')} ${selectedStepDisplayName}...`
                                    : t('Add a comment...')
                            }
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            className="w-full min-h-[80px] resize-none"
                            disabled={activeTab === 'step' && !selectedStep}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                    e.preventDefault();
                                    handleCreateComment();
                                }
                            }}
                        />
                        <Button
                            onClick={handleCreateComment}
                            disabled={!newComment.trim() || isCreating || (activeTab === 'step' && !selectedStep)}
                            className="w-full"
                            size="sm"
                        >
                            <Send className="w-4 h-4 mr-2" />
                            {t('Comment')}
                        </Button>
                    </div>
                </div>
                <CardList className="flex-1">
                    {isLoading && <CardListItemSkeleton numberOfCards={5} />}
                    {isError && (
                        <div className="p-4 text-sm text-muted-foreground">
                            {t('Error loading comments. Please try again.')}
                        </div>
                    )}
                    {comments && comments.data && (
                        <ScrollArea className="w-full h-full">
                            {comments.data.length === 0 ? (
                                <div className="p-4 text-sm text-muted-foreground text-center">
                                    <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    {t('No comments yet. Be the first to comment!')}
                                </div>
                            ) : (
                                comments.data.map((comment) => (
                                    <FlowCommentItem key={comment.id} comment={comment} />
                                ))
                            )}
                        </ScrollArea>
                    )}
                </CardList>
            </div>
        </>
    );
};

FlowCommentsList.displayName = 'FlowCommentsList';

export { FlowCommentsList };

