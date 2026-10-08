import { useDolaPanelSize } from './useDolaPanelSize';
import { useCallback, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { DolaContext } from './DolaContext';
import { Link, useLocation, useNavigate, type LinkProps } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isCurrentAuthSession } from '../../utils/authStorage';
import { extractApiErrorCode, extractApiErrorMessage } from '../../utils/apiError';
import { clearDola, dolaStatus, dolaWelcome, latestDola, streamDola, resolveDolaAction, type DolaAction, type DolaSnapshot, type DolaTurn } from './api';
import { readDolaHandoff, type DolaHandoff } from './navigation';
import { chooseDolaContext, normalizeDolaContexts, type DolaWorkspace } from './suggestions';

const RETENTION_MS = 45 * 60 * 1000;
function useDolaController() {
    const { sessionId, user } = useAuth();
    const location = useLocation(); const navigate = useNavigate();
    const panelSize = useDolaPanelSize(user?.id);
    const fullPage = location.pathname === '/assistant';
    const [panel, setPanel] = useState(false);
    const [available, setAvailable] = useState<boolean | null>(null);
    const [contexts, setContexts] = useState<DolaWorkspace[]>(['discover']);
    const [preferredContext, setPreferredContext] = useState<DolaWorkspace>();
    const [welcomeLoading, setWelcomeLoading] = useState(false);
    const workspace = chooseDolaContext(contexts, location.pathname, preferredContext);
    const venueMatch = /^\/stadiums\/([1-9][0-9]*)\/manage$/.exec(location.pathname);
    const pageVenueId = venueMatch ? Number(venueMatch[1]) : undefined;
    const [turns, setTurns] = useState<DolaTurn[]>([]);
    const [draft, setDraft] = useState(''); const [personal, setPersonal] = useState(false);
    const [busy, setBusy] = useState(false); const [error, setError] = useState('');
    const [expired, setExpired] = useState(false); const [expiresAt, setExpiresAt] = useState<number | null>(null);
    const [resume, setResume] = useState(false); const [loading, setLoading] = useState(false);
    const [handoff, setHandoff] = useState<DolaHandoff | null>(null);
    const conversation = useRef<string | undefined>(undefined);
    const recovered = useRef<DolaSnapshot | null>(null);
    const request = useRef<AbortController | null>(null); const active = useRef(true);
    const initialized = useRef(false); const consumed = useRef<string | null>(null);
    const previousPath = useRef(location.pathname); const returnPath = useRef('/home');
    const launcher = useRef<HTMLElement | null>(null);
    const visible = !!user && !!sessionId && (panel || fullPage);

    useEffect(() => {
        if (!visible) return;
        const controller = new AbortController(); setWelcomeLoading(true);
        const refresh = () => {
            void dolaWelcome(sessionId, controller.signal).then(result => {
                if (active.current && !controller.signal.aborted && isCurrentAuthSession(sessionId)) setContexts(normalizeDolaContexts(result.contexts));
            }).catch(() => {
                if (!controller.signal.aborted && active.current && isCurrentAuthSession(sessionId)) setContexts(['discover']);
            }).finally(() => { if (!controller.signal.aborted && active.current && isCurrentAuthSession(sessionId)) setWelcomeLoading(false); });
        };
        refresh(); window.addEventListener('focus', refresh);
        return () => { controller.abort(); window.removeEventListener('focus', refresh); };
    }, [visible, sessionId, location.pathname, user?.navigationCapabilities]);

    useEffect(() => { active.current = true; return () => { active.current = false; request.current?.abort(); }; }, [sessionId]);
    useEffect(() => {
        if (previousPath.current === '/assistant' && !fullPage) setPanel(true);
        if (!fullPage) returnPath.current = location.pathname + location.search;
        previousPath.current = location.pathname;
    }, [location.pathname, location.search, fullPage]);
    useEffect(() => {
        const incoming = readDolaHandoff(location.state, sessionId);
        if (!incoming || consumed.current === incoming.requestId) return;
        consumed.current = incoming.requestId; setHandoff(incoming); setDraft(incoming.message); setPersonal(false);
        navigate(location.pathname, { replace: true, state: null });
    }, [location.pathname, location.state, navigate, sessionId]);

    useEffect(() => {
        if (!visible || initialized.current) return;
        const controller = new AbortController(); setLoading(true);
        void Promise.allSettled([dolaStatus(sessionId, controller.signal), latestDola(sessionId, controller.signal)]).then(([status, history]) => {
            if (!active.current || controller.signal.aborted || !isCurrentAuthSession(sessionId)) return;
            initialized.current = true; setLoading(false);
            setAvailable(status.status === 'fulfilled' && status.value.available);
            if (history.status === 'fulfilled' && history.value && Date.parse(history.value.expiresAt) > Date.now()) {
                recovered.current = history.value; setResume(true); setExpiresAt(Date.parse(history.value.expiresAt));
            } else if (history.status === 'rejected') setError('Could not check your recent chat. You can still start a new conversation.');
        });
        return () => controller.abort();
    }, [visible, sessionId]);

    const forgetExpired = useCallback(() => {
        if (busy || !expiresAt || Date.now() < expiresAt) return;
        conversation.current = undefined; recovered.current = null;
        setTurns([]); setResume(false); setPersonal(false); setExpiresAt(null); setExpired(false);
        setError('Your previous chat expired after 45 minutes of inactivity. You can start a new one.');
    }, [expiresAt, busy]);
    useEffect(() => {
        if (!expiresAt || busy) return;
        const timer = setTimeout(forgetExpired, Math.max(0, expiresAt - Date.now()));
        document.addEventListener('visibilitychange', forgetExpired);
        return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', forgetExpired); };
    }, [expiresAt, busy, forgetExpired]);

    const submit = useCallback(async (message: string, requestId: string = crypto.randomUUID(), usePersonal = personal) => {
        message = message.trim();
        if (!message || message.length > 2000 || busy || loading || resume || !available || expired || request.current || !isCurrentAuthSession(sessionId)) return;
        // A suspended browser tab must not send an expired conversation ID.
        if (expiresAt && expiresAt <= Date.now()) { forgetExpired(); return; }
        const controller = new AbortController(); request.current = controller;
        setBusy(true); setError(''); setDraft('');
        setTurns(previous => [...previous, { question: message, partial: '' }]);
        try {
            const result = await streamDola({ conversationId: conversation.current, requestId, message, includePersonalContext: usePersonal, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, workspaceContext: workspace, venueId: pageVenueId }, sessionId, controller.signal, event => {
                if (!active.current || !isCurrentAuthSession(sessionId) || controller.signal.aborted) return;
                if (event.type === 'delta' || event.type === 'reset') setTurns(previous => previous.map((turn, index) => index === previous.length - 1
                    ? { ...turn, partial: event.type === 'reset' ? '' : (turn.partial ?? '') + (event.text ?? '') } : turn));
            });
            if (!active.current || !isCurrentAuthSession(sessionId)) return;
            conversation.current = result.conversationId; setExpiresAt(Date.now() + RETENTION_MS);
            setTurns(previous => [...previous.slice(0, -1).map(turn => result.actions?.some(a => a.state === 'PENDING') && turn.result
                ? { ...turn, result: { ...turn.result, actions: turn.result.actions?.map(a => a.state === 'PENDING' ? { ...a, state: 'SUPERSEDED' as const } : a) } } : turn), { question: message, result }]);
        } catch (cause) {
            if (!active.current || controller.signal.aborted || !isCurrentAuthSession(sessionId)) return;
            const code = extractApiErrorCode(cause);
            setError(code === 'DOLA_DAILY_LIMIT' ? 'Agent Dola’s daily testing allowance has been reached. Try again tomorrow.'
                : extractApiErrorMessage(cause, cause instanceof Error ? cause.message : 'Dola could not finish this answer. Please try again later.'));
            setExpired(code === 'DOLA_CONVERSATION_UNAVAILABLE'); setDraft(message);
            // Partial provider output is not a completed answer or a saved conversation turn.
            if (code === 'DOLA_CONVERSATION_UNAVAILABLE') {
                conversation.current = undefined; recovered.current = null;
                setTurns([]); setResume(false); setExpiresAt(null);
            } else setTurns(previous => previous.slice(0, -1));
        } finally { request.current = null; if (active.current && isCurrentAuthSession(sessionId)) setBusy(false); }
    }, [available, busy, loading, resume, expired, expiresAt, forgetExpired, personal, sessionId, workspace, pageVenueId]);

    useEffect(() => {
        if (!handoff || loading || available === null || busy || resume) return;
        setHandoff(null);
        if (available && !expired) void submit(handoff.message, handoff.requestId, false);
    }, [handoff, loading, available, busy, resume, expired, submit]);

    async function newConversation() {
        if (busy || request.current || !isCurrentAuthSession(sessionId)) return;
        const controller = new AbortController(); request.current = controller; setBusy(true); setError('');
        try {
            const id = conversation.current ?? recovered.current?.conversationId;
            if (id && !expired) {
                try { await clearDola(id, sessionId, controller.signal); }
                catch (cause) { if (extractApiErrorCode(cause) !== 'DOLA_CONVERSATION_UNAVAILABLE') throw cause; }
            }
            if (!active.current || !isCurrentAuthSession(sessionId)) return;
            conversation.current = undefined; recovered.current = null;
            setTurns([]); setDraft(handoff?.message ?? ''); setPersonal(false); setExpired(false); setResume(false); setExpiresAt(null);
        } catch (cause) {
            if (active.current && !controller.signal.aborted && isCurrentAuthSession(sessionId)) setError(extractApiErrorMessage(cause, 'Could not clear this conversation. Please try again.'));
        } finally { request.current = null; if (active.current && isCurrentAuthSession(sessionId)) setBusy(false); }
    }
    function continueConversation() {
        if (!isCurrentAuthSession(sessionId)) return;
        if (expiresAt && expiresAt <= Date.now()) { forgetExpired(); return; }
        if (recovered.current) {
            conversation.current = recovered.current.conversationId; setTurns(recovered.current.turns); recovered.current = null;
        }
        setResume(false); setPersonal(false);
    }
    async function resolveAction(action: DolaAction, decision: 'confirm' | 'discard') {
        if (!conversation.current || busy || request.current || resume || !isCurrentAuthSession(sessionId)) return;
        const controller = new AbortController(); request.current = controller; setBusy(true); setError('');
        try {
            const result = await resolveDolaAction(conversation.current, action.id, decision, sessionId, controller.signal);
            if (!active.current || !isCurrentAuthSession(sessionId)) return;
            setTurns(previous => previous.map(turn => turn.result ? { ...turn, result: { ...turn.result, actions: turn.result.actions?.map(a => a.id === result.id ? result : a) } } : turn));
            if (result.state === 'COMPLETED') setExpiresAt(Date.now() + RETENTION_MS);
        } catch (cause) {
            if (active.current && !controller.signal.aborted && isCurrentAuthSession(sessionId)) {
                if (extractApiErrorCode(cause) === 'DOLA_CONVERSATION_UNAVAILABLE') {
                    conversation.current = undefined; recovered.current = null;
                    setTurns([]); setResume(false); setExpiresAt(null); setExpired(true);
                }
                setError(extractApiErrorMessage(cause, 'Could not confirm the result. Check the current workspace state before trying again.'));
            }
        } finally { request.current = null; if (active.current && isCurrentAuthSession(sessionId)) setBusy(false); }
    }
    function openPanel(element?: HTMLElement) { launcher.current = element ?? null; forgetExpired(); setPanel(true); }
    function closePanel() {
        setPanel(false); if (turns.length || busy || recovered.current) setResume(true);
        launcher.current?.focus();
    }
    function dock() { setPanel(true); if (fullPage) navigate(returnPath.current); }
    function expand() { setPreferredContext(workspace); setPanel(false); navigate('/assistant'); }
    return { panelSize, fullPage, panel, visible, available, turns, draft, setDraft, personal, setPersonal, busy, error, expired, resume, loading,
        contexts, workspace, setWorkspace: setPreferredContext, welcomeLoading,
        submit, resolveAction, newConversation, continueConversation, openPanel, closePanel, dock, expand, keepOpen: () => setPanel(true) };
}

export type DolaState = ReturnType<typeof useDolaController>;
export function DolaProvider({ children }: { children: ReactNode }) {
    const { sessionId } = useAuth();
    return <DolaSession key={sessionId} >{children}</DolaSession>;
}
function DolaSession({ children }: { children: ReactNode }) {
    const controller = useDolaController();
    return <DolaContext.Provider value={controller}><div style={{ '--dola-dock-width': `${controller.panelSize.width}px` } as CSSProperties} data-dola-layout={controller.panelSize.layout} className={controller.visible && controller.panel && !controller.fullPage ? 'dola-layout-panel' : undefined}>{children}</div></DolaContext.Provider>;
}
export function DolaLink(props: Omit<LinkProps, 'to'>) {
    const dola = useContext(DolaContext);
    return <Link {...props} to="/assistant" onClick={event => {
        if (dola && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) {
            event.preventDefault(); dola.openPanel(event.currentTarget);
        }
        props.onClick?.(event);
    }} />;
}
