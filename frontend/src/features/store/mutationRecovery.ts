import { promptEmailConfirmation } from '../../components/auth/emailConfirmationPrompt';
import { useContext, useEffect, useRef, useState } from 'react';
import { CommerceDraftContext, useCommerceDraftState } from '../../components/workspace/commerceDraftState';
import { getAuthSessionId, getStoredUserId } from '../../utils/authStorage';
import { extractApiErrorMessage } from '../../utils/apiError';
import { deleteStoreProduct, updateStoreProduct, type StoreProductPayload } from './api';
import { ct } from './copy';

type Command = { productId: number; input: StoreProductPayload; archive: boolean };
type Attempt = { key: string; command?: Command; state: 'pending' | 'uncertain' | 'review' };
const scopeFor = (clubId: number) => `${getAuthSessionId() ?? 'legacy'}:${getStoredUserId() ?? 'guest'}:${clubId}`;
const markerFor = (scope: string) => `gk-store-change:${scope}`;
const read = (scope: string): Attempt | null => {
    try { const key = sessionStorage.getItem(markerFor(scope)); return key ? { key, state: 'review' } : null; }
    catch { return { key: '', state: 'review' }; }
};

/** One unresolved inventory command per login/club. Private bodies stay in the existing memory draft. */
export function useStoreMutationRecovery(clubId: number) {
    const scope = scopeFor(clubId), store = useContext(CommerceDraftContext);
    const [attempt, setAttempt] = useCommerceDraftState<Attempt | null>('mutation:attempt', () => read(scope));
    const [error, setError] = useState('');
    const mounted = useRef(false), inFlight = useRef(false);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    const current = () => store?.values.has('mutation:attempt') ? store.values.get('mutation:attempt') as Attempt | null : attempt;
    const active = () => mounted.current && scopeFor(clubId) === scope;
    const run = async (command: Command | undefined, done: () => void) => {
        if (!active() || inFlight.current) return;
        const previous = current();
        if (previous?.state === 'pending' || previous?.state === 'review') return;
        const request: Attempt = previous ?? { key: crypto.randomUUID(), command: structuredClone(command), state: 'uncertain' };
        if (!request.command) return;
        try {
            const marker = sessionStorage.getItem(markerFor(scope));
            if (marker && marker !== request.key) { setAttempt({ key: marker, state: 'review' }); return; }
            sessionStorage.setItem(markerFor(scope), request.key);
        } catch { setError(ct('Recovery storage is unavailable. Your answers are kept.')); return; }
        inFlight.current = true; setAttempt({ ...request, state: 'pending' }); setError('');
        const session = getAuthSessionId();
        try {
            const { productId, input, archive } = request.command;
            if (archive) await deleteStoreProduct(clubId, productId, input.version, request.key, session);
            else {
                const saved = await updateStoreProduct(clubId, productId, structuredClone(input), request.key, session);
                if (saved.id !== productId || saved.clubId !== clubId || !Number.isInteger(saved.version) || saved.version! <= (input.version ?? -1))
                    throw new Error(ct('The save reply could not be confirmed. Retry the original save.'));
            }
            if (scopeFor(clubId) !== scope || current()?.key !== request.key) return;
            // A retired page cannot clear the replacement editor. Keep a review marker there instead.
            if (!active()) { setAttempt({ ...request, state: 'review' }); return; }
            if (sessionStorage.getItem(markerFor(scope)) === request.key) sessionStorage.removeItem(markerFor(scope));
            setAttempt(null); done();
        } catch (failure) {
            if (scopeFor(clubId) !== scope || current()?.key !== request.key) return;
            const status = (failure as { response?: { status?: number } })?.response?.status;
            setAttempt({ ...request, state: status && status >= 400 && status < 500 ? 'review' : 'uncertain' });
            if (active() && !promptEmailConfirmation(failure)) setError(extractApiErrorMessage(failure, ct('The change was not confirmed. Retry the original change or review saved products.')));
        } finally { inFlight.current = false; }
    };
    const review = () => {
        if (!active() || current()?.state === 'pending') return false;
        try { sessionStorage.removeItem(markerFor(scope)); }
        catch { setError(ct('Recovery storage is unavailable. Your answers are kept.')); return false; }
        setAttempt(null); setError(''); return true;
    };
    return { attempt, error, run, review };
}
