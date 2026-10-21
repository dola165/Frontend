import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { isCurrentAuthSession } from '../../utils/authStorage';
import { extractApiErrorMessage } from '../../utils/apiError';
import { searchClubs } from './api';
import { actOnClubApproach, createClubApproach, fetchClubApproach, fetchClubApproachMessages, fetchClubApproachOptions, fetchClubApproaches, postClubApproachMessage,
    type ClubApproach, type ClubApproachAction, type ClubApproachMessage } from './clubApproachesApi';

export type ApproachMode = 'agent' | 'participant' | 'club';
export const PAGE_SIZE = 20;
const phrase = (ka: boolean, en: string, ge: string) => ka ? ge : en;

/**
 * State for approaches between an agent, a player and a club: the open and past lists, the focused
 * approach (kept in the URL), its discussion, a new proposal (agents) and confirmed actions. Every
 * response is checked against the current account session and the approach still selected, so a late
 * answer can never land on another person's or another approach's view.
 */
export function useClubApproaches(mode: ApproachMode, clubId: number | undefined, session: string | null, ka: boolean) {
    const [params, setParams] = useSearchParams();
    const [open, setOpen] = useState<ClubApproach[]>([]), [history, setHistory] = useState<ClubApproach[]>([]);
    const [page, setPage] = useState(0), [total, setTotal] = useState(0), [view, setView] = useState<'OPEN' | 'HISTORY'>('OPEN');
    const [selected, setSelected] = useState<ClubApproach | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
    const [optionsOpen, setOptionsOpen] = useState(false), [options, setOptions] = useState<Array<{ representationRequestId: number; playerName: string }>>([]);
    const [clubs, setClubs] = useState<Array<{ id: number; name: string }>>([]);
    const [player, setPlayer] = useState(''), [clubQuery, setClubQuery] = useState(''), [club, setClub] = useState<{ id: number; name: string } | null>(null);
    const [scope, setScope] = useState(''), [message, setMessage] = useState('');
    const [messages, setMessages] = useState<ClubApproachMessage[]>([]), [messagePage, setMessagePage] = useState(0), [messageTotal, setMessageTotal] = useState(0), [messageBody, setMessageBody] = useState('');
    const [busy, setBusy] = useState(false), [pendingAction, setPendingAction] = useState<ClubApproachAction | null>(null), [note, setNote] = useState('');
    const request = useRef(0), messageRequest = useRef(0), selectedIdRef = useRef<number | null>(null), activeRef = useRef(true);
    const focused = Number(params.get('approach')) || null;
    const current = () => activeRef.current && isCurrentAuthSession(session);

    const commitSelected = useCallback((value: ClubApproach | null) => {
        if (selectedIdRef.current !== (value?.id ?? null)) { setPendingAction(null); setNote(''); setMessages([]); setMessagePage(0); setMessageTotal(0); setMessageBody(''); }
        selectedIdRef.current = value?.id ?? null;
        setSelected(previous => previous?.id === value?.id && previous && value && previous.version > value.version ? previous : value);
    }, []);
    useEffect(() => { activeRef.current = true; return () => { activeRef.current = false; request.current += 1; }; }, []);

    const load = useCallback(async (nextView = view, nextPage = page) => {
        const seq = ++request.current;
        setLoading(true); setError('');
        try {
            const data = await fetchClubApproaches({ clubId, view: nextView, page: nextPage, size: PAGE_SIZE }, { _authSessionId: session });
            if (seq !== request.current || !isCurrentAuthSession(session)) return;
            if (nextView === 'OPEN') setOpen(data.items); else setHistory(data.items);
            setTotal(data.total);
        } catch (failure) { if (seq === request.current && isCurrentAuthSession(session)) setError(extractApiErrorMessage(failure, phrase(ka, 'Approaches could not load.', 'მიმართვები ვერ ჩაიტვირთა.'))); }
        finally { if (seq === request.current && isCurrentAuthSession(session)) setLoading(false); }
    }, [clubId, ka, page, session, view]);
    useEffect(() => { void load(); }, [load]);

    useEffect(() => {
        if (!focused) { commitSelected(null); return; }
        const controller = new AbortController();
        fetchClubApproach(focused, { _authSessionId: session, signal: controller.signal })
            .then(item => { if (!controller.signal.aborted && activeRef.current && isCurrentAuthSession(session)) commitSelected(item); })
            .catch(() => { if (!controller.signal.aborted && activeRef.current && isCurrentAuthSession(session)) { commitSelected(null); setError(phrase(ka, 'This approach is unavailable or you no longer have access.', 'ეს მიმართვა მიუწვდომელია ან წვდომა აღარ გაქვთ.')); } });
        return () => controller.abort();
    }, [focused, ka, session, commitSelected]);
    useEffect(() => {
        if (!optionsOpen || mode !== 'agent') return;
        const controller = new AbortController();
        fetchClubApproachOptions({ _authSessionId: session, signal: controller.signal })
            .then(data => { if (!controller.signal.aborted && isCurrentAuthSession(session)) setOptions(data); })
            .catch(() => { if (!controller.signal.aborted && isCurrentAuthSession(session)) setError(phrase(ka, 'Eligible players could not load.', 'შესაბამისი მოთამაშეები ვერ ჩაიტვირთა.')); });
        return () => controller.abort();
    }, [optionsOpen, mode, ka, session]);
    useEffect(() => {
        setClubs([]);
        if (mode !== 'agent' || clubQuery.trim().length < 2 || club) return;
        const controller = new AbortController();
        const timer = window.setTimeout(() => searchClubs(clubQuery, { _authSessionId: session, signal: controller.signal })
            .then(data => { if (!controller.signal.aborted && isCurrentAuthSession(session)) setClubs(data.map(item => ({ id: item.id, name: item.name }))); })
            .catch(() => { if (!controller.signal.aborted && isCurrentAuthSession(session)) setError(phrase(ka, 'Club search could not load. Change the search to retry.', 'კლუბების ძებნა ვერ ჩაიტვირთა. ხელახლა საცდელად შეცვალეთ საძიებო ტექსტი.')); }), 250);
        return () => { clearTimeout(timer); controller.abort(); };
    }, [clubQuery, mode, club, session, ka]);
    useEffect(() => {
        if (!selected) { setMessages([]); setMessageTotal(0); return; }
        const controller = new AbortController(), seq = ++messageRequest.current, approachId = selected.id;
        fetchClubApproachMessages(approachId, messagePage, PAGE_SIZE, { _authSessionId: session, signal: controller.signal })
            .then(data => { if (!controller.signal.aborted && seq === messageRequest.current && isCurrentAuthSession(session)) { setMessages(data.items); setMessageTotal(data.total); } })
            .catch(() => { if (!controller.signal.aborted && seq === messageRequest.current && isCurrentAuthSession(session)) setError(phrase(ka, 'Discussion could not load.', 'განხილვა ვერ ჩაიტვირთა.')); });
        return () => controller.abort();
    }, [selected, ka, messagePage, session]);

    const select = (item: ClubApproach) => {
        commitSelected(item); setPendingAction(null); setNote(''); setMessages([]); setMessagePage(0); setMessageTotal(0); setMessageBody('');
        const next = new URLSearchParams(params); next.set('approach', String(item.id)); setParams(next, { replace: true });
    };
    const refresh = async () => {
        await load();
        if (!selected) return;
        const id = selected.id;
        try { const updated = await fetchClubApproach(id, { _authSessionId: session }); if (current() && selectedIdRef.current === id) commitSelected(updated); }
        catch { /* the list refresh is still useful */ }
    };
    useEffect(() => {
        const controller = new AbortController();
        const onFocus = () => {
            if (busy || document.hidden) return;
            void load();
            const id = selectedIdRef.current;
            if (id) void fetchClubApproach(id, { _authSessionId: session, signal: controller.signal })
                .then(value => { if (!controller.signal.aborted && activeRef.current && isCurrentAuthSession(session) && selectedIdRef.current === id) commitSelected(value); })
                .catch(() => { if (!controller.signal.aborted && activeRef.current && isCurrentAuthSession(session)) setError(phrase(ka, 'Refresh the approach to check its latest status.', 'უახლესი სტატუსის სანახავად განაახლეთ მიმართვა.')); });
        };
        window.addEventListener('focus', onFocus);
        return () => { controller.abort(); window.removeEventListener('focus', onFocus); };
    }, [busy, load, session, ka, commitSelected]);

    const submit = async () => {
        const choice = options.find(option => String(option.representationRequestId) === player);
        if (busy || !choice || !club || !scope.trim()) return;
        setBusy(true);
        try {
            const created = await createClubApproach({ representationRequestId: choice.representationRequestId, clubId: club.id, scope: scope.trim(), message: message.trim() || undefined }, { _authSessionId: session });
            if (!current()) return;
            setOptionsOpen(false); setScope(''); setMessage(''); setPlayer(''); setClub(null); select(created);
            window.dispatchEvent(new Event('club-approaches-updated'));
            await load();
        } catch (failure) { if (current()) setError(extractApiErrorMessage(failure, phrase(ka, 'Approach could not be sent.', 'მიმართვა ვერ გაიგზავნა.'))); }
        finally { if (current()) setBusy(false); }
    };
    const runAction = async (action: ClubApproachAction) => {
        if (busy || !selected) return;
        const approachId = selected.id;
        setBusy(true);
        try {
            const updated = await actOnClubApproach(approachId, { action, version: selected.version, note: note.trim() || undefined }, { _authSessionId: session });
            if (!current()) return;
            if (selectedIdRef.current === approachId) { commitSelected(updated); setPendingAction(null); setNote(''); }
            window.dispatchEvent(new Event('club-approaches-updated'));
            await load();
        } catch (failure) { if (current()) setError(extractApiErrorMessage(failure, phrase(ka, 'The approach changed. Refresh and try again.', 'მიმართვა შეიცვალა. განაახლეთ და სცადეთ თავიდან.'))); }
        finally { if (current()) setBusy(false); }
    };
    const sendMessage = async () => {
        if (busy || !selected || !messageBody.trim()) return;
        const approachId = selected.id;
        setBusy(true);
        try {
            await postClubApproachMessage(approachId, messageBody.trim(), { _authSessionId: session });
            if (!current() || selectedIdRef.current !== approachId) return;
            setMessageBody(''); window.dispatchEvent(new Event('club-approaches-updated')); setMessagePage(0);
            const data = await fetchClubApproachMessages(approachId, 0, PAGE_SIZE, { _authSessionId: session });
            if (current() && selectedIdRef.current === approachId) { setMessages(data.items); setMessageTotal(data.total); }
        } catch (failure) { if (current()) setError(extractApiErrorMessage(failure, phrase(ka, 'Message could not be sent.', 'შეტყობინება ვერ გაიგზავნა.'))); }
        finally { if (current()) setBusy(false); }
    };

    return {
        items: view === 'OPEN' ? open : history, view, setView, page, setPage, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
        selected, select, loading, error, refresh, busy,
        proposal: { open: optionsOpen, setOpen: setOptionsOpen, options, clubs, player, setPlayer, clubQuery, setClubQuery, club, setClub, setClubs, scope, setScope, message, setMessage, submit },
        discussion: { messages, page: messagePage, setPage: setMessagePage, total: messageTotal, body: messageBody, setBody: setMessageBody, send: sendMessage },
        action: { pending: pendingAction, setPending: setPendingAction, note, setNote, run: runAction },
    };
}
