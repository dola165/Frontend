import type { ReactNode } from 'react';
import { FeedList } from '../../components/feed/FeedList';
import { PostTheaterModal } from '../../components/PostTheaterModal';
import { Button, ButtonLink, EmptyNote, Skeleton } from '../../design/primitives';
import type { ProfilePostFeed } from './useProfilePostFeed';
import './profile-posts.css';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';

/**
 * A profile's posts in the Home feed style. With `preview`, only the latest few show
 * and a link leads to the full list; otherwise older and newer pages are available.
 */
export function ProfilePosts({ feed, composer, empty, preview }: {
    feed: ProfilePostFeed;
    composer?: ReactNode;
    empty: { title: string; body?: string; action?: ReactNode };
    preview?: { count: number; allTo: string; allLabel?: string };
}) {
    const copy = useJourneyCopy();
    const { pages } = feed;
    const posts = preview ? feed.posts.slice(0, preview.count) : feed.posts;
    const more = preview && (feed.posts.length > preview.count || pages.hasOlder);
    return (
        <div className="gk-profile-posts home-feed-canvas">
            {composer}
            {pages.error && <div className="gk-notice gk-notice--danger" role="alert"><span>{pages.error}</span><Button size="sm" onClick={pages.retry}>{copy('Try again', 'ხელახლა ცდა')}</Button></div>}
            {pages.loading && <div className="gk-profile-posts__loading" role="status" aria-label={copy('Loading posts', 'პოსტები იტვირთება')}><Skeleton height={148} /><Skeleton height={148} /></div>}
            {!pages.loading && !pages.error && !posts.length && <div className="gk-profile-posts__empty"><EmptyNote title={empty.title} action={empty.action}>{empty.body}</EmptyNote></div>}
            {!pages.loading && posts.length > 0 && <FeedList home compact posts={posts}
                openComments={feed.openComments} commentsData={feed.commentsData}
                onLikeToggle={feed.toggleLike} onReactionChange={feed.changeReaction}
                onToggleComments={feed.toggleComments} onSubmitComment={feed.submitComment}
                pendingLikes={feed.pendingLikes} likeErrors={feed.likeErrors} commentsErrors={feed.commentsErrors}
                onRetryComments={postId => void feed.loadComments(postId, true)}
                onSelectPost={post => feed.open(post)} />}
            {preview && more && <ButtonLink className="gk-profile-posts__all" to={preview.allTo}>{preview.allLabel ?? copy('See all posts', 'ყველა პოსტის ნახვა')}</ButtonLink>}
            {!preview && !pages.loading && (pages.hasNewer || pages.hasOlder) && <nav className="gk-profile-posts__pages" aria-label={copy('Post pages', 'პოსტების გვერდები')}>
                <Button size="sm" disabled={!pages.hasNewer} onClick={pages.newer}>{copy('Newer posts', 'ახალი პოსტები')}</Button>
                <span className="gk-faint">{copy(`Page ${pages.page}`, `გვერდი ${pages.page}`)}</span>
                <Button size="sm" disabled={!pages.hasOlder} onClick={pages.older}>{copy('Older posts', 'ძველი პოსტები')}</Button>
            </nav>}
            <PostTheaterModal isOpen={!!feed.selected} post={feed.selected} onClose={() => feed.open(null)}
                commentsData={feed.selected ? feed.commentsData[feed.selected.id] : undefined}
                onSubmitComment={feed.submitComment} onLikeToggle={feed.toggleLike} onReactionChange={feed.changeReaction}
                likePending={feed.selected ? feed.pendingLikes[feed.selected.id] === true : false}
                likeError={feed.selected ? feed.likeErrors[feed.selected.id] : null}
                commentsLoading={feed.selected ? feed.commentsLoading[feed.selected.id] === true : false}
                commentsError={feed.selected ? feed.commentsErrors[feed.selected.id] : null}
                onRetryComments={postId => void feed.loadComments(postId, true)} />
        </div>
    );
}
