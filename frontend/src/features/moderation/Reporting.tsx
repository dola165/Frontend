import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/axiosConfig';
import { extractApiErrorMessage } from '../../utils/apiError';
import './moderation.css';
import { label, type Receipt } from './domain';

export function OwnSafetyLink({ className }: { className?: string }) { return <Link to="/reports" className={className}>Reports &amp; safety</Link>; }

export function ReportControl({ targetType, targetId, conversationId, personId, className }: { targetType: 'ACCOUNT' | 'MESSAGE'; targetId: number; conversationId?: number; personId: number; className?: string }) {
    const [open, setOpen] = useState(false);
    return <><button type="button" className={className ?? 'moderation-trigger'} onClick={() => setOpen(true)} aria-label={targetType === 'MESSAGE' ? 'Report message' : 'Report or block account'}>{targetType === 'MESSAGE' ? 'Report' : 'Report / block'}</button>
        {open && <ReportDialog key={`${targetType}:${targetId}`} targetType={targetType} targetId={targetId} conversationId={conversationId} personId={personId} onClose={() => setOpen(false)} />}</>;
}

function ReportDialog({ targetType, targetId, conversationId, personId, onClose }: { targetType: 'ACCOUNT' | 'MESSAGE'; targetId: number; conversationId?: number; personId: number; onClose: () => void }) {
    const dialog = useRef<HTMLDialogElement>(null), title = useId(), pending = useRef(false);
    const [reason, setReason] = useState('SAFETY'), [description, setDescription] = useState('');
    const [requestId] = useState(() => crypto.randomUUID());
    const [receipt, setReceipt] = useState<Receipt | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
    useEffect(() => { const previous = document.activeElement as HTMLElement | null; dialog.current?.showModal(); return () => previous?.focus(); }, []);
    const submit = async () => {
        if (pending.current) return; pending.current = true; setBusy(true); setError('');
        try { const { data } = await apiClient.post<Receipt>('/reports', { targetType, targetId, conversationId, requestId, reason, description }); setReceipt(data); }
        catch (e) { setError(extractApiErrorMessage(e, 'Could not send the report. Retry to check whether it was received.')); }
        finally { pending.current = false; setBusy(false); }
    };
    return <dialog ref={dialog} className="moderation-dialog moderation" aria-labelledby={title} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
        <div className="moderation-heading"><h2 id={title}>Report {targetType === 'MESSAGE' ? 'message' : 'account'}</h2><button type="button" disabled={busy} onClick={onClose} aria-label="Close report">Close</button></div>
        <p>A human moderator will review your concern. Reporting does not automatically restrict anyone. The reported person cannot see who reported them.</p>
        {receipt ? <div role="status"><strong>Report #{receipt.id} · {label(receipt.status)}</strong><p>This receipt also appears if you already reported this item.</p><Link to={`/reports?itemId=${receipt.id}`} onClick={onClose}>Open private receipt</Link></div> : <form onSubmit={event => { event.preventDefault(); void submit(); }}>
            <label>Reason<select value={reason} onChange={e => setReason(e.target.value)} disabled={busy}>{['SAFETY', 'HARASSMENT', 'SPAM', 'IMPERSONATION', 'OTHER'].map(value => <option value={value} key={value}>{label(value)}</option>)}</select></label>
            <label>What happened? (optional)<textarea maxLength={1500} rows={4} value={description} disabled={busy} onChange={e => setDescription(e.target.value)} placeholder="Describe this incident. Avoid unrelated private information." /></label><small>{description.length}/1500 characters</small>
            <p>Only this {targetType === 'MESSAGE' ? 'message' : 'account’s public bio, when available'} and your description are kept for review, for up to 90 days. Other conversations and restricted profile details are not copied.</p>
            {error && <p role="alert">{error}</p>}<button type="submit" disabled={busy}>{busy ? 'Sending…' : error ? 'Retry report' : 'Send report'}</button>
        </form>}
        <BlockControl personId={personId} />
        <p className="moderation-muted">If someone is in immediate danger, contact local emergency services or a trusted adult. Reports are not an emergency service.</p>
    </dialog>;
}

function BlockControl({ personId }: { personId: number }) {
    const [blocked, setBlocked] = useState<boolean | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [revision, refresh] = useState(0);
    const pending = useRef(false);
    useEffect(() => { const abort = new AbortController(); apiClient.get<{ blocked: boolean }>(`/users/${personId}/personal-block`, { signal: abort.signal }).then(({ data }) => { if (!abort.signal.aborted) { setBlocked(data.blocked); setError(''); } }).catch(e => { if (!abort.signal.aborted) setError(extractApiErrorMessage(e, 'Could not load your block setting.')); }); return () => abort.abort(); }, [personId, revision]);
    const change = async () => { if (blocked === null || pending.current) return; pending.current = true; setBusy(true); setError(''); try { const { data } = await apiClient.put<{ blocked: boolean }>(`/users/${personId}/personal-block`, { blocked: !blocked }); setBlocked(data.blocked); } catch (e) { setError(extractApiErrorMessage(e, 'Could not update your block setting. Retry is safe.')); } finally { pending.current = false; setBusy(false); } };
    return <section className="moderation-block"><h3>Personal blocking</h3><p>Stops personal messages in either direction. Required shared squad or club conversations remain available.</p>{blocked === null ? <p role="status">Loading block setting…</p> : <p role="status">{blocked ? 'This person is blocked by you.' : 'This person is not blocked by you.'}</p>}{error && <p role="alert">{error} <button type="button" onClick={() => refresh(v => v + 1)}>Refresh setting</button></p>}<button type="button" disabled={blocked === null || busy} onClick={() => void change()}>{busy ? 'Saving…' : blocked ? 'Unblock person' : 'Block person'}</button></section>;
}
