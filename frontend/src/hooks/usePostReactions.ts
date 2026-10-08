import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { apiClient, type AuthSessionRequestConfig } from '../api/axiosConfig';
import { getAuthSessionId, subscribeAuthSession } from '../utils/authStorage';
import { extractApiErrorMessage } from '../utils/apiError';
import type { FeedPostDto } from '../components/feed/FeedPost';
import type { Reaction } from '../components/feed/reactions';

export function usePostReactions(scope: string, onSaved: (post: FeedPostDto) => void) {
    const session = useSyncExternalStore(subscribeAuthSession, getAuthSessionId);
    const key = `${scope}:${session}`, keyRef = useRef(key), savedRef = useRef(onSaved);
    keyRef.current = key; savedRef.current = onSaved;
    const requests = useRef(new Map<number, AbortController>());
    const [pending, setPending] = useState<Record<number, boolean>>({});
    const [errors, setErrors] = useState<Record<number, string | null>>({});
    useEffect(() => {
        setPending({}); setErrors({});
        const active = requests.current;
        return () => { for (const controller of active.values()) controller.abort(); active.clear(); };
    }, [key]);
    const change = async (postId: number, reaction: Reaction | null) => {
        if (requests.current.has(postId)) return;
        const controller = new AbortController(), requestedKey = key;
        requests.current.set(postId, controller); setPending(p => ({ ...p, [postId]: true })); setErrors(p => ({ ...p, [postId]: null }));
        const current = () => !controller.signal.aborted && requestedKey === keyRef.current && session === getAuthSessionId();
        try {
            const config: AuthSessionRequestConfig = { signal: controller.signal, _authSessionId: session };
            const response = reaction
                ? await apiClient.put<FeedPostDto>(`/posts/${postId}/reaction`, { reaction }, config)
                : await apiClient.delete<FeedPostDto>(`/posts/${postId}/reaction`, config);
            if (current()) savedRef.current(response.data);
        } catch (error) {
            if (current()) setErrors(p => ({ ...p, [postId]: extractApiErrorMessage(error, 'Reaction could not be saved. Your previous choice is unchanged; try again.') }));
        } finally {
            if (requests.current.get(postId) === controller) requests.current.delete(postId);
            if (current()) setPending(p => ({ ...p, [postId]: false }));
        }
    };
    return { change, pending, errors };
}
