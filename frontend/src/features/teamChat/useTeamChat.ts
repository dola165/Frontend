import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { emitNotificationsChanged } from '../../utils/notifications';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { deleteMessage, editMessage, fetchChanges, fetchPage, fetchState, markRead, react, sendMessage,
    type ChatAttachment, type ChatMessage, type ChatPage, type ChatQuote, type ChatState, type ChatSummary } from './api';
import { addNewer, addOlder, applyChanges, EMPTY_WINDOW, replaceWindow, upsert, type ChatWindow } from './chatWindow';
import { connectLive, type Live } from './liveChat';
import { createOutbox, type Pending } from './outbox';
import { sharedChanged } from './sharedSignal';
import { isMissing, isPassing, problem, WRITER_FORBIDDEN } from './teamChatWords';

export type ChatStatus = 'loading' | 'ready' | 'missing' | 'error';
type Where = Parameters<typeof fetchPage>[1];
const RETRY_LIMIT = 30_000;

/**
 * One person in one chat: the messages on screen and how they stay current (the change feed, nudged by the live
 * line, on reconnect, focus, coming back online and every half minute), sending through a persistent outbox that
 * retries until the server confirms (never twice: each message keeps its key), editing, deleting, reactions,
 * reading and typing. The live line is held only while this chat is open.
 */
