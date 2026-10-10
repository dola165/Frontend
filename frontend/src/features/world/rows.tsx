import { BadgeCheck } from 'lucide-react';
import { Badge, FixtureRow, ListRow, type BadgeTone, type FixtureTone } from '../../design/primitives';
import { appLocale } from '../../utils/formatting';
import type { ClubJob } from '../clubs/api';
import { labelForCategory } from '../clubs/jobLabels';
import { structureLabels, type CompetitionCard } from '../competitions/api';
import { postingLabel } from '../tryouts/tryoutCopy';
import type { TryoutPosting } from '../tryouts/api';
import { eventDestination, type EventItem } from '../requests/api';
import type { PersonRole, PersonSummary } from './api';
import { isGeorgian, useWorldCopy, wt } from './copy';
import { Crest } from './Crest';
import { codeLabel, daysUntil, fixtureDay, fixtureTime, shortDate } from './format';

/** Existing two-language labels (en, ka) follow the World language. */
export const bilingual = (en: string, ka: string) => (isGeorgian() ? ka : en);

const ENGAGEMENT: Record<string, { label: string; tone: BadgeTone }> = {
    PAID: { label: 'Paid', tone: 'accent' }, VOLUNTEER: { label: 'Volunteer', tone: 'violet' }, FLEXIBLE: { label: 'Paid or volunteer', tone: 'info' }, UNSPECIFIED: { label: 'Terms to discuss', tone: 'neutral' },
};

/** "Posted today", "Posted 3 days ago". */
export function postedLabel(value?: string | null) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return wt('Recently posted');
    const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
    return days === 0 ? wt('Posted today') : days === 1 ? wt('Posted yesterday') : wt('Posted {days} days ago', { days });
}

/** An open club role: who posted it, what it is, paid or volunteer. */
export function JobRow({ job, compact = false }: { job: ClubJob; compact?: boolean }) {
    const t = useWorldCopy();
    const engagement = ENGAGEMENT[job.engagementType ?? 'UNSPECIFIED'] ?? ENGAGEMENT.UNSPECIFIED;
    const place = [job.clubCityName, job.clubCountryName].filter(Boolean).join(', ');
    return (
        <ListRow to={`/jobs/${job.id}`} lead={<Crest src={job.clubLogoUrl} name={job.clubName ?? job.title} size={compact ? 36 : 40} />}
            title={job.title}
            meta={(compact ? [job.clubName, job.clubCityName] : [job.clubName, t(labelForCategory(job.category)), place, postedLabel(job.createdAt)]).filter(Boolean).join(' · ')}
            trail={<Badge tone={engagement.tone}>{t(engagement.label)}</Badge>} />
    );
}

/** A published trial on the fixture line: when, who, for which age group. */
export function TrialRow({ trial }: { trial: TryoutPosting }) {
    useWorldCopy();
    return (
        <FixtureRow tone="trial" to={`/tryouts/${trial.id}`} title={trial.title}
            time={fixtureTime(trial.tryoutDate)} day={fixtureDay(trial.tryoutDate)}
            meta={[trial.clubName, codeLabel(trial.ageGroup), codeLabel(trial.position), trial.location].filter(Boolean).join(' · ')}
            trail={<Badge tone={trial.status === 'OPEN' ? 'warning' : 'neutral'}>{postingLabel(trial.status, bilingual)}</Badge>} />
    );
}

/** Who can enter a competition. */
export const SCOPE_LABEL: Record<string, string> = { CLUB: 'Club teams', SQUAD: 'Squads', PLAYER: 'Individual players' };
/** A competition's published status as a badge. */
export const COMPETITION_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
    PLANNING: { label: 'Planning', tone: 'violet' }, ACTIVE: { label: 'In progress', tone: 'accent' }, COMPLETED: { label: 'Completed', tone: 'neutral' }, CANCELLED: { label: 'Cancelled', tone: 'danger' },
};

/** Entry state in words, from the published status and closing date. */
function EntryState({ card }: { card: CompetitionCard & { registrationClosesAt?: string | null } }) {
    const t = useWorldCopy();
    if (card.status !== 'PLANNING' && COMPETITION_STATUS[card.status]) return <Badge tone={COMPETITION_STATUS[card.status].tone}>{t(COMPETITION_STATUS[card.status].label)}</Badge>;
    const left = daysUntil(card.registrationClosesAt);
    if (left != null && left < 0) return <Badge>{t('Entries closed')}</Badge>;
    if (left != null) return <Badge tone={left <= 7 ? 'warning' : 'violet'}>{t('Closes {date}', { date: shortDate(card.registrationClosesAt) ?? '' })}</Badge>;
    return <Badge tone="violet">{t('Upcoming')}</Badge>;
}

