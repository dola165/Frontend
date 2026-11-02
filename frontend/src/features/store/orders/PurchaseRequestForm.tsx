import { promptEmailConfirmation } from '../../../components/auth/emailConfirmationPrompt';
import { useRef, useState } from 'react';
import { useCommerceDraftState } from '../../../components/workspace/commerceDraftState';
import { Button, ButtonLink, Field } from '../../../design/primitives';
import { useAuth } from '../../../context/AuthContext';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { getAuthSessionId, isCurrentAuthSession } from '../../../utils/authStorage';
import type { CartQuote } from '../api';
import { requestPurchase, type PurchaseRequest, type StoreOrder } from './api';
import { purchaseMarkerKey, readPurchaseMarker } from './recovery';
import { QuotedMaterials } from './QuotedMaterials';
import './orders.css';

/** Optional agreement record; accepting the request and reserving stock is the seller's action. */
export function PurchaseRequestForm({ quote, onCreated, onRefresh }: { quote: CartQuote; onRefresh: () => void; onCreated: (order: StoreOrder) => void }) {
    const { status } = useAuth();
    const [contact, setContact] = useCommerceDraftState('contact', ''), [note, setNote] = useCommerceDraftState('note', '');
    const [fulfillment, setFulfillment] = useCommerceDraftState<'COLLECTION' | 'DELIVERY'>('fulfillment', 'COLLECTION');
    const [attempt, setAttempt] = useCommerceDraftState<PurchaseRequest | null>('attempt', null);
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    const pending = useRef(false);
    const [refused, setRefused] = useState(false);
    const markerKey = purchaseMarkerKey(quote);
    const [marker, setMarker] = useState(() => readPurchaseMarker(markerKey));
    const currentTerms = quote.lines.every(line => Number.isSafeInteger(line.productVersion) && !!line.materialDigest);
    if (status !== 'authenticated') return <ButtonLink to="/login?returnTo=%2Fstore%2Fcart">Sign in to save a purchase request</ButtonLink>;
    if (marker && marker !== attempt?.requestId) return <div className="store-orders">
        <p role="status">A previous purchase request needs review. Open My requests to check its saved state before arranging another purchase. No private contact details were kept in browser storage.</p>
        <ButtonLink to="/store/cart?view=requests">Review My requests</ButtonLink>
        <Button onClick={() => {
            try { sessionStorage.removeItem(markerKey); setMarker(null); setAttempt(null); setError(''); }
            catch { setError('Recovery storage is unavailable. Keep using My requests or contact the seller directly.'); }
        }}>Start a separate request</Button>
        {error && <p role="alert">{error}</p>}
    </div>;
    return <form className="store-orders" aria-label="Purchase request" onSubmit={event => {
        event.preventDefault();
        if (pending.current || !currentTerms) return;
        const session = getAuthSessionId();
        const input: PurchaseRequest = attempt ?? {
            requestId: crypto.randomUUID(), clubId: quote.clubId || null, currency: quote.currency,
            lines: quote.lines.map(line => ({ variantId: line.variantId, quantity: line.quantity, productVersion: line.productVersion!, unitPrice: line.unitAmount / 100, materialDigest: line.materialDigest! })),
            fulfillment, contact, note,
        };
        setAttempt(input); setError(''); setRefused(false);
        try { sessionStorage.setItem(markerKey, input.requestId); setMarker(input.requestId); }
        catch { setError('Recovery storage is unavailable. No request was sent. Your entered details are kept.'); setRefused(true); return; }
        pending.current = true; setBusy(true);
        void requestPurchase(input, session).then(order => { if (isCurrentAuthSession(session)) {
            try { sessionStorage.removeItem(markerKey); setMarker(null); } catch { /* The saved record is still authoritative. */ }
            setAttempt(null); setRefused(false);
            onCreated(order);
        } })
            .catch(failure => { if (isCurrentAuthSession(session)) { promptEmailConfirmation(failure); setRefused([400, 404, 409].includes(failure?.response?.status)); setError(extractApiErrorMessage(failure, 'The result is uncertain. Retry the same request or open My requests before starting another.')); } })
            .finally(() => { pending.current = false; if (isCurrentAuthSession(session)) setBusy(false); });
    }}>
        <p>Ask {quote.clubName} to confirm these items and how to buy. Stock is reserved only after the seller accepts. Payment is arranged directly.</p>
        <QuotedMaterials lines={quote.lines} />
        <fieldset disabled={busy || !!attempt}>
            <Field label="How would you like to receive it?" htmlFor="order-fulfillment"><select className="gk-input" id="order-fulfillment" value={fulfillment} onChange={e => setFulfillment(e.target.value as typeof fulfillment)}><option value="COLLECTION">Collection</option><option value="DELIVERY">Ask about delivery</option></select></Field>
            <Field label="Your contact for this request" htmlFor="order-contact" hint="Shared privately with this seller. Enter only the contact details you want them to use."><input className="gk-input" id="order-contact" required maxLength={300} value={contact} onChange={e => setContact(e.target.value)} /></Field>
            <Field label="Message (optional)" htmlFor="order-note"><textarea className="gk-input" id="order-note" maxLength={1000} value={note} onChange={e => setNote(e.target.value)} /></Field>
        </fieldset>
        {!currentTerms && <p role="status">Refresh the quote before saving a request.</p>}
        {error && <p role="alert">{error}</p>}
        {refused && !busy && <Button onClick={() => {
            try { sessionStorage.removeItem(markerKey); setMarker(null); setAttempt(null); setError(''); setRefused(false); onRefresh(); }
            catch { setError('Recovery storage is unavailable. Open My requests before making a separate request.'); }
        }}>Review current quote</Button>}
        <Button type="submit" variant="primary" disabled={busy || !currentTerms}>{busy ? 'Saving request…' : attempt ? 'Retry same request' : 'Request purchase'}</Button>
        {attempt && !busy && <ButtonLink to="/store/cart?view=requests">Review My requests</ButtonLink>}
        <p className="gk-muted">The seller must confirm collection or delivery and any additional costs with you. This request covers the item subtotal only. No money is taken here.</p>
    </form>;
}
