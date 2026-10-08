import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/axiosConfig';
import { extractApiErrorMessage } from '../../utils/apiError';
import { JevAdvice } from './JevAdvice';
import { adviceLabel } from './labels';

type Report = { id: number; postId: number; content: string; reason: string; status: string; createdAt: string };
export function ContentReportsPanel() {
    const [rows, setRows] = useState<Report[]>([]), [error, setError] = useState('');
    const [before, setBefore] = useState<number | null>(null), [revision, setRevision] = useState(0), [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<number | null>(null), [notice, setNotice] = useState('');
    const pending = useRef<AbortController | null>(null);
    useEffect(() => () => pending.current?.abort(), []);
    useEffect(() => {
        const controller = new AbortController();
        setLoading(true); setError(''); setRows([]);
        apiClient.get<Report[]>('/admin/content-reports', { params: before ? { before } : {}, signal: controller.signal })
            .then(({ data }) => { if (!controller.signal.aborted) setRows(data); })
            .catch(error => { if (!controller.signal.aborted) setError(extractApiErrorMessage(error, 'Could not load reports.')); })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [before, revision]);
    const resolve = async (id: number, status: 'REVIEWED' | 'DISMISSED') => {
        if (pending.current) return;
        const controller = new AbortController(); pending.current = controller; setBusy(id); setError(''); setNotice('');
        try {
            await apiClient.put(`/admin/content-reports/${id}`, { status }, { signal: controller.signal });
            if (!controller.signal.aborted) { setNotice(status === 'REVIEWED' ? 'Report marked reviewed. The post has not been changed.' : 'Report dismissed. The post has not been changed.'); setRevision(value => value + 1); }
        } catch (error) { if (!controller.signal.aborted) setError(extractApiErrorMessage(error, 'Could not update this report. Refresh before trying again.')); }
        finally { if (!controller.signal.aborted) { pending.current = null; setBusy(null); } }
    };
    return <section aria-label="Content reports" className="space-y-4">
        <h2 className="text-xl font-semibold">Content reports</h2>
        <p className="text-sm text-[var(--color-muted)]">Review reported posts. AI suggestions are advisory; they do not dismiss reports, remove posts or establish whether a claim is true. Restricted posts require manual review.</p>
        <div className="report-controls"><button type="button" disabled={loading || busy !== null} onClick={() => { setBefore(null); setRevision(value => value + 1); }}>Refresh latest reports</button></div>
        {notice && <p role="status">{notice}</p>}{error && <p role="alert">{error}</p>}
        {loading ? <p role="status">Loading reports…</p> : rows.length === 0 ? <p>No open reports on this page.</p> : rows.map(report => <article className="jev-advice" key={report.id}>
            <h3>Report #{report.id} · {adviceLabel(report.reason)}</h3><p className="whitespace-pre-wrap">{report.content}</p>
            <Link className="app-text-action" to={`/posts/${report.postId}`}>Open post</Link>
            <JevAdvice endpoint={`/admin/content-reports/${report.id}/triage`} input={{}} kind="report" disabled={busy !== null} />
            <div className="report-controls"><button type="button" disabled={busy !== null} onClick={() => void resolve(report.id,'REVIEWED')}>Mark reviewed</button><button type="button" disabled={busy !== null} onClick={() => void resolve(report.id,'DISMISSED')}>Dismiss report</button></div>
        </article>)}
        {rows.length === 30 && <div className="report-controls"><button type="button" disabled={busy !== null} onClick={() => setBefore(rows[rows.length-1].id)}>Older reports</button></div>}
    </section>;
}
