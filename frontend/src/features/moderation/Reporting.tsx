import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/axiosConfig';
import { extractApiErrorMessage } from '../../utils/apiError';
import './moderation.css';
import { label, type Receipt } from './domain';
import { useReportingCopy } from './reportingCopy';

export function OwnSafetyLink({ className }: { className?: string }) { const copy = useReportingCopy(); return <Link to="/reports" className={className}>{copy('Reports & safety')}</Link>; }

export function ReportControl({ targetType, targetId, conversationId, personId, className }: { targetType: 'ACCOUNT' | 'MESSAGE'; targetId: number; conversationId?: number; personId: number; className?: string }) {
    const copy = useReportingCopy();
    const [open, setOpen] = useState(false);
    return <><button type="button" className={className ?? 'moderation-trigger'} onClick={() => setOpen(true)} aria-label={copy(targetType === 'MESSAGE' ? 'Report message' : 'Report or block account')}>{copy(targetType === 'MESSAGE' ? 'Report' : 'Report / block')}</button>
        {open && <ReportDialog key={`${targetType}:${targetId}`} targetType={targetType} targetId={targetId} conversationId={conversationId} personId={personId} onClose={() => setOpen(false)} />}</>;
}

function ReportDialog({ targetType, targetId, conversationId, personId, onClose }: { targetType: 'ACCOUNT' | 'MESSAGE'; targetId: number; conversationId?: number; personId: number; onClose: () => void }) {
    const copy = useReportingCopy();
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
        <div className="moderation-heading"><h2 id={title}>{copy(targetType === 'MESSAGE' ? 'Report message' : 'Report account')}</h2><button type="button" disabled={busy} onClick={onClose} aria-label={copy('Close report')}>{copy('Close')}</button></div>
        <p>{copy('A human moderator will review your concern. Reporting does not automatically restrict anyone. The reported person cannot see who reported them.')}</p>
        {receipt ? <div role="status"><strong>{copy(`Report #${receipt.id}`, `საჩივარი #${receipt.id}`)} · {copy(label(receipt.status))}</strong><p>{copy('This receipt also appears if you already reported this item.')}</p><Link to={`/reports?itemId=${receipt.id}`} onClick={onClose}>{copy('Open private receipt')}</Link></div> : <form onSubmit={event => { event.preventDefault(); void submit(); }}>
            <label>{copy('Reason')}<select value={reason} onChange={e => setReason(e.target.value)} disabled={busy}>{['SAFETY', 'HARASSMENT', 'SPAM', 'IMPERSONATION', 'OTHER'].map(value => <option value={value} key={value}>{copy(label(value))}</option>)}</select></label>
            <label>{copy('What happened? (optional)')}<textarea maxLength={1500} rows={4} value={description} disabled={busy} onChange={e => setDescription(e.target.value)} placeholder={copy('Describe this incident. Avoid unrelated private information.')} /></label><small>{copy(`${description.length}/1500 characters`, `${description.length}/1500 სიმბოლო`)}</small>
            <p>{copy(targetType === 'MESSAGE' ? 'Only this message and your description are kept for review, for up to 90 days. Other conversations and restricted profile details are not copied.' : 'Only this account’s public bio, when available, and your description are kept for review, for up to 90 days. Other conversations and restricted profile details are not copied.')}</p>
            {error && <p role="alert">{copy(error)}</p>}<button type="submit" disabled={busy}>{copy(busy ? 'Sending…' : error ? 'Retry report' : 'Send report')}</button>
        </form>}
        <BlockControl personId={personId} />
        <p className="moderation-muted">{copy('If someone is in immediate danger, contact local emergency services or a trusted adult. Reports are not an emergency service.')}</p>
    </dialog>;
}

function BlockControl({ personId }: { personId: number }) {
    const copy = useReportingCopy();
    const [blocked, setBlocked] = useState<boolean | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [revision, refresh] = useState(0);
    const pending = useRef(false);
    useEffect(() => { const abort = new AbortController(); apiClient.get<{ blocked: boolean }>(`/users/${personId}/personal-block`, { signal: abort.signal }).then(({ data }) => { if (!abort.signal.aborted) { setBlocked(data.blocked); setError(''); } }).catch(e => { if (!abort.signal.aborted) setError(extractApiErrorMessage(e, 'Could not load your block setting.')); }); return () => abort.abort(); }, [personId, revision]);
    const change = async () => { if (blocked === null || pending.current) return; pending.current = true; setBusy(true); setError(''); try { const { data } = await apiClient.put<{ blocked: boolean }>(`/users/${personId}/personal-block`, { blocked: !blocked }); setBlocked(data.blocked); } catch (e) { setError(extractApiErrorMessage(e, 'Could not update your block setting. Retry is safe.')); } finally { pending.current = false; setBusy(false); } };
    return <section className="moderation-block"><h3>{copy('Personal blocking')}</h3><p>{copy('Stops personal messages in either direction. Required shared squad or club conversations remain available.')}</p>{blocked === null ? <p role="status">{copy('Loading block setting…')}</p> : <p role="status">{copy(blocked ? 'This person is blocked by you.' : 'This person is not blocked by you.')}</p>}{error && <p role="alert">{copy(error)} <button type="button" onClick={() => refresh(v => v + 1)}>{copy('Refresh setting')}</button></p>}<button type="button" disabled={blocked === null || busy} onClick={() => void change()}>{copy(busy ? 'Saving…' : blocked ? 'Unblock person' : 'Block person')}</button></section>;
}
