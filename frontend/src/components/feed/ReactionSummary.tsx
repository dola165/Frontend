import { useEffect, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/axiosConfig';
import { getAuthSessionId, getStoredUserId, subscribeAuthSession } from '../../utils/authStorage';
import { MediaImage } from '../ui/MediaImage';
import { PostDialog } from './PostDialogs';
import { ALL_REACTIONS as REACTIONS, reactionDefinition, type Reaction } from './reactions';
import type { FeedPostDto } from './FeedPost';
import './reaction-summary.css';

interface Person { userId: number; name: string; avatarUrl: string | null; reaction: Reaction }
interface ReactionPage {
    people: Person[]; totalCount: number; reactionCounts: Partial<Record<Reaction, number>>;
    availableCount: number; nextCursor: number | null; hasMore: boolean;
}
type Filter = Reaction | 'ALL';
const reactionIcon = (type: Reaction, size = 20) => { const definition = reactionDefinition(type); return definition ? <definition.Icon size={size} /> : null; };
const errorMessage = 'Could not load reactions. Please try again.';

/** Remount private UI on account changes or a new reaction snapshot. No feed-wide prefetch. */
export function ReactionSummary({ post }: { post: FeedPostDto }) {
    const session = useSyncExternalStore(subscribeAuthSession, getAuthSessionId);
    const revision = JSON.stringify([post.id, post.reactionCount ?? post.likeCount, post.reactionCounts, post.myReaction]);
    return <Summary key={`${session}:${revision}`} post={post} />;
}

function Summary({ post }: { post: FeedPostDto }) {
    const [preview, setPreview] = useState(false), [dialog, setDialog] = useState(false);
    const button = useRef<HTMLButtonElement>(null), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const id = useId(), count = post.reactionCount ?? post.likeCount;
    const cancelTimer = () => { if (timer.current) clearTimeout(timer.current); };
    useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
    const show = () => { cancelTimer(); timer.current = setTimeout(() => setPreview(true), 220); };
    const hide = () => { cancelTimer(); timer.current = setTimeout(() => setPreview(false), 120); };
    const counts = post.reactionCounts ?? { LIKE: count };
    const top = REACTIONS.filter(r => (counts[r.type] ?? 0) > 0)
        .sort((a, b) => (counts[b.type] ?? 0) - (counts[a.type] ?? 0)).slice(0, 3);
    if (!count) return null;
    return <div className="post-liked-by">
        <button ref={button} type="button" className="post-liked-by-trigger" aria-haspopup="dialog"
            aria-describedby={preview && !dialog ? id : undefined}
            onPointerEnter={e => { if (e.pointerType === 'mouse') show(); }} onPointerLeave={hide}
            onFocus={show} onBlur={hide} onClick={() => { cancelTimer(); setPreview(false); setDialog(true); }}
            onKeyDown={e => { if (e.key === 'Escape' && preview) { e.preventDefault(); e.stopPropagation(); cancelTimer(); setPreview(false); } }}>
            <span className="reaction-summary-icons" aria-hidden="true">{top.map(r => <span key={r.type}><r.Icon size={20} /></span>)}</span>
            <span>Reacted by <strong>{count.toLocaleString()}</strong> {count === 1 ? 'person' : 'people'}</span>
        </button>
        {preview && !dialog && <NamesPreview postId={post.id} anchor={button} id={id}
            onEnter={cancelTimer} onLeave={hide} onDismiss={() => { cancelTimer(); setPreview(false); }} />}
        {dialog && <ReactionList post={post} onClose={() => setDialog(false)} />}
    </div>;
}

function NamesPreview({ postId, anchor, id, onEnter, onLeave, onDismiss }: {
    postId: number; anchor: RefObject<HTMLButtonElement | null>; id: string; onEnter: () => void; onLeave: () => void; onDismiss: () => void;
}) {
    const [page, setPage] = useState<ReactionPage | null>(null), [failed, setFailed] = useState(false);
    const [position, setPosition] = useState({ left: 12, top: 12 });
    const ref = useRef<HTMLDivElement>(null), session = getAuthSessionId();
    useEffect(() => {
        const controller = new AbortController();
        apiClient.get<ReactionPage>(`/posts/${postId}/reactions`, { params: { limit: 8 }, signal: controller.signal })
            .then(({ data }) => { if (!controller.signal.aborted && session === getAuthSessionId()) setPage(data); })
            .catch(() => { if (!controller.signal.aborted && session === getAuthSessionId()) setFailed(true); });
        return () => controller.abort();
    }, [postId, session]);
    useEffect(() => {
        const place = () => {
            if (!anchor.current) return;
            const rect = anchor.current.getBoundingClientRect(), height = ref.current?.offsetHeight ?? 220;
            const width = Math.min(280, window.innerWidth - 24);
            setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
                top: Math.max(12, Math.min(rect.top >= height + 16 ? rect.top - height - 8 : rect.bottom + 8, window.innerHeight - height - 12)) });
        };
        place();
        window.addEventListener('resize', place); window.addEventListener('scroll', place, true);
        const dismiss = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); onDismiss(); } };
        document.addEventListener('keydown', dismiss, true);
        return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); document.removeEventListener('keydown', dismiss, true); };
    }, [anchor, page, failed, onDismiss]);
    return createPortal(<div ref={ref} id={id} role="tooltip" className="reaction-names-preview feed-home-shell"
        style={position} onPointerEnter={onEnter} onPointerLeave={onLeave}>
        <strong>People who reacted</strong>
        {failed ? <p>{errorMessage}</p> : !page ? <p>Loading names…</p> : <>
            {page.people.map(person => <div className="reaction-preview-person" key={person.userId}><span aria-hidden="true">{reactionIcon(person.reaction)}</span><span>{person.name}</span></div>)}
            {page.hasMore && <p>and {(page.availableCount - page.people.length).toLocaleString()} more</p>}
            {page.availableCount < page.totalCount && <p>Some profiles are unavailable.</p>}
            {!page.totalCount && <p>No reactions yet.</p>}
            <small>Click to see all reactions</small>
        </>}
    </div>, document.body);
}

