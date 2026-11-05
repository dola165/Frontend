import { useEffect, useSyncExternalStore } from 'react';
import { getAuthSessionId, getStoredUserId, subscribeAuthSession } from '../../utils/authStorage';

export type CommentAttempt = { requestId: string; content: string; parentId?: number };
type EditDraft = { content: string; expectedVersion: number; busy?: boolean; error?: string };
type Draft = { content: string; parentId?: number; attempt?: CommentAttempt; busy?: boolean; edits?: Record<number, EditDraft | undefined> };
const empty: Draft = { content: '' };
const drafts = new Map<string, Draft>();
const listeners = new Set<() => void>();
const prefix = 'gk.post-comments.draft:';
let owner = `${getAuthSessionId()}:${getStoredUserId()}`;
const emit = () => listeners.forEach(listener => listener());
subscribeAuthSession(() => {
    const next = `${getAuthSessionId()}:${getStoredUserId()}`;
    if (next === owner) return;
    owner = next; drafts.clear();
    try { for (const key of Object.keys(sessionStorage)) if (key.startsWith(prefix)) sessionStorage.removeItem(key); } catch { /* memory only */ }
    emit();
});
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

/** One login-owned draft for feed, direct post and media; a retry keeps its original payload. */
export function useCommentDraft(postId: number) {
    const session = useSyncExternalStore(subscribeAuthSession, getAuthSessionId);
    const user = getStoredUserId();
    const key = `${prefix}${user ?? 'guest'}:${postId}`;
    const read = () => {
        const cached = drafts.get(key);
        if (cached) return cached;
        try {
            const saved = JSON.parse(sessionStorage.getItem(key) ?? 'null');
            const draft = user && saved?.session === session ? saved.draft as Draft : empty;
            drafts.set(key, draft); return draft;
        } catch { drafts.set(key, empty); return empty; }
    };
    const draft = useSyncExternalStore(subscribe, read);
    useEffect(() => () => { if (!user) drafts.delete(key); }, [key, user]);
    const change = (patch: Partial<Draft> | ((current: Draft) => Partial<Draft>)) => {
        if (session !== getAuthSessionId() || user !== getStoredUserId()) return;
        const current = read();
        const next = { ...current, ...(typeof patch === 'function' ? patch(current) : patch) };
        drafts.set(key, next);
        if (user) try {
            const edits = Object.fromEntries(Object.entries(next.edits ?? {}).map(([id, edit]) => [id, edit && { ...edit, busy: false }]));
            sessionStorage.setItem(key, JSON.stringify({ session, draft: { ...next, busy: false, edits } }));
        } catch { /* memory only */ }
        emit();
    };
    return { draft, change };
}

/** Only the owner's text and concurrency version survive a protected projection being replaced. */
export function useCommentEdit(postId: number, commentId: number) {
    const { draft, change } = useCommentDraft(postId);
    const changeEdit = (update: EditDraft | undefined | ((current: EditDraft | undefined) => EditDraft | undefined)) => {
        change(current => ({ edits: { ...current.edits, [commentId]: typeof update === 'function' ? update(current.edits?.[commentId]) : update } }));
    };
    return { edit: draft.edits?.[commentId], changeEdit };
}
