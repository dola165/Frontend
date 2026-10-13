import { OpportunityNavigation } from '../components/discovery/OpportunityNavigation';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, BriefcaseBusiness, Building2, ClipboardCheck, MapPin, Route } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { JobApplication } from '../features/clubs/jobDetail/JobApplication';
import { useJobDetail, type JobViewerStatus } from '../features/clubs/jobDetail/useJobDetail';
import { useJobsOpportunitiesCopy } from '../features/clubs/jobsOpportunitiesCopy';
import '../components/discovery/opportunity-pages.css';
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
    const { status, user, sessionId } = useAuth();
    return <JobDetail key={`${id}:${sessionId}:${user?.id ?? 'guest'}`} id={id} status={status} user={user} />;
}

function JobDetail({ id, status, user }: { id: number; status: JobViewerStatus; user: { id: number } | null }) {
    const { copy, category: categoryLabel, engagement: engagementLabel, applicationMethod, eligibility, location: jobLocation, relativeDate: jobRelativeDate } = useJobsOpportunitiesCopy();
    const detail = useJobDetail(id, status, user?.id);
    const { job, error, loading } = detail;
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
                            <button onClick={detail.retryJob}>{copy('tryAgain')}</button>
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
                                <div><dt><BriefcaseBusiness aria-hidden="true" />{copy('commitment')}</dt><dd>{copy('ongoingRole')}</dd></div>
                                <div><dt><ClipboardCheck aria-hidden="true" />{copy('engagementFact')}</dt><dd>{engagementLabel(job.engagementType)}</dd></div>
                                {eligibility(job) && <div><dt><MapPin aria-hidden="true" />{copy('eligibility')}</dt><dd>{eligibility(job)}</dd></div>}
                                <div><dt><Route aria-hidden="true" />{copy('applicationMethod')}</dt><dd>{applicationMethod(job)}</dd></div>
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
                    <JobApplication id={id} status={status} detail={detail} />
                </aside>
            </div>
        </main>
    );
}
