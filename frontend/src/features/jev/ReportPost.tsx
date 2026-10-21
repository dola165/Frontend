import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../api/axiosConfig';
import { extractApiErrorMessage } from '../../utils/apiError';
import { adviceLabel } from './labels';
import './jev.css';
import { getAuthSessionId, subscribeAuthSession } from '../../utils/authStorage';

export function ReportPost({ postId }: { postId: number }) {
    const session = useSyncExternalStore(subscribeAuthSession, getAuthSessionId);
    return <ReportForm key={`${session}:${postId}`} postId={postId} />;
}
function ReportForm({ postId }: { postId: number }) {
    const { i18n } = useTranslation(); const ka = i18n?.language?.startsWith('ka');
    const [open, setOpen] = useState(false), [reason, setReason] = useState('OTHER');
    const [sent, setSent] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false);
    const pending = useRef<AbortController | null>(null);
    useEffect(() => () => pending.current?.abort(), []);
    const submit = async () => {
        if (pending.current) return;
        const controller = new AbortController(); pending.current = controller; setBusy(true); setError('');
        try {
            await apiClient.post(`/posts/${postId}/reports`, { reason }, { signal: controller.signal });
            if (!controller.signal.aborted) { setSent(true); setOpen(false); }
        } catch (error) { if (!controller.signal.aborted) setError(extractApiErrorMessage(error, ka ? 'ანგარიშის გაგზავნა ვერ მოხერხდა. შედით ანგარიშში და სცადეთ ხელახლა.' : 'Could not submit the report. Make sure you are signed in and try again.')); }
        finally { if (!controller.signal.aborted) { pending.current = null; setBusy(false); } }
    };
    return <div className="px-5 pb-3 text-sm">
        {sent ? <p role="status">{ka ? 'ანგარიში გაიგზავნა ადმინისტრატორთან.' : 'Report submitted for administrator review.'}</p>
            : <button type="button" className="min-h-11 text-[var(--feed-text-secondary)] app-text-action" aria-expanded={open} onClick={() => setOpen(!open)} disabled={busy}>{ka ? 'პოსტის გასაჩივრება' : 'Report post'}</button>}
        {open && <div className="jev-advice"><p>{ka ? 'აირჩიეთ მიზეზი. ანგარიშს ადმინისტრატორი განიხილავს. საჯარო ტექსტის კატეგორიზაციაში შესაძლოა TypeSafe დაეხმაროს.' : 'Choose a reason. An administrator reviews the report and may use TypeSafe to categorize public post text.'}</p>
            <div className="report-controls"><label>{ka ? 'მიზეზი' : 'Reason'}<select value={reason} disabled={busy} onChange={event => setReason(event.target.value)}>{['SPAM','HARASSMENT','SAFETY','MISLEADING','OTHER'].map(value => <option key={value} value={value}>{adviceLabel(value, ka)}</option>)}</select></label>
                <button type="button" disabled={busy} onClick={() => void submit()}>{busy ? (ka ? 'იგზავნება…' : 'Submitting…') : (ka ? 'გაგზავნა' : 'Submit report')}</button>
                <button type="button" disabled={busy} onClick={() => setOpen(false)}>{ka ? 'გაუქმება' : 'Cancel'}</button></div>
            {error && <p role="alert">{error}</p>}</div>}
    </div>;
}
