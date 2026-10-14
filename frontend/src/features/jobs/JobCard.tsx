import type { ComponentProps, ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Badge, Button, EmptyNote, Section } from '../../design/primitives';
import { opportunityReturnState } from '../../components/discovery/opportunityReturnContext';
import { Row } from '../store/front/Row';
import { Crest } from '../world/Crest';
import { categoryLabel, directionOf, distanceLabel, hoursLabel, placeOf, posterOf, postedLabel, termsLabel, type Job } from './api';

/** Who posted: a club's crest or a person's face, with the name. */
export function Poster({ job, size = 16 }: { job: Job; size?: number }) {
    const poster = posterOf(job);
    return <Crest src={poster.avatarUrl} name={poster.name} size={size} round={poster.kind === 'PERSON'} />;
}
/** The one bright fact of a listing: the pay, or the terms when there is no pay. */
export function PayBadge({ job }: { job: Job }) {
    if (job.pay) return <Badge tone="accent">{job.pay}</Badge>;
    const terms = termsLabel(job.engagementType);
    return terms ? <Badge tone={job.engagementType === 'VOLUNTEER' ? 'info' : 'neutral'}>{terms}</Badge> : null;
}
const whereLine = (job: Job) => [placeOf(job), job.distanceKm != null ? distanceLabel(job.distanceKm) : null].filter(Boolean).join(' · ');

/** A listing as a card for the front's rows: who posted it, the title, where, the pay, when. */
export function JobCard({ job }: { job: Job }) {
    const location = useLocation();
    const poster = posterOf(job), offering = directionOf(job) === 'OFFERING';
    return (
        <Link className="gk-job" to={`/jobs/${job.id}`} state={opportunityReturnState('jobs', location)} data-offering={offering || undefined}>
            <span className="gk-job__head"><Poster job={job} size={40} /><span className="gk-job__poster"><strong>{poster.name}</strong><small>{offering ? 'Available' : poster.kind === 'CLUB' ? 'Club' : 'Person'} · {categoryLabel(job.category)}</small></span></span>
            <span className="gk-job__title">{job.title}</span>
            <span className="gk-job__line">{[whereLine(job), hoursLabel(job.hours)].filter(Boolean).join(' · ')}</span>
            <span className="gk-job__foot"><PayBadge job={job} /><span className="gk-job__when">{postedLabel(job.createdAt)}</span></span>
        </Link>
    );
}

/** A listing as one line of the catalogue, as LinkedIn lists jobs: pressed, it opens beside the list. */
export function JobRow({ job, selected, onSelect, to }: { job: Job; selected: boolean; onSelect?: () => void; to?: string }) {
    const location = useLocation();
    const poster = posterOf(job), offering = directionOf(job) === 'OFFERING';
    const body = <>
        <span className="gk-job-row__lead"><Poster job={job} size={40} /></span>
        <span className="gk-job-row__main">
            <span className="gk-job-row__title">{job.title}</span>
            <span className="gk-job-row__line">{poster.name}{offering ? ' · available' : ''}</span>
            <span className="gk-job-row__line gk-faint">{[whereLine(job), hoursLabel(job.hours), postedLabel(job.createdAt)].filter(Boolean).join(' · ')}</span>
        </span>
        <span className="gk-job-row__trail"><PayBadge job={job} /></span>
    </>;
    return (
        <li>
            {to ? <Link className="gk-job-row" to={to} state={opportunityReturnState('jobs', location)} aria-current={selected ? 'true' : undefined}>{body}</Link>
                : <button type="button" className="gk-job-row" aria-current={selected ? 'true' : undefined} aria-expanded={selected} onClick={onSelect}>{body}</button>}
        </li>
    );
}

export const JobSkeletons = ({ count = 5 }: { count?: number }) => <>{Array.from({ length: count }, (_, i) => <li key={i}><span className="gk-skeleton gk-job-skeleton" style={{ display: 'block' }} aria-hidden="true" /></li>)}</>;

/** A front-page row of listings with "View all" opening the same search. */
export function JobRowSection({ title, hint, to, jobs, loading, error, retry, empty, action }: {
    title: string; hint?: ReactNode; to?: string; jobs: Job[]; loading: boolean; error: string; retry: () => void; empty: string; action?: ComponentProps<typeof Section>['action'];
}) {
    return (
        <Section title={title} hint={hint} action={action ?? (to && jobs.length ? { label: 'View all', to } : undefined)} >
            {error ? <EmptyNote title="These listings could not load" action={<Button size="sm" onClick={retry}>Retry</Button>}>{error}</EmptyNote>
                : loading && !jobs.length ? <ul className="gk-store-row gk-store-row--wide" aria-busy="true" aria-label="Loading"><JobSkeletons /></ul>
                : !jobs.length ? <EmptyNote title={empty} />
                : <Row label={title} wide>{jobs.map(job => <li key={job.id}><JobCard job={job} /></li>)}</Row>}
        </Section>
    );
}
