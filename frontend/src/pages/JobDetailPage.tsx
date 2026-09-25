import { OpportunityNavigation } from '../components/discovery/OpportunityNavigation';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, BriefcaseBusiness, Building2, ClipboardCheck, MapPin, Route } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
    cancelClubApplication,
    createClubApplication,
    fetchMyJobApplication,
    fetchPublicJob,
    type ClubJob,
    type MyJobApplication,
} from '../features/clubs/api';
import { useJobsOpportunitiesCopy } from '../features/clubs/jobsOpportunitiesCopy';
import { extractApiErrorMessage } from '../utils/apiError';
import '../features/store/store.css';
import '../features/clubs/jobs-opportunities.css';

interface JobDetailPageProps {
    previewAuth?: { status: 'authenticated' | 'anonymous'; user: { id: number } | null };
}

export const JobDetailPage = ({ previewAuth }: JobDetailPageProps = {}) => {
    const { id } = useParams();
    if (import.meta.env.DEV && previewAuth)
        return <JobDetail key={`${id}:${previewAuth.user?.id ?? 'guest'}`} id={Number(id)} {...previewAuth} />;
    return <AuthenticatedJobDetail id={Number(id)} />;
};

function AuthenticatedJobDetail({ id }: { id: number }) {
    const { status, user } = useAuth();
    return <JobDetail key={`${id}:${user?.id ?? 'guest'}`} id={id} status={status} user={user} />;
}

