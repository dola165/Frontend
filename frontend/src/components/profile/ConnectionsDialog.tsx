import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Loader2, Search, Users, X } from 'lucide-react';
import { apiClient } from '../../api/axiosConfig';
import type { PageResult } from '../../api/chat';
import { MediaImage } from '../ui/MediaImage';
import { useDialogFocus } from '../workspace/useDialogFocus';
import { usePanelMotion } from '../ui/usePanelMotion';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import { extractApiErrorMessage } from '../../utils/apiError';

interface Connection { id: number; username: string; fullName: string | null; avatarUrl: string | null }
interface Props {
    userId: number;
    kind: 'followers' | 'following';
    onClose: () => void;
    showFollowingStatus?: boolean;
}

export function ConnectionsDialog({ userId, kind, onClose: finishClose, showFollowingStatus = false }: Props) {
    const motion = usePanelMotion(finishClose);
    const onClose = motion.close;
    const dialogRef = useRef<HTMLDivElement>(null);
    const controllerRef = useRef<AbortController | null>(null);
    const [people, setPeople] = useState<Connection[]>([]);
    const [page, setPage] = useState(0);
    const [more, setMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    useDialogFocus(true, dialogRef, onClose);
    const load = useCallback(async (nextPage: number) => {
        controllerRef.current?.abort();
        const controller = new AbortController();
        controllerRef.current = controller;
        setLoading(true);
        setError(null);
        try {
            const { data } = await apiClient.get<PageResult<Connection>>(`/users/${userId}/${kind}`, {
                params: { page: nextPage, size: 20 }, signal: controller.signal,
            });
            if (controller.signal.aborted) return;
            setPeople(current => {
                const entries = nextPage === 0 ? data.content : [...current, ...data.content];
                return Array.from(new Map(entries.map(person => [person.id, person])).values());
            });
            setPage(nextPage);
            setMore((nextPage + 1) * data.pageSize < data.totalElements);
        } catch (cause) {
            if (!controller.signal.aborted) setError(extractApiErrorMessage(cause, 'Connections could not load. Please try again.'));
        } finally {
            if (!controller.signal.aborted) setLoading(false);
        }
    }, [userId, kind]);
    useEffect(() => {
        void load(0);
        return () => controllerRef.current?.abort();
    }, [load]);
    const visiblePeople = useMemo(() => {
        const normalizedQuery = query.trim().toLocaleLowerCase();
        if (!normalizedQuery) return people;
        return people.filter(person =>
            person.username.toLocaleLowerCase().includes(normalizedQuery)
            || person.fullName?.toLocaleLowerCase().includes(normalizedQuery),
        );
    }, [people, query]);

    return createPortal(
        <div className="app-motion-portal app-motion-backdrop fixed inset-0 z-[10000] flex items-center justify-center bg-[color:var(--color-overlay)]/75 p-4 backdrop-blur-[2px]" data-closing={motion.closing} onClick={onClose}>
            <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="connections-title"
                onClick={event => event.stopPropagation()}
                className="app-motion-dialog flex min-h-[min(360px,80dvh)] max-h-[min(560px,80dvh)] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-2xl" data-closing={motion.closing} onAnimationEnd={motion.onAnimationEnd}>
                <div className="grid min-h-[54px] grid-cols-[44px_1fr_44px] items-center border-b border-[var(--border-subtle)] px-3">
                    <span aria-hidden="true" />
                    <h2 id="connections-title" className="text-center text-base font-semibold">{kind === 'followers' ? 'Followers' : 'Following'}</h2>
                    <button type="button" aria-label="Close connections" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-[color:var(--color-ink)]/10"><X className="h-6 w-6" /></button>
                </div>
                <div className="px-4 pb-2 pt-3">
                    <label className="flex h-10 items-center gap-2 rounded-xl bg-[color:var(--color-ink)]/[0.08] px-3 text-[var(--text-secondary)] focus-within:ring-2 focus-within:ring-[color:var(--color-accent)]/70">
                        <Search className="h-4 w-4 shrink-0" />
                        <span className="sr-only">Search connections</span>
                        <input
                            type="search"
                            value={query}
                            onChange={event => setQuery(event.target.value)}
                            placeholder="Search"
                            className="h-full min-w-0 flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)]"
                        />
                    </label>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3" aria-busy={loading}>
                    <ul>
                        {visiblePeople.map(person => <li key={person.id}>
                            <div className="flex min-h-[68px] items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-[color:var(--color-ink)]/[0.04]">
                                <Link to={`/profile/${person.id}`} onClick={onClose} aria-label={`View ${person.fullName || person.username}'s profile`} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-[color:var(--color-accent)]">
                                <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)] ring-1 ring-[color:var(--color-border)]/10">
                                    {person.avatarUrl ? <MediaImage src={resolveMediaUrl(person.avatarUrl)} alt="" className="h-full w-full object-cover" /> : <Users className="h-5 w-5" />}
                                </span>
                                <span className="min-w-0"><span className="block truncate text-sm font-semibold">{person.username}</span><span className="block truncate text-sm text-[var(--text-secondary)]">{person.fullName || `@${person.username}`}</span></span>
                                </Link>
                                {showFollowingStatus && kind === 'following' && <span className="shrink-0 rounded-lg bg-[color:var(--color-ink)]/[0.07] px-4 py-2 text-sm font-semibold">Following</span>}
                            </div>
                        </li>)}
                    </ul>
                    {!loading && !error && people.length === 0 && <p role="status" className="px-2 py-12 text-center text-sm text-[var(--text-secondary)]">{kind === 'following' ? 'No followed people to show yet.' : 'No followers to show yet.'}</p>}
                    {!loading && !error && people.length > 0 && visiblePeople.length === 0 && <p role="status" className="px-2 py-12 text-center text-sm text-[var(--text-secondary)]">No connections match “{query.trim()}”.</p>}
                    {loading && <p role="status" className="flex items-center justify-center gap-2 py-5 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Loading connections…</p>}
                    {error && <div role="alert" className="px-2 py-4 text-sm"><p>{error}</p><button type="button" onClick={() => void load(people.length ? page + 1 : 0)} className="mt-3 rounded-full border px-4 py-2">Retry connections</button></div>}
                    {!loading && !error && more && <button type="button" onClick={() => void load(page + 1)} className="my-3 w-full rounded-full border border-[var(--border-subtle)] py-2.5 text-sm font-semibold">Load more people</button>}
                </div>
            </div>
        </div>, document.body,
    );
}
