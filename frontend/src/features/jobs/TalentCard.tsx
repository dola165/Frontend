import type { ComponentProps, ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Badge, Button, EmptyNote, Section } from '../../design/primitives';
import { opportunityReturnState } from '../../components/discovery/opportunityReturnContext';
import { Row } from '../store/front/Row';
import { Crest } from '../world/Crest';
import { categoryLabel, distanceLabel, hoursLabel, placeOf, posterOf, postedLabel, type Job } from './api';
import { JobSkeletons } from './JobCard';

/** Someone available, the way Upwork shows talent: the face large, the name, what they offer, the rate, where, when. */
export function TalentCard({ job }: { job: Job }) {
    const location = useLocation();
    const poster = posterOf(job);
    return (
        <Link className="gk-talent" to={`/jobs/${job.id}`} state={opportunityReturnState('jobs', location)}>
            <span className="gk-talent__head">
                <Crest src={poster.avatarUrl} name={poster.name} size={56} round={poster.kind === 'PERSON'} />
                <span className="gk-talent__who"><strong>{poster.name}</strong><small>{[placeOf(job), job.distanceKm != null ? distanceLabel(job.distanceKm) : null].filter(Boolean).join(' · ')}</small></span>
                <Badge tone="accent">Available</Badge>
            </span>
            <span className="gk-talent__title">{job.title}</span>
            <span className="gk-talent__chips"><Badge>{categoryLabel(job.category)}</Badge>{hoursLabel(job.hours) && <Badge>{hoursLabel(job.hours)}</Badge>}{job.licence && <Badge tone="violet">{job.licence}</Badge>}</span>
            <span className="gk-talent__foot"><strong className="gk-talent__rate gk-num">{job.pay ?? 'Rate on request'}</strong><small>{postedLabel(job.createdAt)}</small></span>
        </Link>
    );
}

/** A front-page row of people available with "View all" opening the same search. */
export function TalentRowSection({ title, hint, to, jobs, loading, error, retry, empty, action }: {
    title: string; hint?: ReactNode; to?: string; jobs: Job[]; loading: boolean; error: string; retry: () => void; empty: string; action?: ComponentProps<typeof Section>['action'];
}) {
    return (
        <Section title={title} hint={hint} action={action ?? (to && jobs.length ? { label: 'View all', to } : undefined)} >
            {error ? <EmptyNote title="These people could not load" action={<Button size="sm" onClick={retry}>Retry</Button>}>{error}</EmptyNote>
                : loading && !jobs.length ? <ul className="gk-store-row gk-store-row--wide" aria-busy="true" aria-label="Loading"><JobSkeletons /></ul>
                : !jobs.length ? <EmptyNote title={empty} />
                : <Row label={title} wide>{jobs.map(job => <li key={job.id}><TalentCard job={job} /></li>)}</Row>}
        </Section>
    );
}
