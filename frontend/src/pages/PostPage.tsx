import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../api/axiosConfig';
import { FeedPost, type CommentDto, type FeedPostDto } from '../components/feed/FeedPost';
import { PostTheaterModal } from '../components/PostTheaterModal';
import { SkeletonCard } from '../components/ui/SkeletonCard';
import { useAuth } from '../context/AuthContext';
import { buildLoginPath } from '../utils/authRedirect';
import { extractApiErrorMessage } from '../utils/apiError';

export const PostPage = () => {
    const { postId } = useParams();
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const [post, setPost] = useState<FeedPostDto | null>(null);
    const [comments, setComments] = useState<CommentDto[] | undefined>();
    const [commentsOpen, setCommentsOpen] = useState(false);
    const [mediaViewerOpen, setMediaViewerOpen] = useState(false);
    const [commentsError, setCommentsError] = useState<string | null>(null);
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [likePending, setLikePending] = useState(false);
    const [likeError, setLikeError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [unavailable, setUnavailable] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const currentPostIdRef = useRef(postId);
    const postRequestRef = useRef(0);
    const commentsRequestRef = useRef(0);
    const likeRequestRef = useRef(0);
    currentPostIdRef.current = postId;
    const destination = `/posts/${postId ?? ''}`;

    const loadPost = useCallback(async () => {
        const requestedPostId = postId;
        const requestId = ++postRequestRef.current;
        setLoading(true);
        setUnavailable(false);
        setLoadError(null);
        try {
            const response = await apiClient.get<FeedPostDto>(`/posts/${requestedPostId}`);
            if (requestId !== postRequestRef.current || currentPostIdRef.current !== requestedPostId) return;
            setPost(response.data);
        } catch (error) {
            if (requestId !== postRequestRef.current || currentPostIdRef.current !== requestedPostId) return;
            const status = (error as { response?: { status?: number } }).response?.status;
            if (status === 404) setUnavailable(true);
            else setLoadError(extractApiErrorMessage(error, 'The post could not load.'));
            setPost(null);
        } finally {
            if (requestId === postRequestRef.current && currentPostIdRef.current === requestedPostId) setLoading(false);
        }
    }, [postId]);

    useEffect(() => {
        ++commentsRequestRef.current;
        ++likeRequestRef.current;
        setPost(null);
        setComments(undefined);
        setCommentsOpen(false);
        setMediaViewerOpen(false);
        setCommentsError(null);
        setCommentsLoading(false);
        setLikePending(false);
        setLikeError(null);
        if (!postId || !/^\d+$/.test(postId)) {
            ++postRequestRef.current;
            setLoading(false);
            setUnavailable(true);
            setLoadError(null);
            return;
        }
        void loadPost();
    }, [loadPost, postId]);

    const loadComments = async () => {
        const requestedPostId = postId;
        const requestId = ++commentsRequestRef.current;
        setCommentsLoading(true);
        setCommentsError(null);
        try {
            const response = await apiClient.get<CommentDto[]>(`/posts/${requestedPostId}/comments`);
            if (requestId !== commentsRequestRef.current || currentPostIdRef.current !== requestedPostId) return;
            setComments(response.data);
        } catch (error) {
            if (requestId !== commentsRequestRef.current || currentPostIdRef.current !== requestedPostId) return;
            setCommentsError(extractApiErrorMessage(error, 'Comments could not load.'));
        } finally {
            if (requestId === commentsRequestRef.current && currentPostIdRef.current === requestedPostId) setCommentsLoading(false);
        }
    };

    const toggleComments = async () => {
        const nextOpen = !commentsOpen;
        setCommentsOpen(nextOpen);
        if (nextOpen && !comments) await loadComments();
    };

    const openMediaViewer = () => {
        setMediaViewerOpen(true);
        if (!comments) void loadComments();
    };

    const requireSignIn = () => navigate(buildLoginPath(destination));

    const toggleLike = async () => {
        if (!isAuthenticated) {
            requireSignIn();
            return;
        }
        if (!post || likePending) return;
        const requestedPostId = postId;
        const requestId = ++likeRequestRef.current;
        const previous = post.isLikedByMe;
        const desired = !previous;
        setLikePending(true);
        setLikeError(null);
        setPost({ ...post, isLikedByMe: desired, likeCount: Math.max(0, post.likeCount + (desired ? 1 : -1)) });
        try {
            const response = await apiClient.put<{ isLiked: boolean }>(`/posts/${post.id}/like`, { liked: desired });
            if (requestId !== likeRequestRef.current || currentPostIdRef.current !== requestedPostId) return;
            setPost((current) => current?.id === post.id ? {
                ...current,
                likeCount: current.likeCount + (current.isLikedByMe === response.data.isLiked ? 0 : response.data.isLiked ? 1 : -1),
                isLikedByMe: response.data.isLiked,
            } : current);
        } catch (error) {
            if (requestId !== likeRequestRef.current || currentPostIdRef.current !== requestedPostId) return;
            setPost((current) => current?.id === post.id ? {
                ...current,
                likeCount: Math.max(0, current.likeCount + (current.isLikedByMe === previous ? 0 : previous ? 1 : -1)),
                isLikedByMe: previous,
            } : current);
            setLikeError(extractApiErrorMessage(error, 'Like could not be saved. Your previous choice was restored.'));
        } finally {
            if (requestId === likeRequestRef.current && currentPostIdRef.current === requestedPostId) setLikePending(false);
        }
    };

    const submitComment = async (_postId: number, content: string) => {
        if (!isAuthenticated) {
            requireSignIn();
            return;
        }
        const requestedPostId = postId;
        const response = await apiClient.post<CommentDto>(`/posts/${requestedPostId}/comments`, { content });
        if (currentPostIdRef.current !== requestedPostId) return;
        setComments((current) => [...(current || []), response.data]);
        setPost((current) => current && String(current.id) === requestedPostId
            ? { ...current, commentCount: current.commentCount + 1 }
            : current);
    };

    if (loading) return <div className="mx-auto w-full max-w-[680px]"><SkeletonCard lines={5} /></div>;

    if (unavailable || loadError) {
        return (
            <div className="mx-auto w-full max-w-[680px] rounded-2xl border border-[var(--feed-card-border)] bg-[var(--feed-card)] px-6 py-12 text-center">
                <AlertTriangle className="mx-auto h-10 w-10 text-amber-400" />
                <h1 className="mt-4 text-xl font-semibold text-[var(--feed-text-primary)]">{unavailable ? 'Post unavailable' : 'Post could not load'}</h1>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--feed-text-secondary)]">
                    {unavailable ? 'This post may be private, deleted, or shared with an account that has access.' : loadError}
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                    {!isAuthenticated && <Link to={buildLoginPath(destination)} className="rounded-full bg-[var(--feed-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--feed-accent-contrast)]">Sign in to check</Link>}
                    {!unavailable && <button type="button" onClick={() => void loadPost()} className="inline-flex items-center gap-2 rounded-full border border-[var(--feed-card-border)] px-5 py-2.5 text-sm font-semibold text-[var(--feed-text-primary)]"><RefreshCw className="h-4 w-4" />Retry</button>}
                    <Link to={isAuthenticated ? '/home' : '/'} className="inline-flex items-center gap-2 rounded-full border border-[var(--feed-card-border)] px-5 py-2.5 text-sm font-semibold text-[var(--feed-text-primary)]"><ArrowLeft className="h-4 w-4" />Go back</Link>
                </div>
            </div>
        );
    }

    return post && String(post.id) === postId ? (
        <div className="mx-auto w-full max-w-[680px]">
            <FeedPost
                key={post.id}
                post={post}
                isCommentsOpen={commentsOpen}
                commentsData={comments}
                onLikeToggle={toggleLike}
                onToggleComments={() => void toggleComments()}
                onSubmitComment={submitComment}
                onImageClick={openMediaViewer}
                likePending={likePending}
                likeError={likeError}
                commentsError={commentsError}
                onRetryComments={() => void loadComments()}
            />
            <PostTheaterModal
                key={post.id}
                isOpen={mediaViewerOpen}
                post={post}
                onClose={() => setMediaViewerOpen(false)}
                commentsData={comments}
                onSubmitComment={submitComment}
                onLikeToggle={toggleLike}
                likePending={likePending}
                likeError={likeError}
                commentsLoading={commentsLoading}
                commentsError={commentsError}
                onRetryComments={() => void loadComments()}
            />
        </div>
    ) : null;
};
