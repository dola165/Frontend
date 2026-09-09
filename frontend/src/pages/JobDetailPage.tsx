import { OpportunityNavigation } from '../components/discovery/OpportunityNavigation';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Building2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
    cancelClubApplication,
    createClubApplication,
    fetchMyJobApplication,
    fetchPublicJob,
    type ClubJob,
    type MyJobApplication,
} from '../features/clubs/api';
import {
    labelForCategory,
    labelForEngagement,
    locationLabel,
    relativeDate,
} from '../features/clubs/jobLabels';
import { extractApiErrorMessage } from '../utils/apiError';
import '../features/store/store.css';

export const JobDetailPage = () => {
    const { id } = useParams();
    const { user } = useAuth();
    return <JobDetail key={`${id}:${user?.id ?? 'guest'}`} id={Number(id)} />;
};
function JobDetail({ id }: { id: number }) {
    const { status, user } = useAuth();
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
                if (active) setError('This opportunity has closed, is unavailable, or could not be loaded.');
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
                                'Your application status could not load. Please retry.',
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
    }, [id, status, user?.id, reload]);
    const supportedRole =
        job?.requiredRole === 'COACH' || job?.requiredRole === 'PLAYER' ? job.requiredRole : null;
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
            setFeedback('Application sent to the club. It is awaiting review.');
        } catch (error) {
            setFeedback(
                extractApiErrorMessage(
                    error,
                    'Your application could not be sent. Your message is still here.',
                ),
            );
        } finally {
            setBusy(false);
        }
    };
    return (
        <main className="store-page jobs-page jobs-detail">
            <OpportunityNavigation section="jobs" clubId={job?.clubId} detail/>
            {loading ? (
                <p role="status">Loading opportunity...</p>
            ) : error ? (
                <div role="alert" className="store-empty">
                    {error}
                    <button onClick={() => setReload((n) => n + 1)}>Retry</button>
                </div>
            ) : (
                job && (
                    <article className="jobs-detail-content">
                        <Link className="store-seller" to={`/clubs/${job.clubId}?tab=business&opportunity=jobs`}>
                            <Building2 size={25} />
                            <span>
                                <small>Opportunity from</small>
                                <strong>{job.clubName}</strong>
                            </span>
                            <ArrowRight size={17} />
                        </Link>
                        <header>
                            <p className="store-eyebrow">{labelForCategory(job.category)}</p>
                            <h1>{job.title}</h1>
                            <p className="store-subtitle">
                                {locationLabel(job)} · {labelForEngagement(job.engagementType)} ·{' '}
                                {relativeDate(job.createdAt)}
                            </p>
                        </header>
                        <div className="store-description">
                            {job.description || 'The club has not added a full description yet.'}
                        </div>
                        {(job.ageGroup || job.level) && (
                            <p className="store-subtitle">
                                {job.ageGroup && `Team age group: ${job.ageGroup}. `}
                                {job.level && `Experience: ${job.level.toLowerCase()}.`}
                            </p>
                        )}
                    </article>
                )
            )}
            <section className="job-application mt-6" aria-label="Your application">
                {checking ? (
                    <p role="status">Checking your application...</p>
                ) : applicationError ? (
                    <div role="alert">
                        {applicationError}
                        <button className="underline ml-2" onClick={() => setReload((n) => n + 1)}>
                            Retry status
                        </button>
                    </div>
                ) : application?.status === 'PENDING' ? (
                    <>
                        <h2 className="font-bold">Application pending</h2>
                        <p>
                            The club has received your application. You can withdraw it while it is pending.
                        </p>
                        {!withdraw ? (
                            <button className="store-cart-link" onClick={() => setWithdraw(true)}>
                                Withdraw application
                            </button>
                        ) : (
                            <div>
                                <p>Withdraw this application?</p>
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
                                            setFeedback('Application withdrawn.');
                                        } catch (error) {
                                            setFeedback(
                                                extractApiErrorMessage(
                                                    error,
                                                    'The application could not be withdrawn.',
                                                ),
                                            );
                                        } finally {
                                            setBusy(false);
                                        }
                                    }}
                                >
                                    Confirm withdrawal
                                </button>
                                <button
                                    disabled={busy}
                                    className="ml-4 underline"
                                    onClick={() => setWithdraw(false)}
                                >
                                    Keep application
                                </button>
                            </div>
                        )}
                    </>
                ) : application?.status === 'ACCEPTED' ? (
                    <>
                        <h2 className="font-bold">Application accepted</h2>
                        <p>The club has accepted your application. Contact the club about your next steps.</p>
                    </>
                ) : (
                    job && (
                        <>
                            {application && <p>Previous application: {application.status.toLowerCase()}.</p>}
                            {supportedRole ? (
                                status !== 'authenticated' ? (
                                    <Link
                                        className="job-action"
                                        to={`/login?next=${encodeURIComponent(`/jobs/${id}`)}`}
                                    >
                                        Sign in to apply
                                    </Link>
                                ) : (
                                    <form onSubmit={submit} className="grid gap-4">
                                        <h2 className="font-bold">Apply for this opportunity</h2>
                                        <p className="store-hint">
                                            This opening uses the club's {supportedRole.toLowerCase()}{' '}
                                            application process. Submitting an application does not confirm a
                                            position.
                                        </p>
                                        <label className="store-field">
                                            Message to the club
                                            <textarea
                                                rows={5}
                                                maxLength={500}
                                                value={message}
                                                disabled={busy}
                                                onChange={(e) => setMessage(e.target.value)}
                                                placeholder="Introduce yourself and explain your interest."
                                            />
                                        </label>
                                        <button className="job-action" disabled={busy}>
                                            {busy ? 'Sending...' : 'Send application'}
                                        </button>
                                    </form>
                                )
                            ) : (
                                <>
                                    <h2 className="font-bold">Contact the club about this opportunity</h2>
                                    <p className="store-hint">
                                        In-app applications currently support player and coach openings. For
                                        this role, use the club's contact details to ask how to apply.
                                    </p>
                                    <Link className="job-action" to={`/clubs/${job.clubId}?tab=contact`}>
                                        Open club contact details
                                    </Link>
                                </>
                            )}
                        </>
                    )
                )}
                {feedback && <p role="status">{feedback}</p>}
            </section>
        </main>
    );
}
