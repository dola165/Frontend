import type { ReactNode } from 'react';
import { FeedPost, type CommentDto, type FeedPostDto } from './FeedPost';

interface FeedListProps {
    posts: FeedPostDto[];
    openComments: Record<number, boolean>;
    commentsData: Record<number, CommentDto[]>;
    onLikeToggle: (postId: number) => void;
    onToggleComments: (postId: number) => void;
    onSubmitComment: (postId: number, content: string) => void;
    onSelectPost: (post: FeedPostDto) => void;
    compact?: boolean;
    emptyState?: ReactNode;
    className?: string;
}

export const FeedList = ({
    posts,
    openComments,
    commentsData,
    onLikeToggle,
    onToggleComments,
    onSubmitComment,
    onSelectPost,
    compact = false,
    emptyState = null,
    className = ''
}: FeedListProps) => {
    if (posts.length === 0) {
        return emptyState ? <>{emptyState}</> : null;
    }

    return (
        <div className={`flex flex-col gap-5 ${className}`.trim()}>
            {posts.map((post) => (
                <FeedPost
                    key={post.id}
                    post={post}
                    compact={compact}
                    isCommentsOpen={openComments[post.id]}
                    commentsData={commentsData[post.id]}
                    onLikeToggle={onLikeToggle}
                    onToggleComments={onToggleComments}
                    onSubmitComment={onSubmitComment}
                    onImageClick={() => onSelectPost(post)}
                />
            ))}
        </div>
    );
};
