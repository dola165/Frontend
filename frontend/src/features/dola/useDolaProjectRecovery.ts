import { useEffect, useRef, useState } from 'react';
import { dolaProjectOutcome, type DolaProjectOutcome } from './api';
import { isCurrentAuthSession, type AuthSessionId } from '../../utils/authStorage';

export interface DolaOperation { operationId: string; conversationId: string }
const key = (actor: number) => `gk-dola-project-operation:${actor}`;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function read(actor?: number): DolaOperation | null {
    try {
        const saved = actor ? JSON.parse(localStorage.getItem(key(actor)) ?? 'null') as DolaOperation | null : null;
        return saved && uuid.test(saved.operationId) && uuid.test(saved.conversationId) ? saved : null;
    } catch { return null; }
}
/** Persist identifiers only, before sending. Never replay a write on load or account change. */
export function useDolaProjectRecovery(actor: number | undefined, sessionId: AuthSessionId) {
    const [operation, setOperation] = useState(() => read(actor));
    const [outcome, setOutcome] = useState<DolaProjectOutcome | null>(null);
    const [checking, setChecking] = useState(false);
    const [message, setMessage] = useState('');
    const request = useRef<AbortController | null>(null);
    useEffect(() => () => request.current?.abort(), []);
    function remember(value: DolaOperation) {
        if (!actor || !isCurrentAuthSession(sessionId)) throw new Error('Account changed. Reopen Dola.');
        // If storage is unavailable, do not send a write whose identity would be lost on reload.
        localStorage.setItem(key(actor), JSON.stringify(value));
        setOperation(value); setOutcome(null); setMessage('Waiting for the server result.');
    }
    function settled(operationId: string) {
        if (!actor || !isCurrentAuthSession(sessionId)) return;
        if (read(actor)?.operationId === operationId) localStorage.removeItem(key(actor));
        setOperation(null); setMessage('');
    }
    async function check() {
        if (!operation || request.current || !isCurrentAuthSession(sessionId)) return;
        const controller = new AbortController(); request.current = controller; setChecking(true); setOutcome(null);
        try {
            const result = await dolaProjectOutcome(operation.operationId, operation.conversationId, sessionId, controller.signal);
            if (controller.signal.aborted || !isCurrentAuthSession(sessionId)) return;
            if (result.operationId !== operation.operationId || !['COMPLETED', 'PENDING', 'DISCARDED', 'EXPIRED', 'SUPERSEDED', 'CONFLICT'].includes(result.state)
                || result.state === 'COMPLETED' && !result.receipt?.trim()) throw new Error('Invalid receipt');
            settled(operation.operationId); setOutcome(result);
        } catch {
            if (!controller.signal.aborted && isCurrentAuthSession(sessionId))
                setMessage('The result is still unconfirmed or no longer accessible. Check again or open Projects to inspect its current history. Do not repeat the change as a new operation.');
        } finally {
            request.current = null;
            if (!controller.signal.aborted && isCurrentAuthSession(sessionId)) setChecking(false);
        }
    }
    return { operation, outcome, checking, message, remember, settled, check };
}
