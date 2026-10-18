import { JobDetail } from '../../jobs/JobDetail';
import type { Job } from '../../jobs/api';
import { useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { Badge, Button, EmptyNote } from '../../../design/primitives';
import { useAuth } from '../../../context/AuthContext';
import type { ClubJob } from '../../clubs/api';
import { JobApplication } from '../../clubs/jobDetail/JobApplication';
import { useJobDetail, type JobViewerStatus } from '../../clubs/jobDetail/useJobDetail';
import { labelForCategory } from '../../clubs/jobLabels';
import { usePersonProfile } from '../../profiles/person/usePersonProfile';
import { getAuthSessionId, subscribeAuthSession } from '../../../utils/authStorage';
import { plural, useWorldCopy } from '../copy';
import { Crest } from '../Crest';
import { codeLabel, ENGAGEMENT, postedLabel } from '../format';
import { DrawerFrame, DrawerLoading } from './DrawerFrame';
import { peekClick, peekOf, useRelatedOpen } from './usePeek';
import './peek.css';

/** The person who posted the role, with a way to message them; shown once their public profile is known. */
function PostedBy({ job }: { job: ClubJob }) {
    const t = useWorldCopy();
    const relate = useRelatedOpen();
    const person = usePersonProfile(job.createdBy!);
    const { profile } = person;
    if (person.status !== 'ready' || !profile || person.hidden || person.possibleMinor || person.own) return null;
    const name = profile.fullName || profile.username || t('Profile');
    const title = profile.footballProfile?.appointments?.find(item => item.clubId === job.clubId)?.title;
    return (
        <section className="gk-peek-section">
            <h4>{t('Posted by')}</h4>
            <div className="gk-peek-club">
                <Crest src={profile.avatarUrl} name={name} size={40} round />
                <span className="gk-world-grow">
                    <Link to={`/profile/${profile.id}`} onClick={peekClick(peekOf('person', profile.id), relate)}>{name}</Link>
                    {title && <small>{[title, job.clubName].filter(Boolean).join(' · ')}</small>}
                </span>
                <Link className="gk-people-act" to={`/messages?chatWith=${profile.id}`} aria-label={t('Message {name}', { name })}><MessageCircle aria-hidden="true" />{t('Message')}</Link>
            </div>
        </section>
    );
}

/**
 * An open role over World, from the right: the club behind it (opens on the left), what it is and its terms, applying
 * (the same as on the job page), what the role is, and who posted it.
 */
export default function JobPeek({ id }: { id: string }) {
    const { status, user } = useAuth();
    const session = useSyncExternalStore(subscribeAuthSession, getAuthSessionId);
    // Unsent answers, pending callbacks and saved receipts belong to this exact login and listing.
    return <JobPeekSession key={JSON.stringify([id, user?.id ?? null, session])} id={id} status={status} userId={user?.id} />;
}

function JobPeekSession({ id, status, userId }: { id: string; status: JobViewerStatus; userId?: number }) {
    const t = useWorldCopy();
    const relate = useRelatedOpen();
    const jobId = Number(id);
    const detail = useJobDetail(jobId, status, userId);
    const { job } = detail;
    if (detail.loading) return <DrawerFrame title={t('Loading…')}><DrawerLoading /></DrawerFrame>;
    if (detail.error || !job) return (
        <DrawerFrame title={t('Job')}>
            <EmptyNote title={t('This role is no longer open.')} action={<Button size="sm" onClick={detail.retryJob}>{t('Try again')}</Button>} />
        </DrawerFrame>
    );
    const listing = job as Job;
    if (listing.poster?.kind === 'PERSON' || listing.applyMethod && listing.applyMethod !== 'IN_APP' || listing.canManage) return <DrawerFrame title={job.title} page={{ to: `/jobs/${job.id}`, label: t('Job page') }}><JobDetail id={job.id} pane /></DrawerFrame>;
    const terms = ENGAGEMENT[job.engagementType ?? 'UNSPECIFIED'] ?? ENGAGEMENT.UNSPECIFIED;
    const place = [job.clubCityName, job.clubCountryName].filter(Boolean).join(', ');
    return (
        <DrawerFrame title={job.title} page={{ to: `/jobs/${job.id}`, label: t('Job page') }}>
            <header className="gk-peek-job">
                {job.clubId != null && (
                    <Link className="gk-peek-job__club" to={`/clubs/${job.clubId}`} onClick={peekClick(peekOf('club', job.clubId), relate)}>
                        <Crest src={job.clubLogoUrl} name={job.clubName ?? job.title} size={32} />
                        <span>{job.clubName}</span>
                    </Link>
                )}
                <h3>{job.title}</h3>
                <p className="gk-peek-job__meta">{[place, postedLabel(job.createdAt), job.applicationCount ? plural(job.applicationCount, 'applicant') : null].filter(Boolean).join(' · ')}</p>
                <div className="gk-peek-job__chips">
                    <Badge tone={terms.tone}>{t(terms.label)}</Badge>
                    {job.category && <span className="gk-peek-chip">{t(labelForCategory(job.category))}</span>}
                    {job.ageGroup && <span className="gk-peek-chip">{codeLabel(job.ageGroup)}</span>}
                    {job.level && <span className="gk-peek-chip">{codeLabel(job.level)}</span>}
                </div>
            </header>
            <section className="gk-job-apply" aria-label={t('Apply')}>
                <JobApplication id={job.id} status={status} detail={detail} />
            </section>
            <section className="gk-peek-section">
                <h4>{t('About the role')}</h4>
                <p className="gk-peek-text">{job.description || t('The club has not described this role yet.')}</p>
            </section>
            {job.createdBy != null && <PostedBy job={job} />}
        </DrawerFrame>
    );
}
