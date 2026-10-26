import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useClubEntryEligibility, useEntryCopy } from '../../applications/clubEntry';
import { RecruitmentApplication } from '../../recruitment/RecruitmentApplication';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { createClubApplication } from '../api';
import { useJobsOpportunitiesCopy } from '../jobsOpportunitiesCopy';
import type { JobDetailState, JobViewerStatus } from './useJobDetail';
import './job-application.css';

const LIVE = ['PENDING', 'OFFERED', 'ACCEPTED', 'EXPIRED'];

/**
 * Applying for one role: the viewer's application when there is one, else the form for a coaching or playing role
 * (after the club's entry rules are checked), else the way to contact the club. The job page and World's job drawer
 * both show it; each styles it in its own place.
 */
export function JobApplication({ id, status, detail }: { id: number; status: JobViewerStatus; detail: JobDetailState }) {
    const { language, copy } = useJobsOpportunitiesCopy();
    const here = useLocation();
    const { job, application, setApplication, applicationError, checking, reload } = detail;
    const [message, setMessage] = useState(''),
        [busy, setBusy] = useState(false),
        [feedback, setFeedback] = useState('');
    const supportedRole = job?.requiredRole === 'COACH' || job?.requiredRole === 'PLAYER' ? job.requiredRole : null;
    const entry = useClubEntryEligibility(job?.clubId ?? 0, supportedRole ?? 'PLAYER', 'JOIN', status === 'authenticated' && !!supportedRole && !(application && LIVE.includes(application.status)), id);
    const entryCopy = useEntryCopy();
    const contactHref = job?.clubId
        ? `/clubs/${job.clubId}?${new URLSearchParams({ tab: 'contact', roleId: String(job.id), roleTitle: job.title }).toString()}`
        : '/clubs';
    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!job?.clubId || !supportedRole || busy || !entry.allowed) return;
        setBusy(true);
        setFeedback('');
        try {
            const result = await createClubApplication(job.clubId, supportedRole, message.trim() || null, { jobId: id }, { _authSessionId: entry.sessionId });
            setApplication({ id: result.applicationId, clubId: job.clubId, status: 'PENDING' });
            setMessage('');
            setFeedback(copy('applicationSent'));
        } catch (error) {
            entry.reload();
            setFeedback(extractApiErrorMessage(error, copy('applicationSendError')));
        } finally {
            setBusy(false);
        }
    };
    return <>
        {checking ? (
            <p role="status">{copy('checkingApplication')}</p>
        ) : applicationError ? (
            <div role="alert">
                {applicationError}
                <button className="jobs-text-button" onClick={reload}>{copy('retryStatus')}</button>
            </div>
        ) : application && LIVE.includes(application.status) ? (
            <RecruitmentApplication applicationId={application.id} onChanged={reload} />
        ) : job && (
            <>
                {application && <RecruitmentApplication applicationId={application.id} />}
                {supportedRole ? (
                    status !== 'authenticated' ? (
                        <Link className="job-action" to={`/login?next=${encodeURIComponent(`/jobs/${id}`)}`}>{copy('signInToApply')}</Link>
                    ) : entry.loading ? (
                        <p role="status">{entryCopy.copy('Checking current eligibility…', 'მიმდინარე უფლებების შემოწმება…')}</p>
                    ) : entry.error ? (
                        <p role="alert">{entryCopy.copy('Eligibility could not load.', 'მოთხოვნის უფლება ვერ შემოწმდა.')} <button type="button" onClick={entry.reload}>{entryCopy.copy('Retry eligibility', 'ხელახლა შემოწმება')}</button></p>
                    ) : entry.data && !entry.allowed ? (
                        <p role="status">{entryCopy.reason(entry.data)} <Link to={entry.data.reason === 'IDENTITY_REQUIRED' ? `/account/football?next=${encodeURIComponent(here.pathname + here.search)}` : '/account?tab=profile'}>{entry.data.reason === 'IDENTITY_REQUIRED' ? entryCopy.copy('Add football identity', 'ფეხბურთის როლის დამატება') : entryCopy.copy('Review account and requests', 'ანგარიშისა და მოთხოვნების ნახვა')}</Link></p>
                    ) : (
                        <form onSubmit={submit} className="jobs-application-form">
                            <h2>{copy('applyTitle')}</h2>
                            <p>{copy('applyTruth', { role: language === 'ka' ? (supportedRole === 'COACH' ? 'მწვრთნელის' : 'მოთამაშის') : supportedRole.toLowerCase() })}</p>
                            <label className="store-field">
                                {copy('messageToClub')}
                                <textarea rows={5} maxLength={500} value={message} disabled={busy} onChange={(e) => setMessage(e.target.value)} placeholder={copy('messagePlaceholder')} />
                            </label>
                            <button className="job-action" disabled={busy || !entry.allowed}>{copy(busy ? 'sending' : 'sendApplication')}</button>
                        </form>
                    )
                ) : (
                    <>
                        <h2>{copy('contactTitle')}</h2>
                        <p>{copy('contactTruth')}</p>
                        <Link className="job-action" to={contactHref}>{copy('contactClub', { club: job.clubName || copy('club'), role: job.title })}</Link>
                    </>
                )}
            </>
        )}
        {job && supportedRole && <details className="jobs-lifecycle" aria-label="Application lifecycle">
            <summary>{copy('lifecycle')}</summary>
            <ol><li>Send an application using your relevant football identity.</li><li>The club reviews it and may send an offer.</li><li>Review the responsibility and accept or decline.</li><li>Acceptance starts the listed coaching appointment or a playing trial. Guardian consent and active-player registration remain separate.</li></ol>
        </details>}
        {feedback && <p className="jobs-application-feedback" role="status">{feedback}</p>}
    </>;
}
