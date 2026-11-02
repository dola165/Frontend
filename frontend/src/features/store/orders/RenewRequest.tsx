import { useRef, useState } from 'react';
import { Button } from '../../../design/primitives';
import { useCommerceDraftState } from '../../../components/workspace/commerceDraftState';
import { getAuthSessionId, isCurrentAuthSession } from '../../../utils/authStorage';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { fetchCartQuote, formatStorePrice, type CartQuote } from '../api';
import { fetchOrder, renewOrder, type Renewal, type StoreOrder } from './api';
import { QuotedMaterials } from './QuotedMaterials';
import './orders.css';

/** The buyer reviews fresh material terms; this keeps the order identity and original history. */
export function RenewRequest({ order, onRenewed, onUnavailable }: { order: StoreOrder; onRenewed: (order: StoreOrder) => void; onUnavailable: () => void }) {
    const [quote, setQuote] = useCommerceDraftState<CartQuote | null>('renewal:quote', null), [checked, setChecked] = useCommerceDraftState<StoreOrder | null>('renewal:checked', null);
    const [attempt, setAttempt] = useCommerceDraftState<Renewal | null>('renewal:attempt', null);
    const [busy, setBusy] = useState(false), [error, setError] = useState(''), [refused, setRefused] = useState(false);
    const pending = useRef(false);
    const review = async () => {
        if (pending.current) return;
        const session = getAuthSessionId(); pending.current = true; setBusy(true); setError('');
        let privateChecked = false;
        try {
            const current = await fetchOrder(order.id, session);
            if (!isCurrentAuthSession(session)) return;
            privateChecked = true;
            if (current.status !== 'REQUESTED') { onRenewed(current); return; }
            const fresh = await fetchCartQuote(current.lines.map(line => ({ variantId: line.originalVariantId, quantity: line.quantity })));
            if (!isCurrentAuthSession(session)) return;
            setChecked(current); setQuote(fresh); setAttempt(null); setRefused(false);
        } catch (failure) {
            if (!isCurrentAuthSession(session)) return;
            const status = (failure as { response?: { status?: number } }).response?.status;
            if (!privateChecked && (status === 403 || status === 404)) onUnavailable();
            else setError(extractApiErrorMessage(failure, 'Current terms could not load. The old request remains; you can cancel it or contact the seller.'));
        } finally { pending.current = false; if (isCurrentAuthSession(session)) setBusy(false); }
    };
    const renew = async () => {
        if (pending.current || !attempt && (!quote || !checked || quote.lines.some(line => !line.materialDigest || line.productVersion === undefined))) return;
        const session = getAuthSessionId();
        const input: Renewal = attempt ?? { requestId: crypto.randomUUID(), version: checked!.version, currency: quote!.currency,
            lines: quote!.lines.map(line => ({ variantId: line.variantId, quantity: line.quantity, productVersion: line.productVersion!, unitPrice: line.unitAmount / 100, materialDigest: line.materialDigest! })) };
        pending.current = true; setAttempt(input); setBusy(true); setError(''); setRefused(false);
        try { const current = await renewOrder(order.id, input, session); if (isCurrentAuthSession(session)) { setAttempt(null); setQuote(null); setChecked(null); onRenewed(current); } }
        catch (failure) { if (isCurrentAuthSession(session)) {
            const status = (failure as { response?: { status?: number } }).response?.status;
            setRefused([400, 404, 409].includes(status ?? 0));
            if (status === 403 || status === 404) {
                try { await fetchOrder(order.id, session); }
                catch (denial) {
                    const denied = (denial as { response?: { status?: number } }).response?.status;
                    if (isCurrentAuthSession(session) && (denied === 403 || denied === 404)) onUnavailable();
                }
                if (!isCurrentAuthSession(session)) return;
            }
            setError(extractApiErrorMessage(failure, 'The renewal result is uncertain. Retry the same renewal; its original identity and terms are kept.'));
        } } finally { pending.current = false; if (isCurrentAuthSession(session)) setBusy(false); }
    };
    return <section className="store-orders" aria-label="Review request terms">
        <Button disabled={busy || !!attempt && !refused} onClick={() => void review()}>Review current item terms</Button>
        {quote && <><p>Current item total: {formatStorePrice(quote.subtotal / 100, quote.currency)}. Renewing asks the seller to answer these terms; no stock or payment is taken.</p><QuotedMaterials lines={quote.lines} /></>}
        {error && <p role="alert">{error}</p>}
        {(quote || attempt) && <Button disabled={busy || refused} onClick={() => void renew()}>{attempt ? 'Retry same renewal' : 'Renew this request with these terms'}</Button>}
    </section>;
}
