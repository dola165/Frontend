import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiClient } from '../../api/axiosConfig';
import { extractApiErrorMessage } from '../../utils/apiError';
import { label } from './domain';
import './moderation.css';
type Row = { id: number; targetType: string; reason: string; status: string; createdAt: string; version: number };
type Detail = Row & { targetId: number; targetUserId: number | null; description: string | null; evidence: string | null; evidenceExpiresAt: string; targetState: string; actions: string[]; history: { id: number; reviewerId: number | null; action: string; note: string | null; createdAt: string }[] };
const actions: Record<string, string> = { NO_ACTION: 'Close without action', DISMISS: 'Dismiss report', WARN_ACCOUNT: 'Warn account', REMOVE_MESSAGE: 'Remove message', REMOVE_POST: 'Remove post' };

export function ModerationPanel() {
    const [status, setStatus] = useState('OPEN'), [before, setBefore] = useState<number | null>(null), [revision, refresh] = useState(0);
    const [params, setParams] = useSearchParams(), item = params.get('itemId');
    const selectedId = item && /^[1-9]\d*$/.test(item) && Number.isSafeInteger(Number(item)) ? Number(item) : null;
    if (selectedId) return <section className="moderation" aria-label="Selected moderation report"><button type="button" onClick={() => setParams({ tab: 'safety' })}>Back to moderation queue</button><h2>Review report #{selectedId}</h2><ReportDetail key={`${selectedId}:${revision}`} id={selectedId} onChanged={() => refresh(v => v + 1)} /></section>;
    return <section className="moderation" aria-label="People and message reports"><h2>People &amp; message reports</h2><p>Reports are allegations. Review the preserved item and record a reason before taking action. Access is checked against your current system administrator role.</p>
        <div className="moderation-controls"><label>Queue<select value={status} onChange={e => { setStatus(e.target.value); setBefore(null); }}>{['OPEN', 'RESOLVED', 'DISMISSED'].map(value => <option key={value} value={value}>{label(value)}</option>)}</select></label><button type="button" onClick={() => { setBefore(null); refresh(v => v + 1); }}>Refresh queue</button></div>
        <QueuePage key={`${status}:${before}:${revision}`} status={status} before={before} onChanged={() => refresh(v => v + 1)} onOlder={setBefore} />
    </section>;
}

