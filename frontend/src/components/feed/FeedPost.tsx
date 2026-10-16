import { ReactionButton } from './ReactionButton';
import { ReactionSummary } from './ReactionSummary';
import { selectedReaction, type Reaction } from './reactions';
import { formatDate } from '../../utils/formatting';
import { MediaImage } from '../ui/MediaImage';
import { memo, useEffect, useState, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { MessageCircle, MoreHorizontal, PlayCircle, Send, Share2, Pencil, Trash2, Flag, EyeOff, ExternalLink, Copy, Globe2, LockKeyhole, Info, ThumbsDown, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useJourneyCopy } from '../../features/squadCommunication/journeyCopy';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import { extractApiErrorMessage } from '../../utils/apiError';
import { EditPostDialog, PostDialog, ReportPostDialog, SharePostDialog, SharedPostPreview } from './PostDialogs';
import { apiClient } from '../../api/axiosConfig';
import { getAuthSessionId, getStoredUserId, subscribeAuthSession } from '../../utils/authStorage';
import { recordFeedEvent } from '../../features/feed/feedEvents';
import { isPostTopic, postTopics, type FeedWhy, type PostPlace, type PostReach, type PostTopic } from '../../features/feed/postTopics';

export interface CommentDto {
    id: number;
    authorName: string;
    authorAvatarUrl?: string | null;
    content: string;
    createdAt: string;
}

export interface FeedPostDto {
    id: number;
    content: string;
    createdAt: string;
    authorId?: number | null;
    authorName: string;
    authorAvatarUrl?: string | null;
    clubId?: number | null;
    clubName?: string | null;
    myReaction?: Reaction | null;
    reactionCount?: number;
    reactionCounts?: Partial<Record<Reaction, number>>;
    likeCount: number;
    commentCount: number;
    isLikedByMe: boolean;
    image?: string;
    mediaUrls?: string[];
    isPublic?: boolean;
    canEdit?: boolean;
    editedAt?: string | null;
    sharedPostId?: number | null;
    isReshare?: boolean;
    shareCount?: number;
    /** The three facts every post carries (set by the kind of post), and why Discover shows it. */
    topic?: PostTopic | string | null;
    tags?: string[];
    place?: PostPlace | null;
    reach?: PostReach | string | null;
    why?: FeedWhy | null;
}

interface FeedPostProps {
    post: FeedPostDto;
    isCommentsOpen: boolean;
    commentsData?: CommentDto[];
    onReactionChange?: (postId: number, reaction: Reaction | null) => void | Promise<void>;
    onLikeToggle: (postId: number) => void | Promise<void>;
    onToggleComments: (postId: number) => void;
    onSubmitComment: (postId: number, content: string) => void | Promise<void>;
    onImageClick: () => void;
    likePending?: boolean;
    likeError?: string | null;
    commentsError?: string | null;
    onRetryComments?: (postId: number) => void;
    compact?: boolean;
    home?: boolean;
}

// Keep this component identity stable. Defining it inside FeedPost remounts every
// image on likes, comments and draft edits, discarding authenticated blob URLs.
const PostMediaItem = memo(function PostMediaItem({ url, className, fit = 'cover' }: { url: string; className: string; fit?: 'cover' | 'contain' }) {
    const finalUrl = resolveMediaUrl(url);
    const isVideo = finalUrl?.match(/\.(mp4|mov|webm)(?:\?|$)/i);
    return isVideo
        ? <div className={`${className} flex flex-col items-center justify-center gap-2 bg-[color:var(--color-page)] text-center text-[color:var(--color-text)]`}>
            <PlayCircle className="h-9 w-9" aria-hidden="true" />
            <span className="text-xs font-semibold">Video · Open to play</span>
          </div>
        : <MediaImage src={finalUrl} alt="Post media" loading="lazy" className={className} style={{ objectFit: fit }} />;
});

export const FeedPost = ({
    post: suppliedPost,
    isCommentsOpen,
    commentsData,
    onLikeToggle,
    onReactionChange,
    onToggleComments,
    onSubmitComment,
    onImageClick,
    likePending = false,
    likeError = null,
    commentsError = null,
    onRetryComments,
    compact = false,
    home = false
}: FeedPostProps) => {
    const { t } = useTranslation();
    const copy = useJourneyCopy();
    const [commentInput, setCommentInput] = useState('');
    const [savedPost, setSavedPost] = useState<FeedPostDto | null>(null);
    const post = savedPost ? { ...suppliedPost, content: savedPost.content, isPublic: savedPost.isPublic, editedAt: savedPost.editedAt } : suppliedPost;
    const [dialog, setDialog] = useState<'edit' | 'report' | 'share' | 'delete' | 'why' | null>(null);
    const [removed, setRemoved] = useState<'hidden' | 'deleted' | 'less' | null>(null);
    const [actionPending, setActionPending] = useState(false), [actionError, setActionError] = useState('');
    const session = useSyncExternalStore(subscribeAuthSession, getAuthSessionId);
    const viewerId = Number(getStoredUserId());
    const canEdit = post.canEdit === true;
    const [shareFeedback, setShareFeedback] = useState('');
    const postActions = useRef<HTMLDetailsElement>(null);
    const [commentPending, setCommentPending] = useState(false);
    const [commentError, setCommentError] = useState('');
    // Discover records what the person saw (half the card in view) and opened, for the learning algorithm later.
    const card = useRef<HTMLElement>(null);
    const ranked = home && Boolean(post.why);
    useEffect(() => {
        if (!ranked || !card.current || typeof IntersectionObserver === 'undefined') return;
        const observer = new IntersectionObserver(entries => {
            if (entries.some(entry => entry.isIntersecting)) { recordFeedEvent(post.id, 'SEEN'); observer.disconnect(); }
        }, { threshold: 0.5 });
        observer.observe(card.current);
        return () => observer.disconnect();
    }, [ranked, post.id]);
    const opened = () => { if (ranked) recordFeedEvent(post.id, 'OPENED'); };
    const topicInfo = isPostTopic(post.topic) ? postTopics[post.topic] : null;
    const topicLabel = post.topic ? t(`feed.topic.${post.topic}`, { defaultValue: String(post.topic).toLowerCase().replaceAll('_', ' ') }) : '';

    const formatTime = (dateString: string) =>
        formatDate(dateString, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    const initials = (post.clubName || post.authorName).substring(0, 2).toUpperCase();
    const authorAvatarUrl = resolveMediaUrl(post.authorAvatarUrl);
    const displayAuthorName = post.clubName || post.authorName;
    const authorProfilePath = post.clubId != null
        ? `/clubs/${post.clubId}`
        : post.authorId != null
            ? `/profile/${post.authorId}`
            : null;

    const handleCommentSubmit = async () => {
        const submittedContent = commentInput.trim();
        if (!submittedContent || commentPending) return;
        setCommentPending(true);
        setCommentError('');
        try {
            await onSubmitComment(post.id, submittedContent);
            setCommentInput((current) => current.trim() === submittedContent ? '' : current);
        } catch (error) {
            setCommentError(extractApiErrorMessage(error, copy('Comment could not be posted. Your draft is still here.', 'კომენტარი ვერ გამოქვეყნდა. მონახაზი შენახულია.')));
        } finally {
            setCommentPending(false);
        }
    };

    const closeActions = () => { if (postActions.current) { postActions.current.open = false; postActions.current.querySelector('summary')?.focus(); } };
    const openDialog = (value: typeof dialog) => { closeActions(); setActionError(''); setDialog(value); };
    const handleShare = () => openDialog('share');
    const copyLink = async () => { closeActions(); try { await navigator.clipboard.writeText(new URL(`/posts/${post.id}`, window.location.origin).toString()); setShareFeedback(copy('Post link copied.', 'ბმული დაკოპირდა.')); } catch { openDialog('share'); } };
    const remove = async (kind: 'hidden' | 'deleted') => {
        if (actionPending) return; closeActions(); setActionPending(true); setActionError('');
        try { if (kind === 'hidden') await apiClient.post(`/posts/${post.id}/hide`); else await apiClient.delete(`/posts/${post.id}`); setRemoved(kind); setDialog(null); if (kind === 'hidden' && ranked) recordFeedEvent(post.id, 'HIDDEN'); }
        catch (e) { setActionError(extractApiErrorMessage(e, copy('Could not complete this action. Please try again.', 'მოქმედება ვერ შესრულდა. სცადეთ ხელახლა.'))); }
        finally { setActionPending(false); }
    };
    const undoHide = async () => { if (actionPending) return; setActionPending(true); try { await apiClient.post(`/posts/${post.id}/hide`); setRemoved(null); } catch (e) { setActionError(extractApiErrorMessage(e, copy('Could not restore this post.', 'პოსტი ვერ აღდგა.'))); } finally { setActionPending(false); } };
    // "Show less like this" is a preference, not a hide: the post folds away here and its kind ranks last from now on.
    const lessLikeThis = () => { closeActions(); recordFeedEvent(post.id, 'LESS'); setRemoved('less'); };
    const undoLess = () => { recordFeedEvent(post.id, 'UNDO_LESS'); setRemoved(null); };

    const mediaList = post.mediaUrls && post.mediaUrls.length > 0 ? post.mediaUrls : post.image ? [post.image] : [];
    const authorIdentity = (
        <>
            <div className={`post-author-avatar flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--feed-layer-bg)] font-semibold text-[var(--feed-text-secondary)] ring-2 ring-transparent transition-all group-hover/author:ring-[var(--feed-accent-border)] ${compact ? 'h-11 w-11 text-sm' : 'h-12 w-12 text-base'}`}>
                {authorAvatarUrl ? <MediaImage src={authorAvatarUrl} alt={displayAuthorName} loading="lazy" className="h-full w-full object-cover" /> : initials}
            </div>
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <h4 className="post-author-name truncate text-base font-semibold text-[var(--feed-text-primary)] transition-colors group-hover/author:text-[var(--feed-accent)]">{displayAuthorName}</h4>
                    {post.clubName && <span className="post-author-badge rounded-full bg-[var(--feed-accent-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--feed-accent)]">{home ? copy('Club', 'კლუბი') : copy('Official', 'ოფიციალური')}</span>}
                </div>
                <div className="post-author-meta mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--feed-text-secondary)]">
                    <span>{formatTime(post.createdAt)}</span>
                    {home ? <>
                        <span aria-hidden="true">·</span>
                        <span className="home-post-audience">{post.isPublic === false ? <LockKeyhole className="h-3 w-3" aria-hidden="true" /> : <Globe2 className="h-3 w-3" aria-hidden="true" />}{post.isPublic === false ? copy('Restricted', 'შეზღუდული') : copy('Public', 'საჯარო')}</span>
                        {post.place?.city && <span className="home-post-fact"><MapPin className="h-3 w-3" aria-hidden="true" />{post.place.city}</span>}
                        {topicInfo && <span className="home-post-fact" style={{ color: topicInfo.color }}><topicInfo.icon className="h-3 w-3" aria-hidden="true" />{topicLabel}</span>}
                        {post.editedAt && <span>· Edited</span>}
                    </> : <>
                    <span className="h-1 w-1 rounded-full bg-[var(--feed-icon-muted)]" />
                    <span>{post.commentCount} {post.commentCount === 1 ? 'comment' : 'comments'}</span>
                    {(post.shareCount ?? 0) > 0 && <span>· {post.shareCount} {post.shareCount === 1 ? 'share' : 'shares'}</span>}
                    {post.editedAt && <span>· Edited</span>}
                    {post.isPublic === false ? <LockKeyhole className="h-3 w-3" aria-label={copy('Restricted audience', 'შეზღუდული აუდიტორია')} /> : <Globe2 className="h-3 w-3" aria-label={copy('Public post', 'საჯარო პოსტი')} />}
                    </>}
                </div>
            </div>
        </>
    );

    const renderMediaGrid = () => {
        if (mediaList.length === 0) return null;

        const count = mediaList.length;

        return (
            <button
                type="button"
                aria-label={`Open media from ${displayAuthorName}'s post`}
                className="block w-full cursor-pointer overflow-hidden border-y border-[var(--feed-card-border)] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--feed-accent)]"
                onClick={() => { opened(); onImageClick(); }}
            >
                {count === 1 && (
                    <div className={`relative flex w-full items-center justify-center overflow-hidden bg-[color:var(--color-page)] ${compact ? 'h-[clamp(180px,32dvh,320px)]' : 'h-[clamp(240px,50dvh,520px)]'}`}>
                        <PostMediaItem url={mediaList[0]} fit="contain" className="relative z-10 h-full w-full" />
                    </div>
                )}
                {count === 2 && (
                    <div className="grid grid-cols-2 gap-px bg-[var(--feed-bg)]">
                        <PostMediaItem url={mediaList[0]} className={`w-full bg-[color:var(--color-page)] ${compact ? 'h-32' : 'h-56'}`} />
                        <PostMediaItem url={mediaList[1]} className={`w-full bg-[color:var(--color-page)] ${compact ? 'h-32' : 'h-56'}`} />
                    </div>
                )}
                {count === 3 && (
                    <div className="grid grid-cols-2 gap-px bg-[var(--feed-bg)]">
                        <PostMediaItem url={mediaList[0]} className={`col-span-2 w-full bg-[color:var(--color-page)] ${compact ? 'h-40' : 'h-64'}`} />
                        <PostMediaItem url={mediaList[1]} className={`w-full bg-[color:var(--color-page)] ${compact ? 'h-24' : 'h-32'}`} />
                        <PostMediaItem url={mediaList[2]} className={`w-full bg-[color:var(--color-page)] ${compact ? 'h-24' : 'h-32'}`} />
                    </div>
                )}
                {count >= 4 && (
                    <div className="grid grid-cols-2 gap-px bg-[var(--feed-bg)]">
                        <PostMediaItem url={mediaList[0]} className={`w-full bg-[color:var(--color-page)] ${compact ? 'h-28' : 'h-40'}`} />
                        <PostMediaItem url={mediaList[1]} className={`w-full bg-[color:var(--color-page)] ${compact ? 'h-28' : 'h-40'}`} />
                        <PostMediaItem url={mediaList[2]} className={`w-full bg-[color:var(--color-page)] ${compact ? 'h-28' : 'h-40'}`} />
                        <div className={`relative w-full ${compact ? 'h-28' : 'h-40'}`}>
                            <PostMediaItem url={mediaList[3]} className="h-full w-full bg-[color:var(--color-page)]" />
                            {count > 4 && <div className="absolute inset-0 flex items-center justify-center bg-[color:var(--color-overlay)]/60 text-2xl font-bold text-[color:var(--color-on-media)]">+{count - 4}</div>}
                        </div>
                    </div>
                )}
            </button>
        );
    };

    if (removed) return <div className="rounded-xl border border-[var(--feed-card-border)] bg-[var(--feed-card)] px-5 py-4 text-sm text-[var(--feed-text-secondary)]">
        <span role="status">{removed === 'hidden' ? copy('Post hidden from your feed.', 'პოსტი დაიმალა.') : removed === 'less' ? t('feed.less.done', { topic: topicLabel.toLowerCase(), name: displayAuthorName, defaultValue: `You will see less about ${topicLabel.toLowerCase()} from ${displayAuthorName}.` }) : copy('Post deleted.', 'პოსტი წაიშალა.')}</span>
        {removed === 'hidden' && <button type="button" disabled={actionPending} className="post-text-button ml-3" onClick={() => void undoHide()}>{copy('Undo', 'გაუქმება')}</button>}
        {removed === 'less' && <button type="button" className="post-text-button ml-3" onClick={undoLess}>{t('feed.less.undo', { defaultValue: 'Undo' })}</button>}
        {actionError && <p role="alert" className="post-error">{actionError}</p>}
    </div>;
    const why = post.why;
    const whyText = why ? t(`feed.why.${why.kind}`, { defaultValue: t('feed.why.unknown', { defaultValue: 'A public post.' }), name: why.name ?? displayAuthorName, km: why.distanceKm ?? '', topic: topicLabel.toLowerCase(), place: why.place ?? '', reactions: why.reactions ?? '' }) : '';
    return (
        <article ref={card} className={`feed-post ${home ? 'home-feed-post' : ''} rounded-xl border border-[var(--feed-card-border)] bg-[var(--feed-card)] shadow-[0_4px_24px_color-mix(in_srgb,_var(--color-shadow)_12%,_transparent)]`}>
            <div className={`post-header ${compact ? 'px-5 py-4' : 'px-6 py-5'} flex items-start justify-between gap-3`}>
                {authorProfilePath ? (
                    <Link
                        to={authorProfilePath}
                        onClick={opened}
                        aria-label={`View ${displayAuthorName} profile`}
                        className="post-author group/author flex min-w-0 items-start gap-4 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--feed-accent)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--feed-card)]"
                    >
                        {authorIdentity}
                    </Link>
                ) : (
                    <div className="post-author flex min-w-0 items-start gap-4">{authorIdentity}</div>
                )}
                <details ref={postActions} className="relative" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) event.currentTarget.open = false; }} onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); } }}>
                    <summary aria-label={`Actions for post by ${displayAuthorName}`} className="list-none cursor-pointer rounded-full p-2 text-[var(--feed-text-secondary)] hover:bg-[var(--feed-hover-bg)] focus-visible:outline focus-visible:outline-2"><MoreHorizontal className="h-4 w-4" /></summary>
                    <div className="post-menu">
                        {canEdit && <><button type="button" onClick={() => openDialog('edit')}><Pencil />{copy('Edit post', 'პოსტის რედაქტირება')}</button><button type="button" className="post-danger" onClick={() => openDialog('delete')}><Trash2 />{copy('Delete post', 'პოსტის წაშლა')}</button></>}
                        <Link to={`/posts/${post.id}`} onClick={() => { closeActions(); opened(); }}><ExternalLink />{copy('Open post', 'პოსტის გახსნა')}</Link>
                        <button type="button" onClick={handleShare}><Share2 />{copy('Share post', 'პოსტის გაზიარება')}</button>
                        <button type="button" onClick={() => void copyLink()}><Copy />{copy('Copy link', 'ბმულის კოპირება')}</button>
                        {why && <button type="button" onClick={() => openDialog('why')}><Info />{t('feed.why.action', { defaultValue: 'Why am I seeing this?' })}</button>}
                        {why && viewerId > 0 && !canEdit && why.kind !== 'LESS' && <button type="button" onClick={lessLikeThis}><ThumbsDown />{t('feed.less.action', { defaultValue: 'Show less like this' })}</button>}
                        {viewerId > 0 && !canEdit && <button type="button" disabled={actionPending} onClick={() => void remove('hidden')}><EyeOff />{copy('Hide post', 'პოსტის დამალვა')}</button>}
                        {viewerId > 0 && !canEdit && post.authorId !== viewerId && <button type="button" onClick={() => openDialog('report')}><Flag />{copy('Report post', 'პოსტის შეტყობინება')}</button>}
                    </div>
                </details>
            </div>

            <div className={`post-body ${compact ? 'px-5 pb-4' : 'px-6 pb-5'}`}>
                <p className="home-post-content whitespace-pre-line text-base leading-7 text-[var(--feed-text-primary)]">{post.content}</p>
                {post.isReshare && <div className="mt-3"><SharedPostPreview key={post.sharedPostId} id={post.sharedPostId} /></div>}
            </div>

            {renderMediaGrid()}

            <ReactionSummary post={post} />

            <div className="post-action-row">
                <ReactionButton value={selectedReaction(post)} disabled={likePending} allowAll={Boolean(onReactionChange)}
                    onChange={reaction => { if (onReactionChange) void onReactionChange(post.id, reaction); else void onLikeToggle(post.id); }} />
                <ActionButton active={isCommentsOpen} icon={<MessageCircle className="h-4 w-4" aria-hidden="true" />} label={copy('Comment', 'კომენტარი')} count={home ? post.commentCount : undefined} onClick={() => { if (!isCommentsOpen) opened(); onToggleComments(post.id); }} />
                <ActionButton active={false} icon={<Share2 className="h-4 w-4" aria-hidden="true" />} label={copy('Share', 'გაზიარება')} count={home && (post.shareCount ?? 0) > 0 ? post.shareCount : undefined} onClick={handleShare} />
            </div>

            {shareFeedback && (
                <div aria-live="polite" className="px-4 pb-1 text-xs font-medium text-[var(--feed-accent)]">{shareFeedback}</div>
            )}

            {likeError && <div role="alert" className="px-4 pb-2 text-xs font-medium text-[color:var(--color-danger)]">{likeError}</div>}

            <MotionDisclosure open={Boolean(isCommentsOpen)}>
                <div className="border-t border-[var(--feed-card-border)] bg-[var(--feed-surface)] px-4 py-3">
                    <div className="mb-3 flex max-h-60 flex-col gap-3 overflow-y-auto">
                        {commentsError ? (
                            <div role="alert" className="flex items-center justify-between gap-3 text-xs text-[color:var(--color-danger)]">
                                <span>{commentsError}</span>
                                {onRetryComments && <button type="button" onClick={() => onRetryComments(post.id)} className="font-semibold app-text-action">{copy('Retry', 'ხელახლა ცდა')}</button>}
                            </div>
                        ) : !commentsData ? (
                            <div className="text-xs text-[var(--feed-text-muted)]">{copy('Loading comments…', 'კომენტარები იტვირთება…')}</div>
                        ) : commentsData.length === 0 ? (
                            <div className="text-xs text-[var(--feed-text-muted)]">{copy('No comments yet', 'კომენტარები ჯერ არ არის')}</div>
                        ) : (
                            commentsData.map((comment) => (
                                <div key={comment.id} className="flex gap-3">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--feed-layer-bg)] text-xs font-semibold text-[var(--feed-text-secondary)]">
                                        {resolveMediaUrl(comment.authorAvatarUrl) ? (
                                            <MediaImage src={resolveMediaUrl(comment.authorAvatarUrl)} alt={comment.authorName} loading="lazy" className="h-full w-full object-cover" />
                                        ) : (
                                            comment.authorName.substring(0, 2).toUpperCase()
                                        )}
                                    </div>
                                    <div className="flex-1 rounded-xl bg-[var(--feed-layer-bg)] px-3 py-2.5">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs font-semibold text-[var(--feed-text-primary)]">{comment.authorName}</span>
                                            <span className="text-xs text-[var(--feed-text-muted)]">{formatTime(comment.createdAt)}</span>
                                        </div>
                                        <p className="mt-1.5 text-sm text-[var(--feed-text-secondary)]">{comment.content}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="flex gap-2">
                        <input
                            type="text"
                            aria-label={`Write a comment on ${displayAuthorName}'s post`}
                            placeholder={copy('Write a comment…', 'დაწერეთ კომენტარი…')}
                            value={commentInput}
                            onChange={(event) => {
                                setCommentInput(event.target.value);
                                setCommentError('');
                            }}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    void handleCommentSubmit();
                                }
                            }}
                            className="flex-1 rounded-full border border-[var(--feed-card-border)] bg-[var(--feed-input-bg)] px-4 py-2.5 text-sm text-[var(--feed-text-primary)] outline-none placeholder:text-[var(--feed-text-placeholder)] focus:border-[var(--feed-accent)]"
                        />
                        <button type="button" aria-label={copy('Post comment', 'კომენტარის გამოქვეყნება')} onClick={() => void handleCommentSubmit()} disabled={!commentInput.trim() || commentPending} className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--feed-accent)] text-[var(--feed-accent-contrast)] transition-colors hover:bg-[var(--feed-accent-hover)] disabled:opacity-40">
                            <Send className="h-4 w-4" />
                        </button>
                    </div>
                    {commentError && <p role="alert" className="mt-2 text-xs font-medium text-[color:var(--color-danger)]">{commentError}</p>}
                </div>
            </MotionDisclosure>
            {actionError && <p role="alert" className="post-error px-5 pb-3">{actionError}</p>}
            {dialog === 'edit' && <EditPostDialog key={`${session}:edit`} post={post} onClose={() => setDialog(null)} onSaved={setSavedPost} />}
            {dialog === 'report' && <ReportPostDialog key={`${session}:report`} post={post} onClose={() => setDialog(null)} />}
            {dialog === 'share' && <SharePostDialog key={`${session}:share`} post={post} onClose={() => setDialog(null)} onShared={() => setShareFeedback(copy('Post shared to your profile.', 'პოსტი გაზიარდა თქვენს პროფილზე.'))} />}
            {dialog === 'why' && why && <PostDialog title={t('feed.why.title', { defaultValue: 'Why you see this post' })} onClose={() => setDialog(null)}>
                <p className="post-why">{whyText}</p>
                <dl className="post-facts">
                    <div><dt>{t('feed.why.topic', { defaultValue: 'Topic' })}</dt><dd>{topicInfo && <topicInfo.icon aria-hidden="true" style={{ color: topicInfo.color }} />}{topicLabel || '—'}</dd></div>
                    <div><dt>{t('feed.why.place', { defaultValue: 'Place' })}</dt><dd><MapPin aria-hidden="true" />{post.place?.city ?? t('feed.why.nowhere', { defaultValue: 'Everywhere' })}</dd></div>
                    <div><dt>{t('feed.why.reach', { defaultValue: 'Reach' })}</dt><dd>{post.reach ? t(`feed.reach.${post.reach}`, { defaultValue: String(post.reach).toLowerCase() }) : '—'}</dd></div>
                </dl>
                {viewerId > 0 && !canEdit && why.kind !== 'LESS' && <footer><button type="button" className="post-secondary" onClick={() => { setDialog(null); lessLikeThis(); }}><ThumbsDown aria-hidden="true" />{t('feed.less.action', { defaultValue: 'Show less like this' })}</button></footer>}
            </PostDialog>}
            {dialog === 'delete' && <PostDialog title="Delete post" busy={actionPending} onClose={() => setDialog(null)}><p>This will remove your post and its comments. Shared copies will show that the original is unavailable.</p>{actionError && <p role="alert" className="post-error">{actionError}</p>}<footer><button type="button" className="post-secondary" disabled={actionPending} onClick={() => setDialog(null)}>Cancel</button><button type="button" className="post-primary" disabled={actionPending} onClick={() => void remove('deleted')}>{actionPending ? 'Deleting…' : 'Delete post'}</button></footer></PostDialog>}
        </article>
    );
};

const ActionButton = ({
    active,
    icon,
    label,
    count,
    onClick,
    disabled = false
}: {
    active: boolean;
    icon: ReactNode;
    label: string;
    count?: number;
    onClick: () => void;
    disabled?: boolean;
}) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={count == null ? label : `${label}, ${new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(count)} ${label.toLowerCase()}${count === 1 ? '' : 's'}`}
        data-active={active}
        className="post-action"
    >
        {icon}
        <span className="post-action-label">{count == null ? label : `${new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(count)} ${label.toLowerCase()}${count === 1 ? '' : 's'}`}</span>
    </button>
);
import { MotionDisclosure } from '../ui/MotionDisclosure';
