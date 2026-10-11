import { BadgeCheck } from 'lucide-react';
import { Badge, FixtureRow, ListRow, type FixtureTone } from '../../design/primitives';
import type { ClubJob } from '../clubs/api';
import { labelForCategory } from '../clubs/jobLabels';
import { structureLabels, type CompetitionCard } from '../competitions/api';
import { postingLabel } from '../tryouts/tryoutCopy';
import type { TryoutPosting } from '../tryouts/api';
import { eventDestination, type EventItem } from '../requests/api';
import type { PersonSummary } from './api';
import { useWorldCopy } from './copy';
import { Crest } from './Crest';
import { useMapCounterpart } from './directory/selection';
import { bilingual, codeLabel, dateColumn, ENGAGEMENT, entryState, EVENT_BADGE, fixtureDay, fixtureTime, PERSON_ROLE, postedLabel, SCOPE_LABEL } from './format';

/** An open club role: who posted it, what it is, paid or volunteer. */
export function JobRow({ job, compact = false }: { job: ClubJob; compact?: boolean }) {
    const t = useWorldCopy();
    const engagement = ENGAGEMENT[job.engagementType ?? 'UNSPECIFIED'] ?? ENGAGEMENT.UNSPECIFIED;
    const place = [job.clubCityName, job.clubCountryName].filter(Boolean).join(', ');
    return (
        <ListRow to={`/jobs/${job.id}`} {...useMapCounterpart()} lead={<Crest src={job.clubLogoUrl} name={job.clubName ?? job.title} size={compact ? 36 : 40} />}
            title={job.title}
            meta={(compact ? [job.clubName, job.clubCityName] : [job.clubName, t(labelForCategory(job.category)), place, postedLabel(job.createdAt)]).filter(Boolean).join(' · ')}
            trail={<Badge tone={engagement.tone}>{t(engagement.label)}</Badge>} />
    );
}

/** A published trial on the fixture line: when, who, for which age group. */
export function TrialRow({ trial }: { trial: TryoutPosting }) {
    useWorldCopy();
    return (
        <FixtureRow tone="trial" to={`/tryouts/${trial.id}`} title={trial.title} {...useMapCounterpart()}
            time={fixtureTime(trial.tryoutDate)} day={fixtureDay(trial.tryoutDate)}
            meta={[trial.clubName, codeLabel(trial.ageGroup), codeLabel(trial.position), trial.location].filter(Boolean).join(' · ')}
            trail={<Badge tone={trial.status === 'OPEN' ? 'accent' : 'neutral'}>{postingLabel(trial.status, bilingual)}</Badge>} />
    );
}

/** Entry state in words, from the published status and closing date. */
function EntryState({ card }: { card: CompetitionCard & { registrationClosesAt?: string | null } }) {
    useWorldCopy();
    const state = entryState(card.status, card.registrationClosesAt);
    return <Badge tone={state.tone}>{state.label}</Badge>;
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
        <FixtureRow tone="event" to={`/tournaments/${card.id}`} title={card.name} {...dateColumn(card.startDate)} {...useMapCounterpart()}
            meta={facts.filter(Boolean).join(' · ')} trail={<EntryState card={card} />} />
    );
}


/** A person with a public football profile. Confirmation is shown only when it exists. */
export function PersonRow({ person: p, compact = false }: { person: PersonSummary; compact?: boolean }) {
    const t = useWorldCopy();
    const club = p.clubName && !p.headline?.includes(p.clubName) ? p.clubName : null;
    return (
        <ListRow to={`/profile/${p.id}`} {...useMapCounterpart()} lead={<Crest src={p.avatarUrl} name={p.fullName} round size={compact ? 36 : 40} />}
            title={<span className="gk-world-row-title"><span>{p.fullName}</span>{p.verified && <BadgeCheck className="gk-world-verified" aria-label={t('Confirmed by a club or licence')} />}</span>}
            meta={[p.headline || p.profession, compact ? null : club, p.city].filter(Boolean).join(' · ')}
            trail={<Badge tone={p.role === 'REFEREE' ? 'info' : p.role === 'COACH' ? 'accent' : 'neutral'}>{t(PERSON_ROLE[p.role])}</Badge>} />
    );
}

const EVENT_TONE: Record<string, FixtureTone> = { MATCH: 'match', TOURNAMENT: 'event', TRYOUT: 'trial', TRAINING: 'training' };

/** One published event (match, competition, trial, public training) on the fixture line. */
export function EventItemRow({ item }: { item: EventItem }) {
    const t = useWorldCopy();
    const badge = EVENT_BADGE[item.activity] ?? EVENT_BADGE.OTHER;
    const allDay = item.activity === 'TOURNAMENT' && fixtureTime(item.startsAt) === '00:00';
    return (
        <FixtureRow tone={EVENT_TONE[item.activity] ?? 'event'} to={eventDestination(item) ?? undefined} {...useMapCounterpart()}
            time={allDay ? t('All day') : fixtureTime(item.startsAt)} day={fixtureDay(item.startsAt)} title={item.name}
            meta={[item.context, item.location, item.recurring ? t('Every week') : null].filter(Boolean).join(' · ')}
            trail={<Badge tone={badge.tone}>{t(badge.label)}</Badge>} />
    );
}
