import { t } from 'i18next';
import { MessageCircle, MoreVertical, Pencil, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import React, { useState } from 'react';

import { useEmbedding } from '@/components/embed-provider';
import { CardListItem } from '@/components/custom/card-list';
import { UserAvatar } from '@/components/ui/user-avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { formatUtils } from '@/lib/utils';
import { FlowCommentWithUser } from '@activepieces/shared';
import { flowCommentHooks } from '@/features/flows/lib/flow-comment-hooks';
import { useBuilderStateContext } from '@/app/builder/builder-hooks';

interface FlowCommentItemProps {
    comment: FlowCommentWithUser;
    onReply?: (parentCommentId: string) => void;
    onEdit?: (commentId: string, content: string) => void;
    isReply?: boolean;
}

export const FlowCommentItem = React.memo(({ comment, onReply, onEdit, isReply = false }: FlowCommentItemProps) => {
    const { flow } = useBuilderStateContext((state) => ({ flow: state.flow }));
    const showAvatar = !useEmbedding().embedState.isEmbedded;
    const user = comment.user;
    const userName = user
        ? `${user.firstName} ${user.lastName}`.trim() || user.email
        : t('System');
    const userEmail = user?.email;
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(comment.content);
    const [showReplyForm, setShowReplyForm] = useState(false);
    const [replyContent, setReplyContent] = useState('');
    const [repliesExpanded, setRepliesExpanded] = useState(true);

    const { mutate: updateComment, isPending: isUpdating } = flowCommentHooks.useUpdateFlowComment();
    const { mutate: deleteComment, isPending: isDeleting } = flowCommentHooks.useDeleteFlowComment();
    const { mutate: createComment } = flowCommentHooks.useCreateFlowComment();

    // Fetch replies for top-level comments
    const { data: repliesData } = flowCommentHooks.useFlowComments(
        flow.id,
        {
            limit: 50,
            cursor: undefined,
            stepName: comment.stepName ?? undefined,
            parentCommentId: !isReply ? comment.id : undefined,
            enabled: !isReply, // Only fetch replies for top-level comments
        }
    );

    const replies = repliesData?.data || [];

    const handleUpdate = () => {
        updateComment(
            {
                flowId: flow.id,
                commentId: comment.id,
                request: { content: editContent },
            },
            {
                onSuccess: () => {
                    setIsEditing(false);
                },
            },
        );
    };

    const handleDelete = () => {
        if (confirm(t('Are you sure you want to delete this comment?'))) {
            deleteComment({
                flowId: flow.id,
                commentId: comment.id,
            });
        }
    };

    const handleReply = () => {
        if (!replyContent.trim()) return;
        createComment(
            {
                flowId: flow.id,
                request: {
                    flowId: flow.id,
                    content: replyContent,
                    stepName: comment.stepName ?? undefined,
                    parentCommentId: comment.id,
                },
            },
            {
                onSuccess: () => {
                    setReplyContent('');
                    setShowReplyForm(false);
                },
            },
        );
    };

    const isOwner = user && userEmail; // TODO: Check actual ownership/permissions

    return (
        <>
            <CardListItem interactive={false} className={`py-3 ${isReply ? 'ml-6 border-l-2 pl-3' : ''}`}>
                {showAvatar && user && userEmail && (
                    <UserAvatar
                        size={28}
                        name={userName}
                        email={userEmail}
                    />
                )}
                <div className="grid gap-2 flex-1">
                    <div className="flex items-start gap-2">
                        <MessageCircle className="w-4 h-4 text-muted-foreground mt-0.5" />
                        <div className="flex-1">
                            {isEditing ? (
                                <div className="space-y-2">
                                    <textarea
                                        className="w-full min-h-[60px] p-2 text-sm border rounded-md resize-none"
                                        value={editContent}
                                        onChange={(e) => setEditContent(e.target.value)}
                                        placeholder={t('Edit comment...')}
                                    />
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            onClick={handleUpdate}
                                            disabled={isUpdating || !editContent.trim()}
                                        >
                                            {t('Save')}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                                setIsEditing(false);
                                                setEditContent(comment.content);
                                            }}
                                        >
                                            {t('Cancel')}
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{comment.content}</p>
                                    {comment.stepName && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {t('On step:')} {comment.stepName}
                                        </p>
                                    )}
                                </>
                            )}
                        </div>
                        {isOwner && !isEditing && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                        <MoreVertical className="w-4 h-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => setIsEditing(true)}>
                                        <Pencil className="w-4 h-4 mr-2" />
                                        {t('Edit')}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={handleDelete} disabled={isDeleting}>
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        {t('Delete')}
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{userName}</span>
                        <span>•</span>
                        <span>{formatUtils.formatDateToAgo(new Date(comment.created))}</span>
                        {!isReply && (
                            <>
                                <span>•</span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-auto p-0 text-xs"
                                    onClick={() => setShowReplyForm(!showReplyForm)}
                                >
                                    {t('Reply')}
                                </Button>
                                {replies.length > 0 && (
                                    <>
                                        <span>•</span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-auto p-0 text-xs flex items-center gap-1"
                                            onClick={() => setRepliesExpanded(!repliesExpanded)}
                                        >
                                            {repliesExpanded ? (
                                                <>
                                                    <ChevronUp className="w-3 h-3" />
                                                    {t('Hide')} {replies.length} {replies.length === 1 ? t('reply') : t('replies')}
                                                </>
                                            ) : (
                                                <>
                                                    <ChevronDown className="w-3 h-3" />
                                                    {t('Show')} {replies.length} {replies.length === 1 ? t('reply') : t('replies')}
                                                </>
                                            )}
                                        </Button>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                    {showReplyForm && !isReply && (
                        <div className="ml-6 space-y-2 border-l-2 pl-3">
                            <textarea
                                className="w-full min-h-[60px] p-2 text-sm border rounded-md resize-none"
                                value={replyContent}
                                onChange={(e) => setReplyContent(e.target.value)}
                                placeholder={t('Write a reply...')}
                            />
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    onClick={handleReply}
                                    disabled={!replyContent.trim()}
                                >
                                    {t('Reply')}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                        setShowReplyForm(false);
                                        setReplyContent('');
                                    }}
                                >
                                    {t('Cancel')}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </CardListItem>
            {/* Render replies nested */}
            {!isReply && replies.length > 0 && repliesExpanded && (
                <div className="mt-2 space-y-2">
                    {replies.map((reply) => (
                        <FlowCommentItem
                            key={reply.id}
                            comment={reply}
                            isReply={true}
                        />
                    ))}
                </div>
            )}
        </>
    );
});

FlowCommentItem.displayName = 'FlowCommentItem';

