import { promptEmailConfirmation } from '../../components/auth/emailConfirmationPrompt';
import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CommerceDraftContext, useCommerceDraftState } from '../../components/workspace/commerceDraftState';
import { getAuthSessionId, getStoredUserId } from '../../utils/authStorage';
import { extractApiErrorMessage } from '../../utils/apiError';
import { createStoreProduct, type StoreProduct, type StoreProductPayload } from './api';
import { ct } from './copy';

type Attempt = { key: string; state: 'pending' | 'uncertain' | 'conflict' | 'review' | 'orphan'; input?: StoreProductPayload; held?: StoreProductPayload; product?: StoreProduct; unknown?: boolean; refused?: boolean };
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const markerPrefix = 'gk-store-create:';
const scopeFor = (club: number) => `${getAuthSessionId() ?? 'legacy'}:${getStoredUserId() ?? 'guest'}:${club}`;
const markerFor = (scope: string) => `${markerPrefix}${scope}`;
function readMarker(scope: string): Attempt | null {
    try { const key = sessionStorage.getItem(markerFor(scope)); return key ? { key, state: 'orphan' } : null; }
    catch { return { key: '', state: 'orphan' }; }
}
/** Compare persisted creation details, never ID/version or a translated product label. */
export function storeCreationDetails(value: StoreProductPayload | StoreProduct, canonical = false) {
    const variants = value.variants ?? (value.sizes?.length ? value.sizes.map(label => ({ label, stock: 0 })) : [{ label: 'One size', stock: 0 }]);
    return JSON.stringify({ name: value.name?.trim(), description: value.description ?? null, price: Math.round(Number(value.price) * 100),
        currency: value.currency ?? 'GEL', category: value.category ?? 'OTHER', active: value.active ?? false, images: value.images ?? [],
        sizes: canonical ? value.sizes ?? variants.map(v => v.label) : variants.map(v => v.label),
        variants: variants.map(v => ({ label: v.label.trim(), stock: v.stock })) });
}

/** Submitted bodies live only in the existing login/club draft store. Storage holds an opaque UUID only. */
export function useStoreCreateRecovery(clubId: number) {
    const store = useContext(CommerceDraftContext);
    const scope = scopeFor(clubId);
    const [attempt, setAttempt] = useCommerceDraftState<Attempt | null>('create:attempt', () => readMarker(scope));
    const [error, setError] = useState('');
    const mounted = useRef(false);
    const liveScope = useRef(scope);
    const latest = useRef<StoreProductPayload | null>(null);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    useLayoutEffect(() => { liveScope.current = scope; }, [scope]);
    const observe = useCallback((input: StoreProductPayload) => { latest.current = input; }, []);
    const current = () => store?.values.has('create:attempt') ? store.values.get('create:attempt') as Attempt | null : attempt;
    const active = () => mounted.current && liveScope.current === scope && scopeFor(clubId) === scope;
    const removeMarker = (key: string) => { if (sessionStorage.getItem(markerFor(scope)) === key) sessionStorage.removeItem(markerFor(scope)); };
    const hold = () => {
        const saved = current();
        if (saved && active()) setAttempt({ ...saved, held: clone(latest.current ?? saved.held ?? saved.input ?? {}) });
    };
    const finishReview = () => {
        const saved = current();
        if (!active() || !saved || !(saved.product && saved.state === 'review' || saved.state === 'uncertain' && saved.refused && !saved.unknown)) return false;
        try { removeMarker(saved.key); } catch { setError(ct('Recovery storage is unavailable. Your answers are kept.')); return false; }
        setAttempt(null); setError(''); return true;
    };
    const save = async (input: StoreProductPayload, done: (product: StoreProduct) => void) => {
        if (!active()) return;
        const previous = current();
        if (previous?.state === 'pending' || previous?.state === 'orphan' || previous?.state === 'review' || previous?.state === 'conflict') return;
        const session = getAuthSessionId(), generation = store?.formGeneration;
        const request: Attempt = previous ?? { key: crypto.randomUUID(), state: 'uncertain', input: clone(input) };
        if (!request.input) return;
        try {
            // Persist the marker before dispatch. Never overwrite an unresolved marker from a lost memory store.
            const marker = sessionStorage.getItem(markerFor(scope));
            if (marker && marker !== request.key) { setAttempt({ key: marker, state: 'orphan' }); return; }
            sessionStorage.setItem(markerFor(scope), request.key);
        } catch { setError(ct('Recovery storage is unavailable. Your answers are kept.')); return; }
        // A prior refusal does not make the newly dispatched retry safe to discard.
        setAttempt({ ...request, state: 'pending', refused: false }); setError('');
        try {
            const product = await createStoreProduct(clubId, clone(request.input), request.key, session);
            if (scopeFor(clubId) !== scope || current()?.key !== request.key) return;
            if (!Number.isSafeInteger(product.id) || product.id <= 0 || product.clubId !== clubId || (product.sellerKind && product.sellerKind !== 'CLUB') || !Number.isInteger(product.version) || product.version! < 0)
                throw new Error(ct('The save reply could not be confirmed. Retry the original save.'));
            const held = clone(latest.current ?? input);
            const same = storeCreationDetails(request.input) === storeCreationDetails(product, true) && storeCreationDetails(request.input) === storeCreationDetails(held);
            if (!active() || store?.formGeneration !== generation || !same) {
                setAttempt({ ...request, state: 'review', product: clone(product), held });
                return;
            }
            // Completion and its caller run in this same checked turn; no retired mount may clear/refresh a replacement.
            removeMarker(request.key); setAttempt(null); done(product);
        } catch (failure) {
            if (scopeFor(clubId) !== scope || current()?.key !== request.key) return;
            const status = (failure as { response?: { status?: number } })?.response?.status;
            // Even a definite first validation refusal retains its identity until an explicit separate-create choice.
            const refused = status === 400 && !request.unknown;
            setAttempt({ ...request, state: status === 409 ? 'conflict' : 'uncertain', unknown: !refused, refused, held: clone(latest.current ?? input) });
            if (active() && !promptEmailConfirmation(failure)) setError(extractApiErrorMessage(failure, ct('The original save was not confirmed. Your answers are kept.')));
        }
    };
    return { attempt, error, observe, hold, finishReview, save, pending: attempt?.state === 'pending',
        blocked: attempt?.state === 'review' || attempt?.state === 'conflict' || attempt?.state === 'orphan' };
}