function QueuePage({ status, before, onChanged, onOlder }: { status: string; before: number | null; onChanged: () => void; onOlder: (id: number) => void }) {
    const [rows, setRows] = useState<Row[]>([]);
    const [loading, setLoading] = useState(true), [error, setError] = useState(''), [selected, setSelected] = useState<number | null>(null);
    useEffect(() => { const abort = new AbortController(); apiClient.get<Row[]>('/admin/moderation-reports', { params: { status, ...(before ? { before } : {}) }, signal: abort.signal }).then(({ data }) => { if (!abort.signal.aborted) setRows(data); }).catch(e => { if (!abort.signal.aborted) setError(extractApiErrorMessage(e, 'Could not load the moderation queue. Current system administrator access is required.')); }).finally(() => { if (!abort.signal.aborted) setLoading(false); }); return () => abort.abort(); }, [status, before]);
    return <>{error && <p role="alert">{error}</p>}{loading ? <p role="status">Loading reports…</p> : !error && rows.length === 0 ? <p>No reports in this queue page.</p> : rows.map(row => <article key={row.id}><div className="moderation-heading"><div><h3>#{row.id} · {label(row.targetType)} · {label(row.reason)}</h3><small>{new Date(row.createdAt).toLocaleString()}</small></div><button type="button" onClick={() => setSelected(row.id)}>Review report #{row.id}</button></div>{selected === row.id && <ReportDetail key={row.id} id={row.id} onChanged={onChanged} />}</article>)}
        {rows.length === 30 && <button type="button" onClick={() => onOlder(rows[rows.length - 1].id)}>Older reports</button>}
    </>;
}

function ReportDetail({ id, onChanged }: { id: number; onChanged: () => void }) {
    const [detail, setDetail] = useState<Detail | null>(null), [error, setError] = useState(''), [action, setAction] = useState(''), [note, setNote] = useState(''), [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false), [revision, refresh] = useState(0);
    const pending = useRef(false);
    useEffect(() => { const abort = new AbortController(); setDetail(null); setError(''); setConfirm(false); setAction(''); apiClient.get<Detail>(`/admin/moderation-reports/${id}`, { signal: abort.signal }).then(({ data }) => { if (!abort.signal.aborted) setDetail(data); }).catch(e => { if (!abort.signal.aborted) setError(extractApiErrorMessage(e, 'Evidence is unavailable or your moderation authority changed.')); }); return () => abort.abort(); }, [id, revision]);
    const resolve = async () => { if (!detail || pending.current) return; pending.current = true; setBusy(true); setError(''); try { await apiClient.put(`/admin/moderation-reports/${id}`, { expectedVersion: detail.version, action, note }); onChanged(); } catch (e) { setDetail(null); setConfirm(false); setError(extractApiErrorMessage(e, 'Could not save the decision. Refresh the current report before retrying.')); } finally { pending.current = false; setBusy(false); } };
    return <div className="moderation-detail">{error && <p role="alert">{error} <button type="button" onClick={() => refresh(v => v + 1)}>Reload report</button></p>}{!detail && !error && <p role="status">Loading authorized evidence…</p>}{detail && <>
        <p><strong>{label(detail.targetType)} #{detail.targetId}:</strong> {label(detail.targetState)}. Snapshot evidence can differ from the current item.</p>{detail.targetUserId && <Link to={`/profile/${detail.targetUserId}`}>View reported account #{detail.targetUserId}</Link>}<h4>Reporter’s description</h4><p className="moderation-evidence">{detail.description || 'No description retained.'}</p><h4>Preserved item</h4><p className="moderation-evidence">{detail.evidence || 'No item text retained. Restricted profiles do not contribute private details.'}</p><small>Evidence expires {new Date(detail.evidenceExpiresAt).toLocaleDateString()}. Reviewer notes remain private.</small>
        {detail.actions.length > 0 && <form onSubmit={event => { event.preventDefault(); if (confirm) void resolve(); else setConfirm(true); }}><label>Review action<select required value={action} disabled={busy || confirm} onChange={e => setAction(e.target.value)}><option value="">Choose an action…</option>{detail.actions.map(value => <option key={value} value={value}>{actions[value]}</option>)}</select></label><label>Internal reason<textarea required maxLength={1500} rows={3} value={note} disabled={busy || confirm} onChange={e => setNote(e.target.value)} /></label>
            {confirm && <p role="status">Confirm “{actions[action]}”. {action === 'REMOVE_MESSAGE' ? 'This removes the message from history and queued delivery. Previously received copies cannot be recalled.' : action === 'REMOVE_POST' ? 'This removes the post and its comments. Shared posts will show that the original is unavailable.' : action === 'WARN_ACCOUNT' ? 'The person receives a private warning without reporter identity or evidence. Their account is not suspended.' : 'No account or content restriction will be applied.'} The reporter receives an outcome receipt.</p>}
            <div className="moderation-controls"><button type="submit" disabled={busy || !action || !note.trim()}>{busy ? 'Saving decision…' : confirm ? 'Confirm decision' : 'Review decision'}</button>{confirm && <button type="button" disabled={busy} onClick={() => setConfirm(false)}>Back to evidence</button>}</div></form>}
        <details><summary>Review history ({detail.history.length})</summary>{detail.history.map(entry => <p key={entry.id}><strong>{label(entry.action)}</strong>{entry.reviewerId && ` · Moderator #${entry.reviewerId}`} · {new Date(entry.createdAt).toLocaleString()}{entry.note && <span className="moderation-evidence">{entry.note}</span>}</p>)}</details>
    </>}</div>;
}
