import type { Reaction } from './reactions';
import type { ReactNode } from 'react';
import { FeedPost, type CommentDto, type FeedPostDto } from './FeedPost';

interface FeedListProps {
    posts: FeedPostDto[];
    openComments: Record<number, boolean>;
    commentsData: Record<number, CommentDto[]>;
    onReactionChange?: (postId: number, reaction: Reaction | null) => void | Promise<void>;
    onLikeToggle: (postId: number) => void | Promise<void>;
    onToggleComments: (postId: number) => void;
    onSubmitComment: (postId: number, content: string) => void | Promise<void>;
    onSelectPost: (post: FeedPostDto) => void;
    pendingLikes?: Record<number, boolean>;
    likeErrors?: Record<number, string | null>;
    commentsErrors?: Record<number, string | null>;
    onRetryComments?: (postId: number) => void;
    compact?: boolean;
    home?: boolean;
    emptyState?: ReactNode;
    className?: string;
}

export const FeedList = ({
    posts,
    openComments,
    commentsData,
    onLikeToggle,
    onReactionChange,
    onToggleComments,
    onSubmitComment,
    onSelectPost,
    pendingLikes = {},
    likeErrors = {},
    commentsErrors = {},
    onRetryComments,
    compact = false,
    home = false,
    emptyState = null,
    className = ''
}: FeedListProps) => {
    if (posts.length === 0) {
        return emptyState ? <>{emptyState}</> : null;
    }

    return (
        <div className={`feed-list flex flex-col gap-5 ${className}`.trim()}>
            {posts.map((post) => (
                <FeedPost
                    key={post.id}
                    post={post}
                    compact={compact}
                    home={home}
                    isCommentsOpen={openComments[post.id]}
                    commentsData={commentsData[post.id]}
                    onLikeToggle={onLikeToggle}
                    onReactionChange={onReactionChange}
                    onToggleComments={onToggleComments}
                    onSubmitComment={onSubmitComment}
                    onImageClick={() => onSelectPost(post)}
                    likePending={pendingLikes[post.id] === true}
                    likeError={likeErrors[post.id]}
                    commentsError={commentsErrors[post.id]}
                    onRetryComments={onRetryComments}
                />
            ))}
        </div>
    );
};