export function useTeamChat(chatId: number, jump: number | null) {
    const copy = useJourneyCopy();
    const [state, setState] = useState<ChatState | null>(null);
    const [status, setStatus] = useState<ChatStatus>('loading');
    const [notice, setNotice] = useState('');
    const [view, setView] = useState<ChatWindow>(EMPTY_WINDOW);
    const viewRef = useRef(view);
    const update = useCallback((change: (current: ChatWindow) => ChatWindow) => { viewRef.current = change(viewRef.current); setView(viewRef.current); }, []);
    const [outbox] = useState(() => createOutbox(chatId));
    const [pending, setPending] = useState<Pending[]>(() => outbox.list());
    const [inFlight, setInFlight] = useState<string | null>(null);
    const [connected, setConnected] = useState(false);
    const [typing, setTyping] = useState<Map<number, number>>(new Map());
    const [highlight, setHighlight] = useState<number | null>(jump);
    /** Where the unread messages started when the chat opened; the "New" line stays there. */
    const [firstUnread, setFirstUnread] = useState<number | null>(null);
    const [paging, setPaging] = useState<'older' | 'newer' | 'jump' | null>(null);
    const pagingRef = useRef(false);
    const live = useRef<Live | null>(null);
    const alive = useRef(true);
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    /** Whether the person is at the newest end (the list says); reading further up, nothing is let go. */
    const following = useRef(true);
    const follow = useCallback((value: boolean) => { following.current = value; }, []);

    const lost = useCallback((error: unknown) => { if (isMissing(error) && alive.current) setStatus('missing'); }, []);

    // ── Catching up ──────────────────────────────────────────────────────
    const syncing = useRef(false), syncAgain = useRef(false);
    const sync = useCallback(async () => {
        if (!viewRef.current.loaded) return;
        if (syncing.current) { syncAgain.current = true; return; }
        syncing.current = true;
        try {
            do {
                syncAgain.current = false;
                for (let more = true; more && alive.current;) {
                    const changes = await fetchChanges(chatId, viewRef.current.cursor);
                    if (!alive.current) return;
                    update(current => applyChanges(current, changes, following.current));
                    // Files arriving or going with these messages: the panel's Media looks again.
                    if (changes.messages.some(message => message.deleted || message.attachments.length)) sharedChanged(chatId);
                    more = changes.more;
                }
            } while (syncAgain.current && alive.current);
        } catch (error) {
            // Offline or a passing failure: the next nudge, focus or tick catches up.
            lost(error);
        } finally {
            syncing.current = false;
        }
    }, [chatId, update, lost]);

    // ── Sending ─────────────────────────────────────────────────────────
    const flushing = useRef(false);
    const retryDelay = useRef(2000);
    const retryTimer = useRef<number | undefined>(undefined);
    const flush = useCallback(async () => {
        if (flushing.current || !alive.current || !outbox.current()) return;
        flushing.current = true;
        try {
            for (const item of outbox.list()) {
                if (item.refused !== null) continue;
                setInFlight(item.key);
                try {
                    const message = await sendMessage(chatId, { content: item.content, clientMessageId: item.key, replyToId: item.replyTo?.id ?? null, attachmentIds: item.attachments.map(file => file.id) });
                    outbox.remove(item.key);
                    if (!alive.current) return;
                    setPending(outbox.list());
                    update(current => upsert(current, message));
                    if (message.attachments.length) sharedChanged(chatId);
                    retryDelay.current = 2000;
                } catch (error) {
                    if (isMissing(error)) { lost(error); return; }
                    if (isPassing(error)) {
                        // Keep the order: nothing after it goes first. Try again a little later.
                        window.clearTimeout(retryTimer.current);
                        retryTimer.current = window.setTimeout(() => void flush(), retryDelay.current);
                        retryDelay.current = Math.min(RETRY_LIMIT, retryDelay.current * 2);
                        return;
                    }
                    outbox.refuse(item.key, problem(copy, error, ['The message was not sent.', 'შეტყობინება ვერ გაიგზავნა.']));
                    if (alive.current) setPending(outbox.list());
                }
            }
        } finally {
            flushing.current = false;
            if (alive.current) setInFlight(null);
        }
    }, [chatId, outbox, update, lost, copy]);

    // A message that reached the server while its answer was lost is recognized by its key, never sent twice.
    useEffect(() => {
        const sent = new Set(view.messages.flatMap(message => message.clientMessageId ? [message.clientMessageId] : []));
        const arrived = outbox.list().filter(item => sent.has(item.key));
        if (!arrived.length) return;
        arrived.forEach(item => outbox.remove(item.key));
        setPending(outbox.list());
    }, [view.messages, outbox]);

    // ── Opening ─────────────────────────────────────────────────────────
    const opened = useRef(false);
    useEffect(() => {
        if (opened.current) return;
        opened.current = true;
        (async () => {
            try {
                const chat = await fetchState(chatId);
                const first = await fetchPage(chatId, jump ? { around: jump } : {});
                if (!alive.current) return;
                setState(chat);
                setFirstUnread(chat.unreadCount > 0 ? chat.firstUnreadId : null);
                update(() => replaceWindow(first));
                setStatus('ready');
                void sync();
                void flush();
            } catch (error) {
                if (alive.current) setStatus(isMissing(error) ? 'missing' : 'error');
            }
        })();
    }, [chatId, jump, update, sync, flush]);

    /** The chat's own facts (name, status, decision) as the list or the panel just changed them. */
    const putChat = useCallback((chat: ChatSummary) => setState(current => current ? { ...current, chat } : current), []);

    // ── The live line, and catching up whenever it may have missed something ──
    useEffect(() => {
        if (status !== 'ready') return;
        const connection = connectLive(chatId, {
            onChanged: () => void sync(),
            onTyping: (userId, isTyping) => setTyping(current => {
                const next = new Map(current);
                if (isTyping) next.set(userId, Date.now() + 6000); else next.delete(userId);
                return next;
            }),
            onConnected: open => { setConnected(open); if (open) { void sync(); void flush(); } },
        });
        live.current = connection;
        return () => { connection.close(); live.current = null; };
    }, [chatId, status, sync, flush]);

    useEffect(() => {
        const refresh = () => { if (document.visibilityState === 'visible' && navigator.onLine) { void sync(); void flush(); } };
        const timer = window.setInterval(refresh, 30_000);
        window.addEventListener('focus', refresh);
        window.addEventListener('online', refresh);
        document.addEventListener('visibilitychange', refresh);
        return () => {
            window.clearInterval(timer);
            window.clearTimeout(retryTimer.current);
            window.removeEventListener('focus', refresh);
            window.removeEventListener('online', refresh);
            document.removeEventListener('visibilitychange', refresh);
        };
    }, [sync, flush]);

    // Typing marks fade by themselves when the "stopped" signal never comes.
    useEffect(() => {
        if (!typing.size) return;
        const timer = window.setInterval(() => setTyping(current => {
            const now = Date.now();
            const next = new Map([...current].filter(([, until]) => until > now));
            return next.size === current.size ? current : next;
        }), 1000);
        return () => window.clearInterval(timer);
    }, [typing.size]);

    // ── Moving around ───────────────────────────────────────────────────
    const page = useCallback(async (kind: 'older' | 'newer' | 'jump', where: Where, apply: (current: ChatWindow, next: ChatPage) => ChatWindow) => {
        if (pagingRef.current) return;
        pagingRef.current = true;
        setPaging(kind);
        try {
            const next = await fetchPage(chatId, where);
            if (!alive.current) return;
            update(current => apply(current, next));
            void sync();
        } catch (error) {
            lost(error);
            if (alive.current) setNotice(problem(copy, error, ['Messages could not load.', 'შეტყობინებები ვერ ჩაიტვირთა.']));
        } finally {
            pagingRef.current = false;
            if (alive.current) setPaging(null);
        }
    }, [chatId, update, sync, lost, copy]);
    const loadOlder = useCallback(() => {
        const first = viewRef.current.messages[0];
        if (first && viewRef.current.hasOlder) void page('older', { before: first.id }, addOlder);
    }, [page]);
    const loadNewer = useCallback(() => {
        const last = viewRef.current.messages.at(-1);
        if (last && viewRef.current.hasNewer) void page('newer', { after: last.id }, addNewer);
    }, [page]);
    const jumpTo = useCallback((id: number) => {
        setHighlight(id);
        if (viewRef.current.messages.some(message => message.id === id)) return;
        void page('jump', { around: id }, (_, next) => replaceWindow(next));
    }, [page]);
    const jumpToLatest = useCallback(() => {
        setHighlight(null);
        if (!viewRef.current.hasNewer) return;
        void page('jump', {}, (_, next) => replaceWindow(next));
    }, [page]);

    // ── Writing ─────────────────────────────────────────────────────────
    const send = useCallback((content: string, replyTo: ChatQuote | null, attachments: ChatAttachment[]) => {
        outbox.add({ content, replyTo, attachments });
        setPending(outbox.list());
        if (viewRef.current.hasNewer) jumpToLatest();
        void flush();
    }, [outbox, flush, jumpToLatest]);
    const retry = useCallback((key: string) => { outbox.retry(key); setPending(outbox.list()); void flush(); }, [outbox, flush]);
    const discard = useCallback((key: string) => { outbox.remove(key); setPending(outbox.list()); }, [outbox]);

    const change = useCallback(async (request: Promise<ChatMessage>, what: [string, string], forbidden?: [string, string]) => {
        try {
            const message = await request;
            if (alive.current) update(current => upsert(current, message));
            return true;
        } catch (error) {
            lost(error);
            if (alive.current) setNotice(problem(copy, error, what, forbidden));
            return false;
        }
    }, [update, lost, copy]);
    const edit = useCallback((id: number, content: string) =>
        change(editMessage(chatId, id, content), ['The change was not saved.', 'ცვლილება ვერ შეინახა.'], WRITER_FORBIDDEN), [chatId, change]);
    // Its files may leave the panel's Media with it.
    const remove = useCallback((id: number) =>
        change(deleteMessage(chatId, id), ['The message was not deleted.', 'შეტყობინება ვერ წაიშალა.'], WRITER_FORBIDDEN)
            .then(done => { if (done) sharedChanged(chatId); return done; }), [chatId, change]);
    const me = state?.me ?? null;
    const toggleReaction = useCallback((message: ChatMessage, emoji: string) => {
        if (me === null) return;
        const on = !message.reactions.some(reaction => reaction.emoji === emoji && reaction.userIds.includes(me));
        // Shown at once; the server's answer replaces it, or the old one comes back.
        const reactions = on
            ? message.reactions.some(reaction => reaction.emoji === emoji)
                ? message.reactions.map(reaction => reaction.emoji === emoji ? { ...reaction, userIds: [...reaction.userIds, me] } : reaction)
                : [...message.reactions, { emoji, userIds: [me] }]
            : message.reactions.map(reaction => reaction.emoji === emoji ? { ...reaction, userIds: reaction.userIds.filter(id => id !== me) } : reaction)
                .filter(reaction => reaction.userIds.length);
        const put = (next: ChatMessage) => update(current => ({ ...current, messages: current.messages.map(known => known.id === next.id ? next : known) }));
        put({ ...message, reactions });
        void change(react(chatId, message.id, emoji, on), ['The reaction was not saved.', 'რეაქცია ვერ შეინახა.']).then(saved => { if (!saved && alive.current) put(message); });
    }, [chatId, me, update, change]);

    // ── Reading ─────────────────────────────────────────────────────────
    const readUpTo = useRef(0), reading = useRef(false);
    const read = useCallback(async (upTo: number) => {
        if (upTo <= readUpTo.current || reading.current) return;
        reading.current = true;
        try {
            await markRead(chatId, upTo);
            readUpTo.current = Math.max(readUpTo.current, upTo);
            emitNotificationsChanged();
        } catch { /* Read again on the next look. */ } finally {
            reading.current = false;
        }
    }, [chatId]);

    const lastTyping = useRef(0);
    const typingNow = useCallback((isTyping: boolean) => {
        const now = Date.now();
        if (isTyping && now - lastTyping.current < 3000) return;
        if (!isTyping && lastTyping.current === 0) return;
        lastTyping.current = isTyping ? now : 0;
        live.current?.typing(isTyping);
    }, []);

    const membersById = useMemo(() => new Map((state?.members ?? []).map(person => [person.id, person])), [state?.members]);
    const typingNames = [...typing.keys()].filter(id => id !== me).map(id => membersById.get(id)?.name).filter((name): name is string => !!name);

    return {
        chatId, state, status, notice, dismissNotice: () => setNotice(''), view, pending, inFlight, connected, typingNames, highlight, setHighlight,
        firstUnread, paging, membersById, loadOlder, loadNewer, jumpTo, jumpToLatest, send, retry, discard, edit, remove, toggleReaction, read, typingNow, putChat, follow,
    };
}
export type TeamChatModel = ReturnType<typeof useTeamChat>;
