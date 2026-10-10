import { BadgeCheck } from 'lucide-react';
import { Badge, FixtureRow, ListRow, type BadgeTone, type FixtureTone } from '../../design/primitives';
import { appLocale } from '../../utils/formatting';
import type { ClubJob } from '../clubs/api';
import { labelForCategory, locationLabel, relativeDate } from '../clubs/jobLabels';
import { structureLabels, type CompetitionCard } from '../competitions/api';
import { postingLabel } from '../tryouts/tryoutCopy';
import type { TryoutPosting } from '../tryouts/api';
import { eventDestination, type EventItem } from '../requests/api';
import type { PersonRole, PersonSummary } from './api';
import { Crest } from './Crest';
import { daysUntil, fixtureDay, fixtureTime, shortDate } from './format';

const english = (en: string) => en;

const ENGAGEMENT: Record<string, { label: string; tone: BadgeTone }> = {
    PAID: { label: 'Paid', tone: 'accent' }, VOLUNTEER: { label: 'Volunteer', tone: 'violet' }, FLEXIBLE: { label: 'Paid or volunteer', tone: 'info' }, UNSPECIFIED: { label: 'Terms to discuss', tone: 'neutral' },
};

/** An open club role: who posted it, what it is, paid or volunteer. */
export function JobRow({ job, compact = false }: { job: ClubJob; compact?: boolean }) {
    const engagement = ENGAGEMENT[job.engagementType ?? 'UNSPECIFIED'] ?? ENGAGEMENT.UNSPECIFIED;
    return (
        <ListRow to={`/jobs/${job.id}`} lead={<Crest src={job.clubLogoUrl} name={job.clubName ?? job.title} size={compact ? 36 : 40} />}
            title={job.title}
            meta={(compact ? [job.clubName, job.clubCityName] : [job.clubName, labelForCategory(job.category), locationLabel(job), relativeDate(job.createdAt)]).filter(Boolean).join(' · ')}
            trail={<Badge tone={engagement.tone}>{engagement.label}</Badge>} />
    );
}

/** A published trial on the fixture line: when, who, for which age group. */
export function TrialRow({ trial }: { trial: TryoutPosting }) {
    return (
        <FixtureRow tone="trial" to={`/tryouts/${trial.id}`} title={trial.title}
            time={fixtureTime(trial.tryoutDate)} day={fixtureDay(trial.tryoutDate)}
            meta={[trial.clubName, trial.ageGroup, trial.position, trial.location].filter(Boolean).join(' · ')}
            trail={<Badge tone={trial.status === 'OPEN' ? 'warning' : 'neutral'}>{postingLabel(trial.status, english)}</Badge>} />
    );
}

const SCOPE_LABEL: Record<string, string> = { CLUB: 'Club teams', SQUAD: 'Squads', PLAYER: 'Individual players' };

/** Entry state in words, from the published status and closing date. */
function entryState(card: CompetitionCard & { registrationClosesAt?: string | null }) {
    if (card.status === 'COMPLETED') return <Badge>Completed</Badge>;
    if (card.status === 'CANCELLED') return <Badge tone="danger">Cancelled</Badge>;
    if (card.status === 'ACTIVE') return <Badge tone="accent">In progress</Badge>;
    const left = daysUntil(card.registrationClosesAt);
    if (left != null && left < 0) return <Badge>Entries closed</Badge>;
    if (left != null) return <Badge tone={left <= 7 ? 'warning' : 'violet'}>Closes {shortDate(card.registrationClosesAt)}</Badge>;
    return <Badge tone="violet">Upcoming</Badge>;
}

/** A competition on the fixture line, dated by its first day. */
export function CompetitionRow({ card, compact = false }: { card: CompetitionCard; compact?: boolean }) {
    const rules = card.profile?.rules;
    const start = card.startDate ? new Date(card.startDate) : null;
    const valid = Boolean(start && !Number.isNaN(start.getTime()));
    const capacity = card.entryCap ? `${card.entryCount} of ${card.entryCap} places taken` : card.entryCount ? `${card.entryCount} entered` : null;
    const facts = compact
        ? [rules && (rules.ageGroup === 'SENIOR' ? 'Senior' : rules.ageGroup), rules && `${rules.sideSize}v${rules.sideSize}`, rules?.city]
        : [rules && (rules.ageGroup === 'SENIOR' ? 'Senior' : rules.ageGroup), rules && `${rules.sideSize}v${rules.sideSize}`, rules && structureLabels[rules.structure], SCOPE_LABEL[card.participantScope], card.hostClubName || card.organizerName, rules?.city, capacity];
    return (
        <FixtureRow tone="event" to={`/tournaments/${card.id}`} title={card.name}
            time={valid ? start!.toLocaleDateString(appLocale(), { day: 'numeric' }) : 'TBC'}
            day={valid ? start!.toLocaleDateString(appLocale(), { month: 'short' }) : 'Dates to confirm'}
            meta={facts.filter(Boolean).join(' · ')}
            trail={entryState(card)} />
    );
}

const ROLE_LABEL: Record<PersonRole, string> = { COACH: 'Coach', PLAYER: 'Player', REFEREE: 'Referee', AGENT: 'Agent', SPECIALIST: 'Specialist', CLUB_STAFF: 'Club staff' };

/** A person with a public football profile. Confirmation is shown only when it exists. */
export function PersonRow({ person: p, compact = false }: { person: PersonSummary; compact?: boolean }) {
    const club = p.clubName && !p.headline?.includes(p.clubName) ? p.clubName : null;
    return (
        <ListRow to={`/profile/${p.id}`} lead={<Crest src={p.avatarUrl} name={p.fullName} round size={compact ? 36 : 40} />}
            title={<span className="gk-world-row-title">{p.fullName}{p.verified && <BadgeCheck className="gk-world-verified" aria-label="Confirmed by a club or licence" />}</span>}
            meta={[p.headline || p.profession, compact ? null : club, p.city].filter(Boolean).join(' · ')}
            trail={<Badge tone={p.role === 'REFEREE' ? 'info' : p.role === 'COACH' ? 'accent' : 'neutral'}>{ROLE_LABEL[p.role]}</Badge>} />
    );
}

const EVENT_TONE: Record<string, FixtureTone> = { MATCH: 'match', TOURNAMENT: 'event', TRYOUT: 'trial', TRAINING: 'training' };
const EVENT_BADGE: Record<string, { label: string; tone: BadgeTone }> = {
    MATCH: { label: 'Match', tone: 'accent' }, TOURNAMENT: { label: 'Competition', tone: 'violet' }, TRYOUT: { label: 'Trial', tone: 'warning' }, TRAINING: { label: 'Training', tone: 'info' }, OTHER: { label: 'Event', tone: 'neutral' },
};

/** One published event (match, competition, trial, public training) on the fixture line. */
export function EventItemRow({ item }: { item: EventItem }) {
    const badge = EVENT_BADGE[item.activity] ?? EVENT_BADGE.OTHER;
    const allDay = item.activity === 'TOURNAMENT' && fixtureTime(item.startsAt) === '00:00';
    return (
        <FixtureRow tone={EVENT_TONE[item.activity] ?? 'event'} to={eventDestination(item) ?? undefined}
            time={allDay ? 'All day' : fixtureTime(item.startsAt)} day={fixtureDay(item.startsAt)} title={item.name}
            meta={[item.context, item.location, item.recurring ? 'Every week' : null].filter(Boolean).join(' · ')}
            trail={<Badge tone={badge.tone}>{badge.label}</Badge>} />
    );
}
