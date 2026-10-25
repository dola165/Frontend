import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Loader2 } from 'lucide-react';
import { Skeleton } from '../../design/primitives';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { rowsOf } from './chatRows';
import { MessageRow, PendingRow, type RowActions } from './MessageRow';
import { lastSeen, unseenBelow } from './reading';
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
/** Puts the message an anchor names back where it was. */
const restore = (list: HTMLElement, kept: Anchor) => {
    const row = list.querySelector<HTMLElement>(`[data-row-id="${kept.id}"]`);
    if (row) list.scrollTop += row.getBoundingClientRect().top - list.getBoundingClientRect().top - kept.offset;
};
/** The newest message that has been on screen in this list. */
const seenIn = (list: HTMLElement) => lastSeen([...list.querySelectorAll<HTMLElement>('[data-row-id]')]
    .map(row => ({ id: Number(row.dataset.rowId), top: row.getBoundingClientRect().top })), list.getBoundingClientRect().bottom);

/**
 * The conversation: stays at the bottom while you are there (new messages, pictures loading, the box below growing),
 * keeps your place exactly while you read further up (new messages then wait behind "N new messages"), says where the
 * unread messages start, and marks read what has been on screen (page in front). A message jumped to is brought into
 * view once. Only messages near the visible part are drawn (see useVirtualRows); the model holds a few pages at most.
 */
export function MessageList({ model, actions, active }: { model: TeamChatModel; actions: RowActions; active: boolean }) {
    const copy = useJourneyCopy();
    const { view, pending, state, firstUnread, highlight, membersById, inFlight } = model;
    const list = useRef<HTMLDivElement>(null);
    const content = useRef<HTMLDivElement>(null);
    const virtual = useVirtualRows(list);
    const atBottom = useRef(true);
    const anchor = useRef<Anchor | null>(null);
    /** Where the person is reading while away from the bottom, so a change of heights never moves it. */
    const reading = useRef<Anchor | null>(null);
    const placed = useRef(false);
    /** The message last jumped to, once it has been brought into view. */
    const shownJump = useRef<number | null>(null);
    /** The newest message that has been on screen. */
    const seenTo = useRef(0);
    const [away, setAway] = useState(false);
    const [unreadAbove, setUnreadAbove] = useState(false);
    const [newBelow, setNewBelow] = useState(0);
    const me = state?.me ?? null;
    const rows = useMemo(() => rowsOf(view.messages, firstUnread, value => dayTitle(copy, value), view.hasOlder), [view.messages, firstUnread, copy, view.hasOlder]);
    const lastId = view.messages.at(-1)?.id ?? 0;
    const showPending = !view.hasNewer;
    const chatName = state?.chat.name ?? '';

    const { read, follow } = model;
    // What has been on screen is seen; with the page in front it is read, wherever in the chat it is.
    const readIfSeen = useCallback(() => {
        const element = list.current;
        if (!element || !lastId || document.visibilityState !== 'visible') return;
        const seen = seenIn(element);
        if (seen === null) return;
        seenTo.current = Math.max(seenTo.current, seen);
        if (document.hasFocus()) read(seen);
    }, [lastId, read]);

    const { loadOlder, loadNewer, paging } = model;
    const older = useCallback(() => { if (list.current) anchor.current = anchorOf(list.current); loadOlder(); }, [loadOlder]);
    const newer = useCallback(() => { if (list.current) anchor.current = anchorOf(list.current); loadNewer(); }, [loadNewer]);

    const measure = useCallback(() => {
        const element = list.current;
        if (!element) return;
        // Near an end with more beyond it, the next page comes in (also when the part shown is shorter than the list).
        const below = element.scrollHeight - element.scrollTop - element.clientHeight;
        if (view.loaded && !paging && element.scrollTop < 240 && view.hasOlder) older();
        else if (view.loaded && !paging && below < 240 && view.hasNewer) newer();
        // At the bottom = at the newest end of the chat, where new messages keep coming in and stay in view.
        atBottom.current = below < 80 && !view.hasNewer;
        reading.current = atBottom.current ? null : anchorOf(element);
        follow(atBottom.current);
        setAway(!atBottom.current);
        const line = element.querySelector<HTMLElement>('[data-unread-line]');
        setUnreadAbove(firstUnread !== null && (!line
            ? view.messages.length > 0 && view.messages[0].id > firstUnread
            : line.getBoundingClientRect().top < element.getBoundingClientRect().top));
        readIfSeen();
        setNewBelow(unseenBelow(view.messages, seenTo.current, me));
    }, [view.loaded, view.hasOlder, view.hasNewer, view.messages, paging, older, newer, firstUnread, readIfSeen, follow, me]);

    const onScroll = measure;

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
            restore(element, kept);
        } else if (atBottom.current) element.scrollTop = element.scrollHeight;
        else if (reading.current) restore(element, reading.current);
    }, [view.messages, view.loaded, pending, highlight, active]);

    // A jump (a reply, a search result, a link) brings its message into view and gives it focus, once it can be seen,
    // and only once: new messages arriving afterwards never pull the view back to it.
    useEffect(() => {
        if (!highlight) { shownJump.current = null; return; }
        if (!placed.current || !active || shownJump.current === highlight) return;
        const target = list.current?.querySelector<HTMLElement>(`#tc-m-${highlight}`);
        if (!target) return;
        shownJump.current = highlight;
        target.scrollIntoView?.({ block: 'center' });
        target.focus({ preventScroll: true });
        atBottom.current = false;
    }, [highlight, view.messages, active]);

    // When heights change (pictures loading, the box below growing, the window resized), the newest message stays in
    // sight if it was, and otherwise the message being read stays exactly where it was.
    useEffect(() => {
        const element = list.current, inner = content.current;
        if (!element || !inner || typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(() => {
            if (atBottom.current) element.scrollTop = element.scrollHeight;
            else if (reading.current) restore(element, reading.current);
        });
        observer.observe(element);
        observer.observe(inner);
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
    const newest = newBelow > 0
        ? copy(newBelow === 1 ? '1 new message' : `${newBelow} new messages`, `${newBelow} ახალი შეტყობინება`)
        : view.hasNewer ? copy('Jump to the newest', 'უახლესზე გადასვლა') : copy('Newest', 'უახლესი');
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
            <div ref={content}>
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
        </div>
        {away && <button type="button" className="tc-pill tc-pill--bottom" data-new={newBelow > 0 || undefined} onClick={toBottom}>
            {newest}<ArrowDown aria-hidden="true" />
        </button>}
    </div>;
}
