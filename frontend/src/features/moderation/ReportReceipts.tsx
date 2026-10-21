import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiClient } from '../../api/axiosConfig';
import { extractApiErrorMessage } from '../../utils/apiError';
import { label, type Receipt } from './domain';
import './moderation.css';
type Notice = { id: number; action: string; reason: string; createdAt: string };

export function ReportReceipts() {
    const [params, setParams] = useSearchParams(), [rows, setRows] = useState<Receipt[]>([]), [notices, setNotices] = useState<Notice[]>([]);
    const [loading, setLoading] = useState(true), [error, setError] = useState(''), [revision, refresh] = useState(0), [before, setBefore] = useState<number | null>(null);
    const item = params.get('itemId'), noticeView = params.get('view') === 'notices';
    useEffect(() => { setBefore(null); }, [item, noticeView]);
    useEffect(() => { const abort = new AbortController(); setLoading(true); setError(''); setRows([]); setNotices([]);
        const load = async () => { try {
            if (noticeView) { const { data } = await apiClient.get<Notice[]>('/reports/notices', { params: before ? { before } : {}, signal: abort.signal }); if (!abort.signal.aborted) setNotices(data); }
            else if (item) { if (!/^[1-9]\d*$/.test(item) || !Number.isSafeInteger(Number(item))) throw new Error('Invalid receipt'); const { data } = await apiClient.get<Receipt>(`/reports/${item}`, { signal: abort.signal }); if (!abort.signal.aborted) setRows([data]); }
            else { const { data } = await apiClient.get<Receipt[]>('/reports', { params: before ? { before } : {}, signal: abort.signal }); if (!abort.signal.aborted) setRows(data); }
        } catch (e) { if (!abort.signal.aborted) setError(extractApiErrorMessage(e, 'Could not load this private receipt. It may belong to another account.')); } finally { if (!abort.signal.aborted) setLoading(false); } }; void load(); return () => abort.abort();
    }, [item, noticeView, before, revision]);
    return <main className="moderation moderation-page"><Link to="/account">Back to account</Link><h1>Reports &amp; safety</h1><p>Your private report receipts and notices from human moderators. Reporting does not automatically restrict an account. For a new account incident, you can submit another report 24 hours after the previous decision. The same message keeps one receipt.</p>
        <nav aria-label="Safety history"><button type="button" aria-pressed={!noticeView} onClick={() => { setBefore(null); setParams({}); }}>My reports</button><button type="button" aria-pressed={noticeView} onClick={() => { setBefore(null); setParams({ view: 'notices' }); }}>Account notices</button><button type="button" disabled={loading} onClick={() => refresh(v => v + 1)}>Refresh</button></nav>
        {loading && <p role="status">Loading safety history…</p>}{error && <p role="alert">{error} <button type="button" onClick={() => refresh(v => v + 1)}>Retry</button></p>}
        {!loading && !error && (noticeView ? notices.length === 0 ? <p>No account notices on this page.</p> : notices.map(notice => <article key={notice.id}><h2>{label(notice.action)}</h2><p>Reason: {label(notice.reason)}</p><p>{notice.action === 'WARN_ACCOUNT' ? 'A moderator has issued a warning. Review your conduct and keep interactions respectful. This notice does not suspend your account.' : 'A moderator removed a message from chat history. People may already have read or saved it.'}</p><small>{new Date(notice.createdAt).toLocaleString()}</small><p>If you believe this was a mistake, contact platform support with notice #{notice.id}.</p></article>) : rows.length === 0 ? <p>No reports on this page. You can report a person from their profile or a message from its Report control.</p> : rows.map(row => <article key={row.id}><h2>Report #{row.id} · {label(row.targetType)}</h2><p>Reason: {label(row.reason)}</p><strong>{label(row.status)}</strong><p>{row.outcome ? label(row.outcome) : 'Awaiting human review. You can still block unwanted personal contact.'}</p><small>Sent {new Date(row.createdAt).toLocaleString()}{row.resolvedAt && ` · Reviewed ${new Date(row.resolvedAt).toLocaleString()}`}</small><p>Receipts remain available if you leave a conversation or the target is removed. Private evidence and moderator notes are not included.</p>{!item && <Link to={`/reports?itemId=${row.id}`}>Open receipt</Link>}</article>))}
        {!loading && !error && (noticeView ? notices.length : item ? 0 : rows.length) === 30 && <button type="button" onClick={() => setBefore(noticeView ? notices[notices.length - 1].id : rows[rows.length - 1].id)}>Older records</button>}
    </main>;
}
