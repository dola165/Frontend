import { Link } from 'react-router-dom';
import { ArrowUpRight, ExternalLink, Mail, MapPin, MessageCircle, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { Badge, Button, ButtonLink, EmptyNote, Skeleton } from '../../design/primitives';
import { JobApplication } from '../clubs/jobDetail/JobApplication';
import { useJobDetail } from '../clubs/jobDetail/useJobDetail';
import { Crest } from '../world/Crest';
import { applyMethodOf, categoryLabel, directionOf, distanceLabel, hoursLabel, placeOf, posterOf, postedLabel, termsLabel, type Job } from './api';
import { clubJobsPath, jobsPath } from './query';
import '../clubs/jobs-opportunities.css';

const share = async (job: Job) => {
    const url = `${window.location.origin}/jobs/${job.id}`;
    try {
        if (navigator.share) { await navigator.share({ title: job.title, url }); return; }
        await navigator.clipboard.writeText(url);
        toast.success('Link copied', { description: url });
    } catch { toast.error('Could not share this link', { description: url }); }
};

/** How to answer the listing: apply in the app, message the person, email, or the poster's own link. */
function Answer({ job, status, detail }: { job: Job; status: 'bootstrapping' | 'authenticated' | 'anonymous'; detail: ReturnType<typeof useJobDetail> }) {
    const method = applyMethodOf(job), poster = posterOf(job), offering = directionOf(job) === 'OFFERING';
    if (method === 'IN_APP') return <div className="gk-job-detail__apply"><JobApplication id={job.id} status={status} detail={detail} /></div>;
    if (method === 'MESSAGE') return <ButtonLink variant="primary" to={`/messages?chatWith=${poster.id}`}><MessageCircle aria-hidden="true" />{offering ? `Message ${poster.name.split(' ')[0]}` : `Message ${poster.name.split(' ')[0]} to apply`}</ButtonLink>;
    if (method === 'EMAIL' && job.applyTarget) return <a className="gk-btn gk-btn--primary" href={`mailto:${job.applyTarget}?subject=${encodeURIComponent(`Application: ${job.title}`)}`}><Mail aria-hidden="true" />Apply by email</a>;
    if (method === 'LINK' && job.applyTarget) return <a className="gk-btn gk-btn--primary" href={job.applyTarget} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden="true" />Apply on their site</a>;
    return <ButtonLink variant="primary" to={poster.kind === 'CLUB' ? `/clubs/${poster.id}?tab=contact` : `/messages?chatWith=${poster.id}`}>Ask how to apply</ButtonLink>;
}

/** A listing in full: who posted it, what it is, the pay and the hours, how to answer it, and the text. Used beside the list and on the job page. */
export function JobDetail({ id, pane }: { id: number; pane?: boolean }) {
    const { status, user } = useAuth();
    const detail = useJobDetail(id, status, user?.id);
    const job = detail.job as Job | null;
    if (detail.loading) return <div className="gk-job-detail" aria-busy="true"><Skeleton height={28} width={300} /><Skeleton height={18} width={200} /><Skeleton height={120} /></div>;
    if (detail.error || !job) return <div className="gk-job-detail"><EmptyNote title="This listing is no longer open" action={<Button size="sm" onClick={detail.retryJob}>Try again</Button>} /></div>;
    const poster = posterOf(job), offering = directionOf(job) === 'OFFERING';
    const posterTo = poster.kind === 'CLUB' ? `/clubs/${poster.id}` : `/profile/${poster.id}`;
    const where = [placeOf(job), job.distanceKm != null ? distanceLabel(job.distanceKm) : null].filter(Boolean).join(' · ');
    return (
        <article className="gk-job-detail" data-pane={pane || undefined}>
            <Link className="gk-job-detail__poster" to={posterTo}>
                <Crest src={poster.avatarUrl} name={poster.name} size={44} round={poster.kind === 'PERSON'} />
                <span className="gk-job-detail__poster-text"><small>{offering ? 'Available' : poster.kind === 'CLUB' ? 'Hiring' : 'Looking for help'}</small><strong>{poster.name}</strong></span>
                <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
            {pane ? <h2>{job.title}</h2> : <h1>{job.title}</h1>}
            <p className="gk-job-detail__meta"><MapPin size={14} aria-hidden="true" />{[where, postedLabel(job.createdAt), job.applicationCount ? `${job.applicationCount} ${offering ? 'enquiries' : 'applicants'}` : null].filter(Boolean).join(' · ')}</p>
            <div className="gk-job-detail__chips">
                {job.pay && <Badge tone="accent">{job.pay}</Badge>}
                {termsLabel(job.engagementType) && <Badge tone={job.engagementType === 'VOLUNTEER' ? 'info' : 'neutral'}>{termsLabel(job.engagementType)}</Badge>}
                {hoursLabel(job.hours) && <Badge>{hoursLabel(job.hours)}</Badge>}
                <Badge>{categoryLabel(job.category)}</Badge>
                {job.ageGroup && <Badge>{job.ageGroup}</Badge>}
                {job.licence && <Badge tone="violet">{job.licence}</Badge>}
            </div>
            <div className="gk-job-detail__actions">
                <Answer job={job} status={status} detail={detail} />
                <Button onClick={() => void share(job)}><Share2 aria-hidden="true" />Share</Button>
            </div>
            <section><h3>{offering ? 'About' : 'About the role'}</h3><p className="gk-job-detail__text">{job.description || 'No description yet.'}</p></section>
            {poster.kind === 'CLUB' && <p className="gk-faint"><Link className="gk-section__action" to={clubJobsPath(poster.id)}>More from {poster.name}</Link></p>}
            {poster.kind === 'PERSON' && <p className="gk-faint"><Link className="gk-section__action" to={jobsPath({ direction: offering ? 'OFFERING' : 'HIRING', category: job.category ?? '' })}>More like this</Link></p>}
        </article>
    );
}
