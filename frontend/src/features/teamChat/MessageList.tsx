import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Loader2 } from 'lucide-react';
import { Skeleton } from '../../design/primitives';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { rowsOf } from './chatRows';
import { MessageRow, PendingRow, type RowActions } from './MessageRow';
import { dayTitle } from './teamChatWords';
import type { TeamChatModel } from './useTeamChat';
import { useVirtualRows } from './virtualRows';
import { VirtualRow } from './VirtualRow';

/** Where a message sits in the list before it changes, so it is put back exactly there afterwards. */
interface Anchor { id: string; offset: number }
const anchorOf = (list: HTMLElement): Anchor | null => {
    const top = list.getBoundingClientRect().top;
    const first = [...list.querySelectorAll<HTMLElement>('[data-row-id]')].find(row => row.getBoundingClientRect().bottom > top);
    return first?.dataset.rowId ? { id: first.dataset.rowId, offset: first.getBoundingClientRect().top - top } : null;
};

/**
 * The conversation: scrolls by itself only while you are at the bottom, keeps its place when messages load or are let
 * go above or below, says where the unread messages start, and reads what you have seen (at the bottom, page in
 * front). Only messages near the visible part are drawn (see useVirtualRows); the model holds a few pages at most.
 */
export function MessageList({ model, actions, active }: { model: TeamChatModel; actions: RowActions; active: boolean }) {
    const copy = useJourneyCopy();
    const { view, pending, state, firstUnread, highlight, membersById, inFlight } = model;
    const list = useRef<HTMLDivElement>(null);
    const virtual = useVirtualRows(list);
    const atBottom = useRef(true);
    const anchor = useRef<Anchor | null>(null);
    const placed = useRef(false);
    const [away, setAway] = useState(false);
    const [unreadAbove, setUnreadAbove] = useState(false);
    const me = state?.me ?? null;
    const rows = useMemo(() => rowsOf(view.messages, firstUnread, value => dayTitle(copy, value)), [view.messages, firstUnread, copy]);
    const lastId = view.messages.at(-1)?.id ?? 0;
    const showPending = !view.hasNewer;
    const chatName = state?.chat.name ?? '';

    const { read, follow } = model;
    const readIfSeen = useCallback(() => {
        const element = list.current;
        if (!element || view.hasNewer || !lastId || document.visibilityState !== 'visible' || !document.hasFocus()) return;
        if (element.scrollHeight - element.scrollTop - element.clientHeight < 80) void read(lastId);
    }, [view.hasNewer, lastId, read]);

    const measure = useCallback(() => {
        const element = list.current;
        if (!element) return;
        atBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
        // New messages keep coming into the list only while you are at its newest end.
        follow(atBottom.current && !view.hasNewer);
        setAway(!atBottom.current || view.hasNewer);
        const line = element.querySelector<HTMLElement>('[data-unread-line]');
        setUnreadAbove(firstUnread !== null && (!line
            ? view.messages.length > 0 && view.messages[0].id > firstUnread
            : line.getBoundingClientRect().top < element.getBoundingClientRect().top));
        readIfSeen();
    }, [view.hasNewer, view.messages, firstUnread, readIfSeen, follow]);

    const { loadOlder, loadNewer } = model;
    const older = useCallback(() => { if (list.current) anchor.current = anchorOf(list.current); loadOlder(); }, [loadOlder]);
    const newer = useCallback(() => { if (list.current) anchor.current = anchorOf(list.current); loadNewer(); }, [loadNewer]);
    const onScroll = () => {
        const element = list.current;
        if (!element) return;
        if (element.scrollTop < 240 && view.hasOlder && !model.paging) older();
        if (element.scrollHeight - element.scrollTop - element.clientHeight < 240 && view.hasNewer && !model.paging) newer();
        measure();
    };

    // Where the view sits after messages change: kept in place around the message that was at the top, followed at
    // the bottom, or placed on first load (first shown: a chat opened behind another view is placed when shown).
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
        const kept = anchor.current;
        if (kept) {
            anchor.current = null;
            const row = element.querySelector<HTMLElement>(`[data-row-id="${kept.id}"]`);
            if (row) element.scrollTop += row.getBoundingClientRect().top - element.getBoundingClientRect().top - kept.offset;
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
        follow(true);
    }, [pendingCount, follow]);

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
        {unreadAbove && <button type="button" className="tc-pill tc-pill--top" onClick={toUnread}>
            <ArrowUp aria-hidden="true" />{copy(`${unreadCount} new · jump to the first`, `${unreadCount} ახალი · პირველზე გადასვლა`)}
        </button>}
        <div ref={list} className="tc-list" role="log" aria-label={copy(`Messages in ${chatName}`, `შეტყობინებები: ${chatName}`)} onScroll={onScroll}>
            {!view.loaded && <div className="tc-list__loading" role="status" aria-label={copy('Loading', 'იტვირთება')}>
                <Skeleton height={44} /><Skeleton height={44} /><Skeleton height={44} />
            </div>}
            {view.loaded && view.hasOlder && <button type="button" className="tc-more" disabled={model.paging === 'older'} onClick={older}>
                {model.paging === 'older' ? <Loader2 className="tc-spin" aria-hidden="true" /> : null}{copy('Earlier messages', 'ძველი შეტყობინებები')}
            </button>}
            {view.loaded && !view.hasOlder && view.messages.length > 0 && <p className="tc-start">
                {copy(`This is where “${chatName}” begins.`, `აქ იწყება „${chatName}“.`)}
            </p>}
            {view.loaded && !view.messages.length && !pending.length && <div className="tc-empty">
                <p className="tc-empty__title">{copy('No messages yet', 'შეტყობინებები ჯერ არ არის')}</p>
                <p>
                    {copy('Write the first one, mention someone with @, or name a task like GK-12.',
                        'დაწერეთ პირველი, მოიხსენიეთ ვინმე @-ით ან დაასახელეთ საქმე, მაგ. GK-12.')}
                </p>
            </div>}
            {rows.map(row => row.kind === 'day'
                ? <h3 key={row.key} className="tc-day"><span>{row.label}</span></h3>
                : row.kind === 'unread'
                    ? <div key={row.key} className="tc-unread" data-unread-line=""><span>{copy('New', 'ახალი')}</span></div>
                    : <VirtualRow key={row.key} id={row.message.id} rows={virtual} keep={row.message.id === highlight}>
                        <MessageRow message={row.message} compact={row.compact} me={me} members={membersById} reactions={state?.reactions ?? []}
                            canModerate={!!state?.canModerate} conversationId={model.chatId} highlighted={row.message.id === highlight}
                            actions={actions} readOnly={!!state?.chat.deletesAt} />
                    </VirtualRow>)}
            {view.hasNewer && <button type="button" className="tc-more" disabled={model.paging === 'newer'} onClick={newer}>
                {copy('Later messages', 'შემდეგი შეტყობინებები')}
            </button>}
            {showPending && pending.map(item => <PendingRow key={item.key} item={item} sending={inFlight === item.key}
                me={me !== null ? membersById.get(me) : undefined} onRetry={() => model.retry(item.key)} onDiscard={() => model.discard(item.key)} />)}
        </div>
        {away && <button type="button" className="tc-pill tc-pill--bottom" onClick={toBottom}>
            <ArrowDown aria-hidden="true" />{view.hasNewer ? copy('Jump to the newest', 'უახლესზე გადასვლა') : copy('Newest', 'უახლესი')}
        </button>}
    </div>;
}