/** A date on the fixture line: the day number over the month, or "to confirm". */
export function dateColumn(value?: string | null) {
    const start = value ? new Date(value) : null;
    const valid = Boolean(start && !Number.isNaN(start.getTime()));
    return valid
        ? { time: start!.toLocaleDateString(appLocale(), { day: 'numeric' }), day: start!.toLocaleDateString(appLocale(), { month: 'short' }) }
        : { time: wt('TBC'), day: wt('Dates to confirm') };
}

/** A competition on the fixture line, dated by its first day. */
export function CompetitionRow({ card, compact = false }: { card: CompetitionCard; compact?: boolean }) {
    const t = useWorldCopy();
    const rules = card.profile?.rules;
    const capacity = card.entryCap ? t('{count} of {cap} places taken', { count: card.entryCount, cap: card.entryCap }) : card.entryCount ? t('{count} entered', { count: card.entryCount }) : null;
    const facts = compact
        ? [rules && codeLabel(rules.ageGroup), rules && `${rules.sideSize}v${rules.sideSize}`, rules?.city]
        : [rules && codeLabel(rules.ageGroup), rules && `${rules.sideSize}v${rules.sideSize}`, rules && t(structureLabels[rules.structure]), t(SCOPE_LABEL[card.participantScope] ?? ''), card.hostClubName || card.organizerName, rules?.city, capacity];
    return (
        <FixtureRow tone="event" to={`/tournaments/${card.id}`} title={card.name} {...dateColumn(card.startDate)}
            meta={facts.filter(Boolean).join(' · ')} trail={<EntryState card={card} />} />
    );
}

const ROLE_LABEL: Record<PersonRole, string> = { COACH: 'Coach', PLAYER: 'Player', REFEREE: 'Referee', AGENT: 'Agent', SPECIALIST: 'Specialist', CLUB_STAFF: 'Club staff' };

/** A person with a public football profile. Confirmation is shown only when it exists. */
export function PersonRow({ person: p, compact = false }: { person: PersonSummary; compact?: boolean }) {
    const t = useWorldCopy();
    const club = p.clubName && !p.headline?.includes(p.clubName) ? p.clubName : null;
    return (
        <ListRow to={`/profile/${p.id}`} lead={<Crest src={p.avatarUrl} name={p.fullName} round size={compact ? 36 : 40} />}
            title={<span className="gk-world-row-title"><span>{p.fullName}</span>{p.verified && <BadgeCheck className="gk-world-verified" aria-label={t('Confirmed by a club or licence')} />}</span>}
            meta={[p.headline || p.profession, compact ? null : club, p.city].filter(Boolean).join(' · ')}
            trail={<Badge tone={p.role === 'REFEREE' ? 'info' : p.role === 'COACH' ? 'accent' : 'neutral'}>{t(ROLE_LABEL[p.role])}</Badge>} />
    );
}

const EVENT_TONE: Record<string, FixtureTone> = { MATCH: 'match', TOURNAMENT: 'event', TRYOUT: 'trial', TRAINING: 'training' };
const EVENT_BADGE: Record<string, { label: string; tone: BadgeTone }> = {
    MATCH: { label: 'Match', tone: 'accent' }, TOURNAMENT: { label: 'Competition', tone: 'violet' }, TRYOUT: { label: 'Trial', tone: 'warning' }, TRAINING: { label: 'Training', tone: 'info' }, OTHER: { label: 'Event', tone: 'neutral' },
};

/** One published event (match, competition, trial, public training) on the fixture line. */
export function EventItemRow({ item }: { item: EventItem }) {
    const t = useWorldCopy();
    const badge = EVENT_BADGE[item.activity] ?? EVENT_BADGE.OTHER;
    const allDay = item.activity === 'TOURNAMENT' && fixtureTime(item.startsAt) === '00:00';
    return (
        <FixtureRow tone={EVENT_TONE[item.activity] ?? 'event'} to={eventDestination(item) ?? undefined}
            time={allDay ? t('All day') : fixtureTime(item.startsAt)} day={fixtureDay(item.startsAt)} title={item.name}
            meta={[item.context, item.location, item.recurring ? t('Every week') : null].filter(Boolean).join(' · ')}
            trail={<Badge tone={badge.tone}>{t(badge.label)}</Badge>} />
    );
}
