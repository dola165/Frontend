import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { Button, Field, Panel } from '../../../design/primitives';
import { assertCurrentAuthSession, getAuthSessionId, isCurrentAuthSession } from '../../../utils/authStorage';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { clubToday } from '../api';
import { useClubEditorClose } from '../useClubEditorClose';
import { MoneyHistory } from './MoneyHistory';
import { readMoney, recordMoneyFact, recoverMoneyFact, type MoneyCommand, type MoneyRecord } from './api';
import { pendingFact, keepPendingFact, clearPendingFact, type PendingFact } from './pendingFact';

export function MoneyFacts({ club, id, revision, onChanged }: { club: number; id: number; revision: number; onChanged: () => Promise<void> }) {
    return <MoneyFactsSession key={`${club}:${id}:${getAuthSessionId()}`} club={club} id={id} revision={revision} onChanged={onChanged} />;
}
function MoneyFactsSession({ club, id, revision, onChanged }: { club: number; id: number; revision: number; onChanged: () => Promise<void> }) {
    const [session] = useState(getAuthSessionId);
    const scope = `gk-money-fact:${session}:${club}:${id}`;
    const [initial] = useState(() => { try { return { pending: pendingFact(scope), error: '' }; } catch { return { pending: null, error: 'The pending request could not be read. No new fact was sent.' }; } });
    const [pending, setPending] = useState<PendingFact | null>(initial.pending);
    const draft = initial.pending?.body;
    const [type, setType] = useState<MoneyCommand['type']>(draft?.type ?? 'RECEIPT');
    const [amount, setAmount] = useState(draft?.amount ?? ''), [date, setDate] = useState(draft?.happenedOn ?? clubToday());
    const [reference, setReference] = useState(draft?.reference ?? ''), [reason, setReason] = useState(draft?.reason ?? ''), [target, setTarget] = useState(draft?.reverses?.toString() ?? '');
    const [error, setError] = useState(initial.error), [reload, setReload] = useState(0), [busy, setBusy] = useState(false);
    const [saved, setSaved] = useState(false), [needsRefresh, setNeedsRefresh] = useState(false), [message, setMessage] = useState('');
    const key = `${revision}:${reload}`;
    const [result, setResult] = useState<{ key: string; record?: MoneyRecord } | null>(null);
    const data = result?.key === key ? result.record : undefined;
    const active = useRef(true), saving = useRef(false), readSequence = useRef(0);
    const currentRequest = useRef<PendingFact | null>(null);
    const errorNotice = useRef<HTMLDivElement>(null);
    useEffect(() => { if (error) errorNotice.current?.scrollIntoView?.({ block: 'center' }); }, [error]);
    const ownsRequest = (request: PendingFact) => active.current && isCurrentAuthSession(session) && currentRequest.current === request;
    const finish = (request: PendingFact) => {
        if (!ownsRequest(request)) return;
        currentRequest.current = null; saving.current = false; setBusy(false);
    };
    const { confirmation } = useClubEditorClose(!saved && Boolean(amount || reference || reason || target), busy || Boolean(pending), () => {});
    useLayoutEffect(() => { active.current = true; return () => { active.current = false; currentRequest.current = null; }; }, []);
    useEffect(() => {
        const c = new AbortController(), sequence = ++readSequence.current;
        void readMoney(club, id, c.signal).then(record => {
            if (!c.signal.aborted && isCurrentAuthSession(session) && sequence === readSequence.current) {
                setResult({ key, record }); setError(initial.error); setNeedsRefresh(false);
            }
        }).catch(e => {
            if (!c.signal.aborted && isCurrentAuthSession(session) && sequence === readSequence.current) {
                setResult({ key }); setError(extractApiErrorMessage(e, 'Money records could not load.'));
            }
        });
        return () => c.abort();
    }, [club, id, key, session, initial.error]);
    const refreshSaved = async (request: PendingFact) => {
        try { await onChanged(); } catch { if (ownsRequest(request)) setError('Fact recorded. The surrounding page could not refresh. Refresh the saved record below.'); }
    };
    const accept = async (record: MoneyRecord, request: PendingFact) => {
        if (!ownsRequest(request) || !clearPendingFact(scope, request.key)) return;
        ++readSequence.current; setPending(null); setResult({ key, record }); setSaved(true); setNeedsRefresh(false);
        await refreshSaved(request);
    };
    const submit = async (e: FormEvent) => {
        e.preventDefault(); if (!active.current || !isCurrentAuthSession(session) || !data || saving.current || needsRefresh || initial.error || pending && !pending.body) return;
        const request = pending ?? { key: crypto.randomUUID(), body: { type, revision: data.revision, amount: type === 'CORRECTION' ? null : amount, happenedOn: date, reference: type === 'RECEIPT' ? reference || null : null, reason, reverses: type === 'CORRECTION' ? Number(target) : null } };
        // Persist the exact operation before sending; a storage failure cannot become an uncertain write.
        try { assertCurrentAuthSession(session); keepPendingFact(scope, request); }
        catch { setError('Could not retain a recoverable request in this tab. No fact was sent.'); return; }
        currentRequest.current = request; saving.current = true; setBusy(true); setError(''); setPending(request);
        try {
            const record = await recordMoneyFact(club, id, request.body!, request.key, session);
            await accept(record, request);
        } catch (e) {
            if (!ownsRequest(request) || pendingFact(scope)?.key !== request.key) return;
            const status = (e as { response?: { status?: number } }).response?.status;
            // A definitive validation/version refusal cannot have appended this immutable operation.
            // Auth/unknown failures retain the same request for recovery after authority is re-established.
            if (status && [400, 409, 422].includes(status)) {
                if (!clearPendingFact(scope, request.key)) return;
                setPending(null); if (status === 409) setNeedsRefresh(true);
            }
            setError(extractApiErrorMessage(e, 'The result is unknown. Retry the same fact to recover its receipt.'));
        } finally { finish(request); }
    };
    const reconcile = async () => {
        if (!active.current || !isCurrentAuthSession(session) || !pending || saving.current) return;
        const request = pending;
        currentRequest.current = request; saving.current = true; setBusy(true); setError('');
        try {
            assertCurrentAuthSession(session);
            const recovery = await recoverMoneyFact(club, id, request.key, session);
            if (!ownsRequest(request)) return;
            if (recovery.outcome === 'RECORDED') await accept(recovery.record, request);
            else {
                if (!clearPendingFact(scope, request.key)) return;
                ++readSequence.current; setPending(null); setResult({ key, record: recovery.record });
                setMessage('The earlier attempt did not record a money fact and is now closed.');
            }
        } catch (e) { if (ownsRequest(request) && pendingFact(scope)?.key === request.key) setError(extractApiErrorMessage(e, 'The previous attempt could not be resolved.')); }
        finally { finish(request); }
    };
    const corrected = new Set(data?.history.filter(f => f.type === 'CORRECTION').map(f => f.reverses));
    return <Panel padded title="Dues and outside money">
        {confirmation}
        {error && <div ref={errorNotice} role="alert" className="gk-notice gk-notice--danger">{error}</div>}
        {message && <p role="status">{message}</p>}
        {pending && <div role="status"><p>Resolve the earlier attempt before recording another fact. Recovery checks its outcome and closes an unrecorded attempt.</p><Button disabled={busy} onClick={() => void reconcile()}>Resolve previous attempt</Button></div>}
        {!data ? <><p role="status">{error ? 'Balance unavailable' : 'Loading money records…'}</p><Button onClick={() => setReload(v => v + 1)}>Retry money records</Button></> : <>
            <MoneyHistory record={data} />
            {saved ? <div role="status"><p>Outside fact recorded.</p><Button onClick={() => { setSaved(false); setAmount(''); setReason(''); setReference(''); setTarget(''); setReload(v => v + 1); }}>Refresh saved record</Button></div>
                : <>
                    {!pending && <Button disabled={busy} onClick={() => setReload(v => v + 1)}>Refresh balance</Button>}
                    {needsRefresh && <p role="status">Refresh the balance, review your retained entry, then submit it explicitly.</p>}
                    {data.canRecord && data.balance.remaining != null && !initial.error && <form className="club-money gk-stack gk-stack--tight" onSubmit={e => void submit(e)}>
                        <p className="gk-muted">Record what happened outside the app. The club records this fact; no payment is processed. The family can see these details.</p>
                        <fieldset disabled={busy || Boolean(pending)} className="gk-stack gk-stack--tight">
                            <Field label="Outside fact" htmlFor={`money-type-${id}`}><select id={`money-type-${id}`} className="gk-input" value={type} onChange={e => setType(e.target.value as MoneyCommand['type'])}><option value="RECEIPT">Outside receipt</option><option value="WAIVER">Waiver</option><option value="CORRECTION">Reverse an incorrect fact</option></select></Field>
                            {type === 'CORRECTION' ? <Field label="Fact to reverse" htmlFor={`money-target-${id}`}><select id={`money-target-${id}`} className="gk-input" required value={target} onChange={e => setTarget(e.target.value)}><option value="">Choose a receipt or waiver</option>{data.openingStatus && ['PAID', 'WAIVED'].includes(data.openingStatus) && !corrected.has(0) && <option value="0">Earlier recorded settlement · {data.openingStatus}</option>}{data.history.filter(f => f.type !== 'CORRECTION' && !corrected.has(f.id)).map(f => <option key={f.id} value={f.id}>#{f.id} · {f.type} · {f.amount} {f.currency} · {f.happenedOn}</option>)}</select></Field>
                                : <Field label={`Amount · ${data.balance.currency}`} htmlFor={`money-amount-${id}`}><input id={`money-amount-${id}`} className="gk-input" inputMode="decimal" required pattern="[0-9]{1,10}(\.[0-9]{1,2})?" value={amount} onChange={e => setAmount(e.target.value)} /></Field>}
                            <Field label="Date it happened" htmlFor={`money-date-${id}`}><input id={`money-date-${id}`} className="gk-input" type="date" required max={clubToday()} value={date} onChange={e => setDate(e.target.value)} /></Field>
                            {type === 'RECEIPT' && <Field label="Outside receipt reference" htmlFor={`money-ref-${id}`}><input id={`money-ref-${id}`} className="gk-input" required maxLength={160} value={reference} onChange={e => setReference(e.target.value)} /></Field>}
                            <Field label="Reason or details for the family" htmlFor={`money-reason-${id}`}><textarea id={`money-reason-${id}`} className="gk-input" required maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} /></Field>
                        </fieldset>
                        <Button type="submit" disabled={busy || needsRefresh || Boolean(pending && !pending.body)}>{busy ? 'Recording…' : pending ? 'Retry the same fact' : 'Record outside fact'}</Button>
                    </form>}
                </>}
        </>}
    </Panel>;
}
