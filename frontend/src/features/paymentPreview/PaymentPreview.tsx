import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowRight, CheckCircle2, FlaskConical, RotateCcw, XCircle } from 'lucide-react';
import { getAuthSessionId, getStoredUserId, subscribeAuthSession } from '../../utils/authStorage';
import { formatDateTime, formatMoney } from '../../utils/formatting';
import { paymentPreviewEnabled } from './config';
import { previewKey, readPreviewRecords, type PreviewPayment, type PreviewRecord } from './records';
import './payment-preview.css';

const browserScope = () => {
    try { return `${getStoredUserId() ?? 'guest'}:${getAuthSessionId() ?? 'local'}`; }
    catch { return 'visit'; }
};
interface Props {
    payment: PreviewPayment;
    validate: () => Promise<void>;
    disabled?: boolean;
}

export function PaymentPreviewNotice({ campaign = false }: { campaign?: boolean }) {
    if (!paymentPreviewEnabled()) return null;
    return <div className="payment-preview-notice"><FlaskConical size={18} aria-hidden="true" /><p><strong>Test payments are on</strong><span>{campaign ? 'Open a campaign to try a contribution.' : 'Choose products, then try checkout in your cart.'} No money is charged.</span></p></div>;
}

export function PaymentPreview(props: Props) {
    const scope = useSyncExternalStore(subscribeAuthSession, browserScope);
    if (!paymentPreviewEnabled()) return null;
    return <PreviewForm key={`${scope}:${JSON.stringify(props.payment)}`} {...props} scope={scope} />;
}

function PreviewForm({ payment, validate, disabled, scope }: Props & { scope: string }) {
    const [outcome, setOutcome] = useState<'paid' | 'declined'>('paid');
    const [records, setRecords] = useState(() => readPreviewRecords(scope));
    const [result, setResult] = useState<PreviewRecord | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [warning, setWarning] = useState('');
    const [refundId, setRefundId] = useState<string | null>(null);
    const submitted = useRef(false);
    const mounted = useRef(true);
    useEffect(() => {
        mounted.current = true;
        const sync = (event: StorageEvent) => {
            if (event.key === previewKey(scope) || event.key === null) setRecords(readPreviewRecords(scope));
        };
        window.addEventListener('storage', sync);
        return () => { mounted.current = false; window.removeEventListener('storage', sync); };
    }, [scope]);
    const persist = (next: PreviewRecord[]) => {
        setRecords(next);
        try { localStorage.setItem(previewKey(scope), JSON.stringify(next)); }
        catch { setWarning('This result is only available for this visit because browser storage could not save it.'); }
    };
    const simulate = async () => {
        if (submitted.current || disabled || payment.amount <= 0) return;
        submitted.current = true;
        setBusy(true); setError('');
        try {
            await validate();
            if (!mounted.current || browserScope() !== scope) return;
            const record: PreviewRecord = { ...payment, id: `TEST-${crypto.randomUUID()}`, createdAt: new Date().toISOString(), status: outcome };
            persist([record, ...readPreviewRecords(scope), ...records].filter((r, i, all) => all.findIndex(other => other.id === r.id) === i).slice(0, 100));
            setResult(record);
        } catch (e) {
            if (mounted.current) { setError(e instanceof Error ? e.message : 'The latest details could not be checked. Please retry.'); submitted.current = false; }
        } finally { if (mounted.current) setBusy(false); }
    };
    const history = records.filter(r => r.kind === payment.kind && r.sourceId === payment.sourceId);
    return <section className="payment-preview" aria-label={payment.kind === 'order' ? 'Test checkout' : 'Test contribution'}>
        <header><span className="payment-preview-badge"><FlaskConical size={14} />TEST MODE · NO CHARGE</span><h2>{payment.kind === 'order' ? 'Try checkout with your cart' : 'Try supporting this campaign'}</h2><p>{payment.kind === 'order' ? 'Your selected products, sizes and current store prices.' : payment.title}</p></header>
        <div className="payment-preview-total"><span>{payment.clubName}<small>{payment.kind === 'order' ? 'Products only · delivery and taxes excluded' : 'Test contribution'}</small></span><strong>{formatMoney(payment.amount / 100, payment.currency)}</strong></div>
        {result ? <div className={`payment-preview-result ${result.status === 'declined' ? 'is-declined' : ''}`} role="status">
            {result.status === 'declined' ? <XCircle size={24} /> : <CheckCircle2 size={24} />}<div><h3>{result.status === 'declined' ? 'Test payment declined' : 'Test payment successful'}</h3><p>{result.status === 'declined' ? 'Try again with a successful result. No money was charged.' : 'Your test record is below. No money was charged.'}</p><button type="button" onClick={() => { submitted.current = false; setResult(null); setOutcome('paid'); }}>Try another test</button></div>
        </div> : <form onSubmit={event => { event.preventDefault(); void simulate(); }}>
            <fieldset disabled={busy || disabled}><legend>Choose the result to simulate</legend><div className="payment-preview-outcomes">{(['paid', 'declined'] as const).map(value => <label key={value}><input type="radio" name={`outcome-${payment.kind}-${payment.sourceId}`} checked={outcome === value} onChange={() => setOutcome(value)} />{value === 'paid' ? 'Successful payment' : 'Declined payment'}</label>)}</div></fieldset>
            <button type="submit" className="payment-preview-primary" disabled={busy || disabled}>{busy ? 'Checking latest details…' : payment.kind === 'order' ? 'Simulate checkout' : 'Simulate contribution'}<ArrowRight size={17} /></button>
        </form>}
        {error && <p role="alert" className="payment-preview-error">{error}</p>}
        {warning && <p role="status">{warning}</p>}
        <p className="payment-preview-footnote">{payment.kind === 'order' ? 'This is a test, not an order. Your cart stays ready to use; stock is not reserved.' : 'This is a test, not a donation. The campaign’s published total stays unchanged.'} No card details needed.</p>
        {history.length > 0 && <details className="payment-preview-history" open={!!result}><summary>Test activity ({history.length})</summary><p>Saved in this browser for this session. These are test records, not receipts.</p><ul>{history.map(record => <li key={record.id}>
            <div><strong>{record.title}</strong><span>{formatMoney(record.amount / 100, record.currency)} · {record.status === 'paid' ? 'Test successful' : record.status === 'declined' ? 'Test declined' : 'Test refunded'}</span><small>{formatDateTime(record.createdAt)} · {record.id.slice(0, 13)}</small></div>
            {record.lines.length > 0 && <p>{record.lines.join(' · ')}</p>}
            {record.status === 'paid' && (refundId === record.id ? <div className="payment-preview-refund"><p>Simulate a full refund of {formatMoney(record.amount / 100, record.currency)}?</p><button type="button" onClick={() => { persist(records.map(r => r.id === record.id ? { ...r, status: 'refunded' } : r)); setRefundId(null); }}>Confirm test refund</button><button type="button" onClick={() => setRefundId(null)}>Cancel</button></div> : <button type="button" onClick={() => setRefundId(record.id)}><RotateCcw size={13} />Test a refund</button>)}
        </li>)}</ul></details>}
    </section>;
}
