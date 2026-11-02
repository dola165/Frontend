import { promptEmailConfirmation } from '../../../components/auth/emailConfirmationPrompt';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCommerceDraftState } from '../../../components/workspace/commerceDraftState';
import { Button, Field } from '../../../design/primitives';
import { getAuthSessionId, isCurrentAuthSession } from '../../../utils/authStorage';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { formatStorePrice } from '../api';
import { commandOrder, fetchOrder, type OrderAction, type OrderCommand, type StoreOrder } from './api';
import { RenewRequest } from './RenewRequest';
import { QuotedMaterials } from './QuotedMaterials';
import './orders.css';

export function StoreOrderCard({ order: supplied, seller, onChanged }: { order: StoreOrder; seller: boolean; onChanged: () => void }) {
    const [reviewed, setReviewed] = useState<StoreOrder | null>(null), [denied, setDenied] = useState(false);
    const order = reviewed && reviewed.version >= supplied.version ? reviewed : supplied;
    const [note, setNote] = useCommerceDraftState('note', ''), [error, setError] = useState('');
    const [action, setAction] = useCommerceDraftState<OrderAction>('action', 'ACCEPT');
    const [attempt, setAttempt] = useCommerceDraftState<OrderCommand | null>('attempt', null), [busy, setBusy] = useState(false);
    const [refused, setRefused] = useState(false);
    const pending = useRef(false);
    const live = ['REQUESTED', 'ACCEPTED'].includes(order.status);
    const actions: OrderAction[] = seller ? [
        ...(order.status === 'REQUESTED' ? ['ACCEPT', 'DECLINE'] as const : []),
        ...(order.status === 'ACCEPTED' ? ['FULFILL'] as const : []),
        ...(live ? ['CANCEL'] as const : []),
        ...(['ACCEPTED', 'FULFILLED'].includes(order.status) && order.settlement === 'UNREPORTED' ? ['REPORT_EXTERNAL_SETTLEMENT'] as const : []),
    ] : live ? ['CANCEL'] : [];
    const selected = actions.includes(action) ? action : actions[0];
    const labels: Record<OrderAction, string> = { ACCEPT: 'Accept and reserve stock', DECLINE: 'Decline request', CANCEL: 'Cancel and release any reservation', FULFILL: order.fulfillment === 'COLLECTION' ? 'Record actual collection' : 'Record actual delivery', REPORT_EXTERNAL_SETTLEMENT: 'Report full settlement outside GrassKickZ' };
    const review = async (retire: boolean) => {
        const session = getAuthSessionId();
        try {
            const current = await fetchOrder(order.id, session);
            if (!isCurrentAuthSession(session)) return;
            setReviewed(current);
            if (retire) { setAttempt(null); setRefused(false); setError(''); }
        } catch (failure) {
            if (!isCurrentAuthSession(session)) return;
            const code = (failure as { response?: { status?: number } }).response?.status;
            if (code === 403 || code === 404) { setDenied(true); onChanged(); }
            else setError('The current private request could not be checked. Your original action and note are kept. Retry the check.');
        }
    };
    const send = () => {
        if (pending.current || !selected) return;
        const session = getAuthSessionId();
        const input = attempt ?? { requestId: crypto.randomUUID(), version: order.version, action: selected, note,
            ...(selected === 'REPORT_EXTERNAL_SETTLEMENT' ? { externalAmount: order.total, externalCurrency: order.currency } : {}) };
        setAttempt(input); setBusy(true); setError(''); setRefused(false); pending.current = true;
        void commandOrder(order.id, input, session).then(() => { if (isCurrentAuthSession(session)) { setAttempt(null); setNote(''); onChanged(); } })
            .catch(failure => { if (isCurrentAuthSession(session)) { promptEmailConfirmation(failure); setRefused([400, 404, 409].includes(failure?.response?.status)); if ([403, 404].includes(failure?.response?.status)) void review(false); setError(extractApiErrorMessage(failure, 'Could not confirm this change. Retry the same action or refresh requests to check the saved state.')); } })
            .finally(() => { pending.current = false; if (isCurrentAuthSession(session)) setBusy(false); });
    };
    if (denied) return <p role="alert">This private request is unavailable under your current access.</p>;
    return <article className="gk-panel store-orders__card">
        <header><h3>{order.sellerName}</h3><p>{order.status.toLowerCase()} · {order.fulfillment.toLowerCase()} · {formatStorePrice(order.total, order.currency)}</p><small>Request {order.id} · {new Date(order.createdAt).toLocaleString()}</small></header>
        <ul>{order.lines.map(line => <li key={line.originalVariantId}><Link to={`/store/products/${line.productId}`}>{line.name}</Link> · {line.variant} × {line.quantity} · {formatStorePrice(line.unitPrice, order.currency)} each</li>)}</ul>
        {seller && <p>Buyer contact: {order.buyerContact}</p>}
        {order.buyerNote && <p>Buyer message: {order.buyerNote}</p>}
        {order.sellerAnswer && <p>Seller answer: {order.sellerAnswer}</p>}
        {order.status === 'REQUESTED' && <p>Waiting for the seller. Stock is not reserved. You can contact the seller directly.</p>}
        {order.status === 'ACCEPTED' && <p>Items reserved. Follow the seller’s answer to arrange payment and {order.fulfillment.toLowerCase()}.</p>}
        <p>{order.settlement === 'SELLER_REPORTED_EXTERNAL' ? 'Seller reported the full amount settled outside GrassKickZ. This is not a processed or verified payment.' : 'No outside settlement has been reported. This does not establish whether money changed hands.'}</p>
        {order.status === 'CANCELLED' && order.settlement === 'SELLER_REPORTED_EXTERNAL' && <p>Reservation released. Arrange any return of money directly with the seller; no refund was processed here.</p>}
        {actions.length > 0 && <form onSubmit={e => { e.preventDefault(); send(); }}>
            <fieldset disabled={busy || !!attempt}>
                <Field label="Action" htmlFor={`action-${order.id}`}><select className="gk-input" id={`action-${order.id}`} value={selected} onChange={e => setAction(e.target.value as OrderAction)}>{actions.map(value => <option key={value} value={value}>{labels[value]}</option>)}</select></Field>
                <Field label={selected === 'REPORT_EXTERNAL_SETTLEMENT' ? 'Actual outside payment method and date' : 'Answer or arrangement'} htmlFor={`note-${order.id}`}><textarea className="gk-input" id={`note-${order.id}`} maxLength={1000} required={selected !== 'CANCEL' || order.settlement === 'SELLER_REPORTED_EXTERNAL'} value={note} onChange={e => setNote(e.target.value)} /></Field>
                {selected === 'REPORT_EXTERNAL_SETTLEMENT' && <p>You are reporting {formatStorePrice(order.total, order.currency)} received outside GrassKickZ. No provider confirmation is created.</p>}
            </fieldset>
            {error && <p role="alert">{error}</p>}
            {refused && !busy && <Button onClick={() => void review(true)}>Review latest request</Button>}
            <Button type="submit" disabled={busy}>{busy ? 'Saving…' : attempt ? 'Retry same action' : labels[selected]}</Button>
        </form>}
        <QuotedMaterials lines={order.lines} />
        {!seller && order.status === 'REQUESTED' && <RenewRequest order={order} onUnavailable={() => { setDenied(true); onChanged(); }} onRenewed={current => { setReviewed(current); onChanged(); }} />}
        <details><summary>Agreement history</summary><ol>{order.history.map(event => <li key={event.version}>{event.action.toLowerCase().replaceAll('_', ' ')} · {new Date(event.createdAt).toLocaleString()} · Account {event.actorId}{event.note && <p>{event.note}</p>}{event.previousTerms && <div>Previously requested: {formatStorePrice(event.previousTerms.total, event.previousTerms.currency)}<QuotedMaterials lines={event.previousTerms.lines} /></div>}{event.terms && <div>Reviewed item total: {formatStorePrice(event.terms.total, event.terms.currency)}<QuotedMaterials lines={event.terms.lines} /></div>}</li>)}</ol></details>
    </article>;
}