function PersonAvatar({ person }: { person: Person }) {
    const [failed, setFailed] = useState(false);
    return <span className="reactor-avatar">
        {person.avatarUrl && !failed ? <MediaImage src={person.avatarUrl} alt="" onError={() => setFailed(true)} /> : <span>{person.name.slice(0, 2).toUpperCase()}</span>}
        <span className="reactor-badge" aria-hidden="true">{reactionIcon(person.reaction)}</span>
    </span>;
}

function ReactionList({ post, onClose }: { post: FeedPostDto; onClose: () => void }) {
    const [filter, setFilter] = useState<Filter>('ALL'), [page, setPage] = useState<ReactionPage | null>(null);
    const [counts, setCounts] = useState(post.reactionCounts ?? { LIKE: post.reactionCount ?? post.likeCount });
    const [total, setTotal] = useState(post.reactionCount ?? post.likeCount);
    const [busy, setBusy] = useState(true), [failed, setFailed] = useState(false), [unavailable, setUnavailable] = useState(false);
    const [request, setRequest] = useState<{ filter: Filter; cursor: number | null; retry: number }>({ filter: 'ALL', cursor: null, retry: 0 });
    const tabs = useRef<HTMLDivElement>(null), id = useId(), session = getAuthSessionId();
    const viewer = Number(getStoredUserId());
    useEffect(() => {
        const controller = new AbortController();
        apiClient.get<ReactionPage>(`/posts/${post.id}/reactions`, {
            params: { limit: 20, ...(request.filter !== 'ALL' ? { reaction: request.filter } : {}), ...(request.cursor ? { cursor: request.cursor } : {}) }, signal: controller.signal,
        }).then(({ data }) => {
            if (controller.signal.aborted || session !== getAuthSessionId()) return;
            setPage(previous => ({ ...data, people: request.cursor && previous
                ? [...previous.people, ...data.people.filter(person => !previous.people.some(p => p.userId === person.userId))] : data.people }));
            setCounts(data.reactionCounts); setTotal(data.totalCount); setBusy(false);
        }).catch(error => {
            if (controller.signal.aborted || session !== getAuthSessionId()) return;
            if ([401, 403, 404].includes(error?.response?.status)) { setPage(null); setCounts({}); setUnavailable(true); }
            setFailed(true); setBusy(false);
        });
        return () => controller.abort();
    }, [post.id, request, session]);
    const select = (next: Filter) => {
        if (next === filter) return;
        setFilter(next); setPage(null); setFailed(false); setBusy(true);
        setRequest({ filter: next, cursor: null, retry: 0 });
    };
    const keys = (event: KeyboardEvent) => {
        const items = Array.from(tabs.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? []);
        const index = items.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === 'ArrowRight' ? (index + 1) % items.length : event.key === 'ArrowLeft' ? (index - 1 + items.length) % items.length : event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : null;
        if (next !== null) { event.preventDefault(); items[next]?.focus(); items[next]?.click(); }
    };
    const selectedCount = filter === 'ALL' ? total : counts[filter] ?? 0;
    return <PostDialog title="Reactions" onClose={onClose}>
        <div className="reactors-content">
            <div ref={tabs} className="reactors-tabs" role="tablist" aria-label="Filter reactions" onKeyDown={keys}>
                {(['ALL', ...REACTIONS.filter(r => (counts[r.type] ?? 0) > 0 || r.type === filter)
                    .sort((a, b) => (counts[b.type] ?? 0) - (counts[a.type] ?? 0)).map(r => r.type)] as Filter[]).map(type => {
                    const label = type === 'ALL' ? 'All' : REACTIONS.find(r => r.type === type)!.label;
                    return <button key={type} type="button" role="tab" id={`${id}-${type}`} aria-controls={`${id}-people`}
                        aria-selected={filter === type} tabIndex={filter === type ? 0 : -1} aria-label={`${label}, ${type === 'ALL' ? total : counts[type] ?? 0} reactions`}
                        onClick={() => select(type)}>{type === 'ALL' ? 'All' : <span aria-hidden="true">{reactionIcon(type)}</span>}<span>{type === 'ALL' ? total : counts[type] ?? 0}</span></button>;
                })}
            </div>
            <div id={`${id}-people`} role="tabpanel" aria-labelledby={`${id}-${filter}`} aria-busy={busy} tabIndex={0} className="reactors-panel">
                {page && <ul className="reactors-list">{page.people.map(person => <li key={person.userId}>
                    <Link to={`/profile/${person.userId}`} onClick={onClose}><PersonAvatar person={person} /><span><strong>{person.name}</strong><small>{person.userId === viewer ? 'You · ' : ''}{REACTIONS.find(r => r.type === person.reaction)?.label}</small></span><span className="reactor-profile-hint" aria-hidden="true">View profile</span></Link>
                </li>)}</ul>}
                {busy && <p role="status" className="reactors-message">Loading reactions…</p>}
                {failed && <div role="alert" className="reactors-message">{unavailable ? 'This post is no longer available to you.' : errorMessage}{!unavailable && <button className="post-secondary" type="button" onClick={() => { setFailed(false); setBusy(true); setRequest(previous => ({ ...previous, retry: previous.retry + 1 })); }}>Retry</button>}</div>}
                {!busy && !failed && page && !page.people.length && <p className="reactors-message">No {filter === 'ALL' ? '' : `${REACTIONS.find(r => r.type === filter)?.label.toLowerCase()} `}reactions to show.</p>}
                {page && page.availableCount < selectedCount && <p className="reactors-message">Some profiles are unavailable.</p>}
                {page?.hasMore && !busy && !failed && <button type="button" className="post-secondary reactors-more" onClick={() => { setBusy(true); setRequest({ filter, cursor: page.nextCursor, retry: 0 }); }}>Show more</button>}
            </div>
        </div>
    </PostDialog>;
}
