import { useCallback, useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import { createMessageRecovery } from '../../components/chat/messageRecovery';
import { useMessageDraft } from '../../components/chat/useMessageDraft';
import { extractApiErrorMessage } from '../../utils/apiError';
import { subscribeNotificationsChanged } from '../../utils/notifications';
import * as api from './api';
import { useJourneyCopy } from './journeyCopy';

const denied = (error: unknown) => [401, 403, 404].includes((error as { response?: { status?: number } }).response?.status ?? 0);
const merge = (rows: api.SquadMessage[], added: api.SquadMessage[]) =>
    [...new Map([...rows, ...added].map(row => [row.id, row])).values()].sort((a, b) => b.id - a.id);

/** Mounted for one login, squad and thread. Every asynchronous result must still own that scope. */
export function useSquadConversation({ space, kind, thread, room, readOnly, onSent, follow }: {
    space: api.SquadOverview; kind: 'CHAT' | 'ANNOUNCEMENT'; thread: number | null; room: api.SquadRoom | null;
    readOnly: boolean; onSent: () => void; follow: RefObject<boolean>;
}) {
    const copy = useJourneyCopy();
    const key = `squad:${space.id}:${kind}:${thread ?? 'group'}${room ? `:${room}` : ''}`;
    const [recovery] = useState(createMessageRecovery);
    const { input: body, setInput: setBody, confirmDraft } = useMessageDraft(key);
    const [rows, setRows] = useState<api.SquadMessage[]>([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [more, setMore] = useState(false);
    const [hasOlder, setHasOlder] = useState(false);
    const [unavailable, setUnavailable] = useState(false);
    const alive = useRef(false), revoked = useRef(false), sending = useRef(false), fetching = useRef(false);
    const latest = useRef(0), oldest = useRef(0), epoch = useRef(0);
    const reads = useRef<AbortController | null>(null);
    const backfill = useRef<{ newest: number; rows: api.SquadMessage[]; batch: api.SquadMessage[] } | null>(null);
    const onSentRef = useRef(onSent);
    onSentRef.current = onSent;
    const current = useCallback(() => alive.current && recovery.current() && !revoked.current, [recovery]);
    const fail = useCallback((cause: unknown) => {
        if (!current()) return;
        if (denied(cause)) {
            revoked.current = true;
            epoch.current++;
            setRows([]);
            setHasOlder(false);
            setUnavailable(true);
            setError(copy('This conversation is no longer available.', 'ეს მიმოწერა აღარ არის ხელმისაწვდომი.'));
        } else setError(extractApiErrorMessage(cause, copy('Could not confirm this request. Your draft is kept; try again.', 'მოთხოვნა ვერ დადასტურდა. მონახაზი შენარჩუნებულია; სცადეთ ხელახლა.')));
    }, [current, copy]);

    const refresh = useCallback(async (): Promise<void> => {
        if (!current() || fetching.current || document.hidden) return;
        fetching.current = true;
        const version = epoch.current;
        try {
            const pending = backfill.current;
            let batch = pending?.batch ?? await api.messages(space.id, kind, thread, reads.current?.signal, undefined, room);
            if (!current() || version !== epoch.current) return;
            const newest = pending?.newest ?? batch[0]?.id ?? 0;
            let collected = pending?.rows ?? batch;
            // The existing API pages backwards. Bridge a reconnect gap before advancing latest.
            for (let page = 0; latest.current && batch.length === 50 && batch.at(-1)!.id > latest.current; page++) {
                if (page === 10) {
                    backfill.current = { newest, rows: collected, batch };
                    setError(copy('Catching up on more messages. Try again to continue now.', 'იტვირთება მეტი შეტყობინება. გასაგრძელებლად სცადეთ ხელახლა.'));
                    return;
                }
                batch = await api.messages(space.id, kind, thread, reads.current?.signal, batch.at(-1)!.id, room);
                if (!current() || version !== epoch.current) return;
                collected = merge(collected, batch);
            }
            const first = latest.current === 0;
            backfill.current = null;
            latest.current = newest;
            const boundary = collected.at(-1)?.id ?? 0;
            if (first) { oldest.current = boundary; setHasOlder(batch.length === 50); }
            // Replace the fetched range so a removed message does not reappear from a cache.
            setRows(previous => merge(previous.filter(row => boundary > 0 && row.id < boundary), collected));
            setLoading(false);
            setError('');
            if (newest && follow.current && !document.hidden) {
                try { await api.markRead(space.id, newest, thread, room); }
                catch (cause) { if (denied(cause)) fail(cause); }
            }
        } catch (cause) { if (version === epoch.current) fail(cause); }
        finally {
            fetching.current = false;
            if (current()) {
                if (version !== epoch.current) void refresh();
                else setLoading(false);
            }
        }
    }, [current, space.id, kind, thread, room, follow, fail, copy]);

    useEffect(() => {
        const lifecycle = epoch;
        const abort = new AbortController();
        reads.current = abort;
        alive.current = true;
        void refresh();
        const resume = () => { void refresh(); };
        const timer = window.setInterval(resume, 10_000);
        const unsubscribe = subscribeNotificationsChanged(resume);
        window.addEventListener('online', resume);
        window.addEventListener('focus', resume);
        document.addEventListener('visibilitychange', resume);
        return () => {
            alive.current = false; lifecycle.current++;
            abort.abort();
            window.clearInterval(timer); unsubscribe();
            window.removeEventListener('online', resume);
            window.removeEventListener('focus', resume);
            document.removeEventListener('visibilitychange', resume);
        };
    }, [refresh]);

    const loadOlder = async () => {
        if (!current() || more || !hasOlder) return;
        setMore(true);
        const version = epoch.current;
        try {
            const batch = await api.messages(space.id, kind, thread, reads.current?.signal, oldest.current, room);
            if (!current() || version !== epoch.current) return;
            oldest.current = batch.at(-1)?.id ?? oldest.current;
            setHasOlder(batch.length === 50);
            setRows(previous => merge(previous, batch));
        } catch (cause) { if (version === epoch.current) fail(cause); }
        finally { if (current()) setMore(false); }
    };
    const send = async (event: FormEvent) => {
        event.preventDefault();
        if (!current() || readOnly || kind !== 'CHAT' || sending.current || !body.trim()) return;
        sending.current = true; setBusy(true); setError('');
        const text = body;
        try {
            const attempt = recovery.prepare(key, text.trim());
            const response = await api.postMessage(space.id, { requestId: attempt.key, kind, threadUserId: thread, title: null, body: text.trim(), important: false, room });
            if (!current()) return;
            if (!Number.isSafeInteger(response.data?.id) || response.data.id <= 0) throw new Error('Message acknowledgement was missing.');
            recovery.confirm(key, attempt); confirmDraft(key, text);
            follow.current = true; void refresh(); onSentRef.current();
        } catch (cause) { fail(cause); }
        finally { sending.current = false; if (current()) setBusy(false); }
    };
    const action = async (fn: () => Promise<unknown>) => {
        if (!current() || busy) return;
        setBusy(true);
        try { await fn(); if (current()) { epoch.current++; backfill.current = null; latest.current = 0; setRows([]); await refresh(); } }
        catch (cause) { fail(cause); }
        finally { if (current()) setBusy(false); }
    };
    return { rows: recovery.current() ? rows : [], body, setBody, error, loading, busy, more, hasOlder,
        unavailable: unavailable || !recovery.current(), refresh, loadOlder, send, action };
}
