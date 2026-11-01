import { getAuthSessionId, isCurrentAuthSession } from '../../utils/authStorage';
import { useCommentRefresh } from '../../components/feed/useCommentRefresh';
import type { CommentAttempt } from '../../components/feed/commentDraft';
import { useEffect, useState, useRef } from 'react';
import { apiClient } from '../../api/axiosConfig';
import type { CommentDto, FeedPostDto } from '../../components/feed/FeedPost';
import { reactionFields } from '../../components/feed/reactions';
import { usePagedProfilePosts } from '../../hooks/usePagedProfilePosts';
import { usePostReactions } from '../../hooks/usePostReactions';
import { extractApiErrorMessage } from '../../utils/apiError';

type ByPost<T> = Record<number, T>;

/**
 * A profile's posts with likes, reactions, comments and the open post, for a club or a person.
 * Paging, optimistic likes with rollback and per-post errors behave like the Home feed.
 */
export function useProfilePostFeed(endpoint: string, limit = 20) {
    const pages = usePagedProfilePosts(endpoint, limit);
    const { posts, setPosts } = pages;
    const scope = useRef(pages.pageKey); scope.current = pages.pageKey;
    const [openComments, setOpenComments] = useState<ByPost<boolean>>({});
    const [commentsData, setCommentsData] = useState<ByPost<CommentDto[]>>({});
    const [commentsErrors, setCommentsErrors] = useState<ByPost<string | null>>({});
    const [commentsLoading, setCommentsLoading] = useState<ByPost<boolean>>({});
    const [pendingLikes, setPendingLikes] = useState<ByPost<boolean>>({});
    const [likeErrors, setLikeErrors] = useState<ByPost<string | null>>({});
    const [selected, setSelected] = useState<FeedPostDto | null>(null);

    useEffect(() => {
        setCommentsData({}); setCommentsErrors({}); setCommentsLoading({}); setOpenComments({}); setPendingLikes({}); setLikeErrors({}); setSelected(null);
    }, [pages.pageKey]);

    const update = (postId: number, change: (post: FeedPostDto) => FeedPostDto) => {
        setPosts(current => current.map(post => post.id === postId ? change(post) : post));
        setSelected(current => current?.id === postId ? change(current) : current);
    };
    const reactions = usePostReactions(pages.pageKey, saved => update(saved.id, post => reactionFields(post, saved)));

    const toggleLike = async (postId: number) => {
        if (pendingLikes[postId]) return;
        const current = posts.find(post => post.id === postId) ?? (selected?.id === postId ? selected : null);
        if (!current) return;
        const previous = current.isLikedByMe;
        const apply = (liked: boolean) => update(postId, post => post.isLikedByMe === liked ? post : { ...post, isLikedByMe: liked, likeCount: Math.max(0, post.likeCount + (liked ? 1 : -1)) });
        setPendingLikes(state => ({ ...state, [postId]: true }));
        setLikeErrors(state => ({ ...state, [postId]: null }));
        apply(!previous);
        try {
            const response = await apiClient.put<{ isLiked: boolean }>(`/posts/${postId}/like`, { liked: !previous });
            apply(response.data.isLiked);
        } catch (error) {
            apply(previous);
            setLikeErrors(state => ({ ...state, [postId]: extractApiErrorMessage(error, 'Like could not be saved. Your previous choice was restored.') }));
        } finally {
            setPendingLikes(state => ({ ...state, [postId]: false }));
        }
    };

    const loadComments = async (postId: number, force = false) => {
        if (commentsData[postId] && !force) return;
        const session = getAuthSessionId(), key = pages.pageKey;
        const current = () => isCurrentAuthSession(session) && key === scope.current;
        setCommentsLoading(state => ({ ...state, [postId]: true }));
        setCommentsErrors(state => ({ ...state, [postId]: null }));
        try {
            const response = await apiClient.get<CommentDto[]>(`/posts/${postId}/comments`);
            if (!current()) return;
            setCommentsData(state => ({ ...state, [postId]: response.data }));
            return response.data;
        } catch (error) {
            if (!current()) return;
            setCommentsErrors(state => ({ ...state, [postId]: extractApiErrorMessage(error, 'Comments could not load.') }));
        } finally {
            if (current()) setCommentsLoading(state => ({ ...state, [postId]: false }));
        }
    };

    const toggleComments = async (postId: number) => {
        const open = openComments[postId];
        setOpenComments(state => ({ ...state, [postId]: !open }));
        if (!open) await loadComments(postId);
    };

    const submitComment = async (postId: number, content: string, attempt?: CommentAttempt) => {
        const session = getAuthSessionId(), key = pages.pageKey;
        const response = await apiClient.post<CommentDto>(`/posts/${postId}/comments`, { content, ...(attempt?.parentId ? { parentId: attempt.parentId } : {}) }, attempt ? { headers: { 'Idempotency-Key': attempt.requestId } } : undefined);
        if (!isCurrentAuthSession(session) || key !== scope.current) return;
        if (commentsData[postId]?.some(comment => comment.id === response.data.id)) return;
        setCommentsData(state => ({ ...state, [postId]: [...(state[postId] || []), response.data] }));
    };

    const open = (post: FeedPostDto | null) => {
        setSelected(post);
        if (post) void loadComments(post.id);
    };

    useCommentRefresh(id => posts.some(post => post.id === id), (saved, comments) => {
        setPosts(items => items.map(post => post.id === saved.id ? saved : post));
        setSelected(post => post?.id === saved.id ? saved : post);
        if (comments) setCommentsData(items => ({ ...items, [saved.id]: comments }));
    }, id => { setPosts(items => items.filter(post => post.id !== id)); setSelected(post => post?.id === id ? null : post); });
    const ids = new Set([...Object.keys(pendingLikes), ...Object.keys(reactions.pending), ...Object.keys(likeErrors), ...Object.keys(reactions.errors)].map(Number));
    const merged = <T,>(pick: (id: number) => T) => Object.fromEntries([...ids].map(id => [id, pick(id)])) as ByPost<T>;
    return {
        pages, posts, selected, open,
        openComments, commentsData, commentsErrors, commentsLoading,
        pendingLikes: merged(id => pendingLikes[id] === true || reactions.pending[id] === true),
        likeErrors: merged(id => reactions.errors[id] || likeErrors[id] || null),
        toggleLike, toggleComments, submitComment, loadComments,
        changeReaction: reactions.change,
    };
}

export type ProfilePostFeed = ReturnType<typeof useProfilePostFeed>;