function JobDetail({ id, status, user }: {
    id: number;
    status: 'bootstrapping' | 'authenticated' | 'anonymous';
    user: { id: number } | null;
}) {
    const {
        language,
        copy,
        category: categoryLabel,
        engagement: engagementLabel,
        applicationMethod,
        eligibility,
        location: jobLocation,
        relativeDate: jobRelativeDate,
    } = useJobsOpportunitiesCopy();
    const [job, setJob] = useState<ClubJob | null>(null),
        [error, setError] = useState(''),
        [loading, setLoading] = useState(true),
        [reload, setReload] = useState(0);
    const [application, setApplication] = useState<MyJobApplication | null>(null),
        [applicationError, setApplicationError] = useState(''),
        [checking, setChecking] = useState(true);
    const [message, setMessage] = useState(''),
        [busy, setBusy] = useState(false),
        [feedback, setFeedback] = useState(''),
        [withdraw, setWithdraw] = useState(false);
    useEffect(() => {
        let active = true;
        const controller = new AbortController();
        // Detail/status requests are replaced when the viewer or requested opportunity changes.
        setLoading(true);
        setError('');
        setJob(null);
        setChecking(true);
        setApplication(null);
        setApplicationError('');
        void fetchPublicJob(id, controller.signal)
            .then((data) => {
                if (active) setJob(data);
            })
            .catch(() => {
                if (active) setError('load');
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        if (status === 'authenticated')
            void fetchMyJobApplication(id, controller.signal)
                .then((data) => {
                    if (active) setApplication(data);
                })
                .catch((error) => {
                    if (active)
                        setApplicationError(
                            extractApiErrorMessage(
                                error,
                                copy('statusLoadError'),
                            ),
                        );
                })
                .finally(() => {
                    if (active) setChecking(false);
                });
        else if (status !== 'bootstrapping') setChecking(false);
        return () => {
            active = false;
            controller.abort();
        };
    }, [copy, id, status, user?.id, reload]);
    const supportedRole =
        job?.requiredRole === 'COACH' || job?.requiredRole === 'PLAYER' ? job.requiredRole : null;
    const contactHref = job?.clubId
        ? `/clubs/${job.clubId}?${new URLSearchParams({
            tab: 'contact',
            roleId: String(job.id),
            roleTitle: job.title,
        }).toString()}`
        : '/clubs';
    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!job?.clubId || !supportedRole || busy) return;
        setBusy(true);
        setFeedback('');
        try {
            const result = await createClubApplication(job.clubId, supportedRole, message.trim() || null, {
                jobId: id,
            });
            setApplication({ id: result.applicationId, clubId: job.clubId, status: 'PENDING' });
            setMessage('');
            setFeedback(copy('applicationSent'));
        } catch (error) {
            setFeedback(
                extractApiErrorMessage(
                    error,
                    copy('applicationSendError'),
                ),
            );
        } finally {
            setBusy(false);
        }
    };
    return (
        <main className="store-page jobs-page jobs-detail">
            <OpportunityNavigation section="jobs" clubId={job?.clubId} detail/>
            <div className="jobs-detail-layout">
                <section className="jobs-detail-main">
                    {loading ? (
                        <div className="jobs-detail-loading" role="status"><span aria-hidden="true" /><span aria-hidden="true" /><span aria-hidden="true" /><p>{copy('loadingRole')}</p></div>
                    ) : error ? (
                        <div role="alert" className="store-empty jobs-empty">
                            <BriefcaseBusiness size={30} />
                            <h2>{copy('roleUnavailable')}</h2>
                            <button onClick={() => setReload((n) => n + 1)}>{copy('tryAgain')}</button>
                        </div>
                    ) : job && (
                        <article className="jobs-detail-content">
                            <Link className="jobs-detail-club" to={`/clubs/${job.clubId}?tab=business&opportunity=jobs`}>
                                <span className="jobs-detail-club-icon"><Building2 size={22} /></span>
                                <span><small>{copy('roleFrom')}</small><strong>{job.clubName}</strong></span>
                                <ArrowRight size={17} />
                            </Link>
                            <header className="jobs-detail-hero">
                                <div className="job-badges"><span>{categoryLabel(job.category)}</span><span>{engagementLabel(job.engagementType)}</span></div>
                                <h1>{job.title}</h1>
                                <p><MapPin size={15} aria-hidden="true" />{jobLocation(job)} · {jobRelativeDate(job.createdAt)}</p>
                            </header>
                            <dl className="jobs-detail-facts" aria-label="Role facts">
                                <div><BriefcaseBusiness aria-hidden="true" /><div><dt>{copy('commitment')}</dt><dd>{copy('ongoingRole')}</dd></div></div>
                                <div><ClipboardCheck aria-hidden="true" /><div><dt>{copy('engagementFact')}</dt><dd>{engagementLabel(job.engagementType)}</dd></div></div>
                                {eligibility(job) && <div><MapPin aria-hidden="true" /><div><dt>{copy('eligibility')}</dt><dd>{eligibility(job)}</dd></div></div>}
                                <div><Route aria-hidden="true" /><div><dt>{copy('applicationMethod')}</dt><dd>{applicationMethod(job)}</dd></div></div>
                            </dl>
                            <section className="jobs-detail-description">
                                <h2>{copy('aboutRole')}</h2>
                                <p>{job.description || copy('noDescription')}</p>
                            </section>
                        </article>
                    )}
                </section>
                <aside className="job-application" aria-label={copy('yourApplication')}>
                    <p className="store-eyebrow">{copy('yourApplication')}</p>
                    {checking ? (
                        <p role="status">{copy('checkingApplication')}</p>
                    ) : applicationError ? (
                        <div role="alert">
                            {applicationError}
                            <button className="jobs-text-button" onClick={() => setReload((n) => n + 1)}>{copy('retryStatus')}</button>
                        </div>
                    ) : application?.status === 'PENDING' ? (
                        <>
                            <h2>{copy('applicationPending')}</h2>
                            <p>{copy('applicationPendingBody')}</p>
                            {!withdraw ? (
                                <button className="store-cart-link" onClick={() => setWithdraw(true)}>{copy('withdrawApplication')}</button>
                            ) : (
                                <div className="jobs-withdraw-confirmation">
                                    <p>{copy('confirmWithdrawQuestion')}</p>
                                    <div>
                                        <button
                                            className="job-action"
                                            disabled={busy}
                                            onClick={async () => {
                                                setBusy(true);
                                                setFeedback('');
                                                try {
                                                    await cancelClubApplication(application.clubId, application.id);
                                                    setApplication({ ...application, status: 'CANCELLED' });
                                                    setWithdraw(false);
                                                    setFeedback(copy('applicationWithdrawn'));
                                                } catch (error) {
                                                    setFeedback(extractApiErrorMessage(error, copy('withdrawalError')));
                                                } finally {
                                                    setBusy(false);
                                                }
                                            }}
                                        >{copy('confirmWithdrawal')}</button>
                                        <button disabled={busy} className="jobs-text-button" onClick={() => setWithdraw(false)}>{copy('keepApplication')}</button>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : application?.status === 'ACCEPTED' ? (
                        <>
                            <h2>{copy('applicationAccepted')}</h2>
                            <p>{copy('applicationAcceptedBody')}</p>
                            <p>{copy('acceptedNext')}</p>
                        </>
                    ) : job && (
                        <>
                            {application && <p>{copy('previousApplication', { status: application.status.toLowerCase() })}</p>}
                            {supportedRole ? (
                                status !== 'authenticated' ? (
                                    <Link className="job-action" to={`/login?next=${encodeURIComponent(`/jobs/${id}`)}`}>{copy('signInToApply')}</Link>
                                ) : (
                                    <form onSubmit={submit} className="jobs-application-form">
                                        <h2>{copy('applyTitle')}</h2>
                                        <p>{copy('applyTruth', { role: language === 'ka' ? (supportedRole === 'COACH' ? 'მწვრთნელის' : 'მოთამაშის') : supportedRole.toLowerCase() })}</p>
                                        <label className="store-field">
                                            {copy('messageToClub')}
                                            <textarea rows={5} maxLength={500} value={message} disabled={busy} onChange={(e) => setMessage(e.target.value)} placeholder={copy('messagePlaceholder')} />
                                        </label>
                                        <button className="job-action" disabled={busy}>{copy(busy ? 'sending' : 'sendApplication')}</button>
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
                        <ol>
                            <li>{copy('lifecycleOne')}</li>
                            <li>{copy('lifecycleTwo')}</li>
                            <li>{copy('lifecycleThree')}</li>
                            <li>{copy('lifecycleFour')}</li>
                        </ol>
                    </details>}
                    {feedback && <p className="jobs-application-feedback" role="status">{feedback}</p>}
                </aside>
            </div>
        </main>
    );
}
