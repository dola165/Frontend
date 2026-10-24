import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Loader2 } from 'lucide-react';
import { Skeleton } from '../../design/primitives';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { rowsOf } from './chatRows';
import { MessageRow, PendingRow, type RowActions } from './MessageRow';
import { dayTitle } from './teamChatWords';
import type { TeamChatModel } from './useTeamChat';

/**
 * The conversation: scrolls by itself only while you are at the bottom, keeps its place when older messages load
 * above, says where the unread messages start, and reads what you have seen (at the bottom, page in front).
 */
export function MessageList({ model, actions, active }: { model: TeamChatModel; actions: RowActions; active: boolean }) {
    const copy = useJourneyCopy();
    const { view, pending, state, firstUnread, highlight, membersById, inFlight } = model;
    const list = useRef<HTMLDivElement>(null);
    const atBottom = useRef(true);
    const anchor = useRef<{ height: number; top: number } | null>(null);
    const placed = useRef(false);
    const [away, setAway] = useState(false);
    const [unreadAbove, setUnreadAbove] = useState(false);
    const me = state?.me ?? null;
    const rows = useMemo(() => rowsOf(view.messages, firstUnread, value => dayTitle(copy, value)), [view.messages, firstUnread, copy]);
    const lastId = view.messages.at(-1)?.id ?? 0;
    const showPending = !view.hasNewer;

    const read = model.read;
    const readIfSeen = useCallback(() => {
        const element = list.current;
        if (!element || view.hasNewer || !lastId || document.visibilityState !== 'visible' || !document.hasFocus()) return;
        if (element.scrollHeight - element.scrollTop - element.clientHeight < 80) void read(lastId);
    }, [view.hasNewer, lastId, read]);

    const measure = useCallback(() => {
        const element = list.current;
        if (!element) return;
        atBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
        setAway(!atBottom.current || view.hasNewer);
        const line = element.querySelector<HTMLElement>('[data-unread-line]');
        setUnreadAbove(firstUnread !== null && (!line ? view.messages.length > 0 && view.messages[0].id > firstUnread : line.getBoundingClientRect().top < element.getBoundingClientRect().top));
        readIfSeen();
    }, [view.hasNewer, view.messages, firstUnread, readIfSeen]);

    const { loadOlder, loadNewer } = model;
    const onScroll = () => {
        const element = list.current;
        if (!element) return;
        if (element.scrollTop < 240 && view.hasOlder && !model.paging) { anchor.current = { height: element.scrollHeight, top: element.scrollTop }; loadOlder(); }
        if (element.scrollHeight - element.scrollTop - element.clientHeight < 240 && view.hasNewer && !model.paging) loadNewer();
        measure();
    };

    // Where the view sits after messages change: kept in place above, followed at the bottom, or placed on first load
    // (first shown: a page opened on Media places the chat when it is opened).
    useLayoutEffect(() => {
        const element = list.current;
        if (!element || !view.loaded || !active) return;
        if (!placed.current) {
            placed.current = true;
            const target = (highlight && element.querySelector<HTMLElement>(`#tc-m-${highlight}`)) || element.querySelector<HTMLElement>('[data-unread-line]');
            if (target) { element.scrollTop = Math.max(0, target.offsetTop - element.clientHeight / 3); atBottom.current = false; }
            else element.scrollTop = element.scrollHeight;
            return;
        }
        if (anchor.current) {
            element.scrollTop = anchor.current.top + (element.scrollHeight - anchor.current.height);
            anchor.current = null;
        } else if (atBottom.current) element.scrollTop = element.scrollHeight;
    }, [view.messages, view.loaded, pending, highlight, active]);

    // A jump (a reply, a search result, a link) brings its message into view and gives it focus, once it can be seen.
    useEffect(() => {
        if (!highlight || !placed.current || !active) return;
        const target = list.current?.querySelector<HTMLElement>(`#tc-m-${highlight}`);
        if (!target) return;
        target.scrollIntoView?.({ block: 'center' });
        target.focus({ preventScroll: true });
        atBottom.current = false;
    }, [highlight, view.messages, active]);

    // When the box below grows (files, a reply, more lines), the newest message stays in sight if it was.
    useEffect(() => {
        const element = list.current;
        if (!element || typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(() => { if (atBottom.current) element.scrollTop = element.scrollHeight; });
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    // Your own new message always shows, wherever you were.
    const pendingCount = pending.length;
    useLayoutEffect(() => {
        if (!pendingCount || !list.current) return;
        list.current.scrollTop = list.current.scrollHeight;
        atBottom.current = true;
    }, [pendingCount]);

    useEffect(() => {
        const frame = requestAnimationFrame(measure);
        window.addEventListener('focus', measure);
        document.addEventListener('visibilitychange', measure);
        return () => { cancelAnimationFrame(frame); window.removeEventListener('focus', measure); document.removeEventListener('visibilitychange', measure); };
    }, [measure]);

    const toBottom = () => {
        if (view.hasNewer) { model.jumpToLatest(); atBottom.current = true; return; }
        list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' });
        model.setHighlight(null);
    };
    const toUnread = () => {
        if (firstUnread === null) return;
        const line = list.current?.querySelector<HTMLElement>('[data-unread-line]');
        if (line && list.current) list.current.scrollTop = Math.max(0, line.offsetTop - 16);
        else model.jumpTo(firstUnread);
    };

    const unreadCount = state?.unreadCount ?? 0;
    return <div className="tc-list-wrap">
        {unreadAbove && <button type="button" className="tc-pill tc-pill--top" onClick={toUnread}><ArrowUp aria-hidden="true" />{copy(`${unreadCount} new · jump to the first`, `${unreadCount} ახალი · პირველზე გადასვლა`)}</button>}
        <div ref={list} className="tc-list" role="log" aria-label={copy('Team chat messages', 'გუნდის ჩატის შეტყობინებები')} onScroll={onScroll}>
            {!view.loaded && <div className="tc-list__loading" role="status" aria-label={copy('Loading', 'იტვირთება')}><Skeleton height={44} /><Skeleton height={44} /><Skeleton height={44} /></div>}
            {view.loaded && view.hasOlder && <button type="button" className="tc-more" disabled={model.paging === 'older'} onClick={() => { const element = list.current; if (element) anchor.current = { height: element.scrollHeight, top: element.scrollTop }; loadOlder(); }}>
                {model.paging === 'older' ? <Loader2 className="tc-spin" aria-hidden="true" /> : null}{copy('Earlier messages', 'ძველი შეტყობინებები')}
            </button>}
            {view.loaded && !view.hasOlder && view.messages.length > 0 && <p className="tc-start">{copy('This is where the team chat begins.', 'აქ იწყება გუნდის ჩატი.')}</p>}
            {view.loaded && !view.messages.length && !pending.length && <div className="tc-empty"><p className="tc-empty__title">{copy('No messages yet', 'შეტყობინებები ჯერ არ არის')}</p><p>{copy('Write to the team, mention someone with @, or name a task like GK-12.', 'მისწერეთ გუნდს, მოიხსენიეთ ვინმე @-ით ან დაასახელეთ საქმე, მაგ. GK-12.')}</p></div>}
            {rows.map(row => row.kind === 'day'
                ? <h3 key={row.key} className="tc-day"><span>{row.label}</span></h3>
                : row.kind === 'unread'
                    ? <div key={row.key} className="tc-unread" data-unread-line=""><span>{copy('New', 'ახალი')}</span></div>
                    : <MessageRow key={row.key} message={row.message} compact={row.compact} me={me} members={membersById} reactions={state?.reactions ?? []}
                        canModerate={!!state?.canModerate} conversationId={state?.conversationId ?? 0} highlighted={row.message.id === highlight} actions={actions} />)}
            {view.hasNewer && <button type="button" className="tc-more" disabled={model.paging === 'newer'} onClick={loadNewer}>{copy('Later messages', 'შემდეგი შეტყობინებები')}</button>}
            {showPending && pending.map(item => <PendingRow key={item.key} item={item} sending={inFlight === item.key} me={me !== null ? membersById.get(me) : undefined}
                onRetry={() => model.retry(item.key)} onDiscard={() => model.discard(item.key)} />)}
        </div>
        {away && <button type="button" className="tc-pill tc-pill--bottom" onClick={toBottom}><ArrowDown aria-hidden="true" />{view.hasNewer ? copy('Jump to the newest', 'უახლესზე გადასვლა') : copy('Newest', 'უახლესი')}</button>}
    </div>;
}
