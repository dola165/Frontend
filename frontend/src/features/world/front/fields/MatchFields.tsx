import { ButtonLink, EmptyNote } from '../../../../design/primitives';
import { formats, type Match } from '../../../matchExchange/api';
import type { CompetitionCard } from '../../../competitions/api';
import { useWorldCopy } from '../../copy';
import { codeLabel, daysUntil, fixtureDay, fixtureTime, shortDate } from '../../format';
import { useArrangements, useComingUp, useLiveCompetitions, useOpenCompetitions, useOpenMatches, useRefereeNeeded, useResults } from '../frontData';
import { WorldField } from '../WorldField';
import { rowsFor, when, type FieldProps } from './fieldProps';
import { Line, MatchLine, ScoreGroups } from './Scoreboard';

/** "FC A vs FC B" into its two sides; a single name stays on the first line. */
const sides = (name: string): [string, string] => { const [home, away] = name.split(/\s+v(?:s\.?)?\s+/i); return [home, away ?? '']; };
/** "U14 Girls · Friendly" into its team and its competition. */
const contextOf = (context: string) => { const [team, competition] = context.split(' · '); return { team, competition: competition ?? team }; };
const closesAt = (card: CompetitionCard) => (card as CompetitionCard & { registrationClosesAt?: string | null }).registrationClosesAt;

/** Squads looking for an opponent, by day, as a fixture with the opponent still to find. */
function Listings({ items, side, tag }: { items: Match[]; side?: boolean; tag?: (match: Match) => string }) {
    const t = useWorldCopy();
    return <ScoreGroups label={t('Teams looking for a match')} items={items.slice(0, rowsFor(side))} group={m => fixtureDay(m.starts_at_iso, m.timezone)}>
        {m => <MatchLine key={m.event_id} to={`/match-exchange/${m.event_id}`} title={m.title} time={fixtureTime(m.starts_at_iso, m.timezone)}
            home={{ name: `${m.club_name} ${m.squad_name}`, logo: m.club_logo_url }} away={{ name: t('Opponent wanted'), muted: true }}
            tag={tag ? tag(m) : t(formats[m.format] ?? codeLabel(m.format))} />}
    </ScoreGroups>;
}
const byStart = (items: Match[]) => [...items].sort((a, b) => Date.parse(a.starts_at_iso) - Date.parse(b.starts_at_iso));

/** Teams near the area looking for an opponent: a head coach's first reason to open World. */
export function OpenMatchesField({ area, side }: FieldProps) {
    const t = useWorldCopy();
    const data = useOpenMatches(area);
    const items = byStart(data.data?.items ?? []);
    const next = items[0];
    return (
        <WorldField id="matches" side={side} count={data.data?.total ?? null} loading={data.loading} error={data.error} onRetry={data.retry}
            hint={next ? `${t('Next')}: ${when(next.starts_at_iso, next.timezone)} · ${t(formats[next.format] ?? codeLabel(next.format))}` : undefined}
            all={{ label: t('All open matches'), to: '/world/matches?tab=exchange' }}>
            {items.length ? <Listings items={items} side={side} />
                : <EmptyNote title={t('No open matches right now')} action={<ButtonLink size="sm" to="/world/matches/arrange">{t('Arrange a match')}</ButtonLink>}>{t('Teams post here when they need an opponent for a date.')}</EmptyNote>}
        </WorldField>
    );
}

/** Arranged matches still looking for an official: a referee's first reason to open World. */
export function RefereeNeededField({ area, side }: FieldProps) {
    const t = useWorldCopy();
    const data = useRefereeNeeded(area);
    const next = data.items[0];
    return (
        <WorldField id="refereeNeeded" side={side} count={data.data ? data.items.length : null} loading={data.loading} error={data.error} onRetry={data.retry}
            hint={next ? `${t('Next')}: ${when(next.starts_at_iso, next.timezone)}` : undefined} all={{ label: t('All open matches'), to: '/world/matches?tab=exchange' }}>
            {data.items.length ? <Listings items={data.items} side={side} tag={m => `${t(formats[m.format] ?? codeLabel(m.format))} · ${m.location_name || m.city}`} />
                : <EmptyNote title={t('Every arranged match has a referee')}>{t('Matches that still need an official appear here.')}</EmptyNote>}
        </WorldField>
    );
}

/** The friendlies this person is arranging: opponent, pitch and referee still to settle. */
export function ArrangementsField({ side }: FieldProps) {
    const t = useWorldCopy();
    const data = useArrangements();
    const items = byStart(data.data?.items ?? []);
    return (
        <WorldField id="arrangements" side={side} count={data.data?.total ?? null} loading={data.loading} error={data.error} onRetry={data.retry}
            hint={items[0] ? `${t('Next')}: ${when(items[0].starts_at_iso, items[0].timezone)}` : undefined} all={{ label: t('All your arrangements'), to: '/world/matches?tab=mine' }}>
            {items.length ? <Listings items={items} side={side} />
                : <EmptyNote title={t('Nothing being arranged')} action={<ButtonLink size="sm" to="/world/matches/arrange">{t('Arrange a match')}</ButtonLink>}>{t('Friendlies you arrange appear here until they are played.')}</EmptyNote>}
        </WorldField>
    );
}

/** Published matches near you in the next ten days, under their competition as on a score site. */
export function EventsField({ area, side }: FieldProps) {
    const t = useWorldCopy();
    const data = useComingUp(area);
    const next = data.items[0];
    return (
        <WorldField id="events" side={side} count={data.data ? data.items.length : null} loading={data.loading} error={data.error} onRetry={data.retry}
            hint={next ? `${t('Next')}: ${when(next.startsAt)}` : t('Next 10 days')} all={{ label: t('All events'), to: data.all }}>
            {data.items.length ? <ScoreGroups label={t('Matches near you')} items={data.items.slice(0, rowsFor(side) + 3)}
                group={item => { const { competition } = contextOf(item.context); return competition === 'Friendly' ? t('Friendlies') : competition; }}>
                {item => {
                    const [home, away] = sides(item.name), { team } = contextOf(item.context);
                    return <MatchLine key={`${item.kind}:${item.id}`} to={item.destination || undefined} title={[item.name, item.location].filter(Boolean).join(' · ')}
                        time={fixtureTime(item.startsAt)} day={fixtureDay(item.startsAt)} home={{ name: home }} away={{ name: away || t('To be confirmed'), muted: !away }} tag={team} />;
                }}
            </ScoreGroups> : <EmptyNote title={t('Nothing published near {city} in the next 10 days', { city: area.city })}>{t('Clubs and organisers publish matches and competitions here.')}</EmptyNote>}
        </WorldField>
    );
}

/** Recorded results, under their competition, with the winner in bold. */
export function ResultsField({ side }: FieldProps) {
    const t = useWorldCopy();
    const data = useResults();
    const items = data.data?.items ?? [];
    return (
        <WorldField id="results" side={side} count={data.data?.total ?? null} loading={data.loading} error={data.error} onRetry={data.retry}
            hint={items[0] ? shortDate(items[0].startsAt) : undefined} all={{ label: t('All results'), to: '/world/matches?period=HISTORY' }}>
            {items.length ? <ScoreGroups label={t('Latest results')} items={items.slice(0, rowsFor(side) + 3)}
                group={match => match.tournamentName || (match.source === 'MATCH_EXCHANGE' ? t('Friendlies') : t('Club fixtures'))}>
                {match => <MatchLine key={match.id} to={match.detailPath} title={match.title} state={match.homeScore != null ? 'FT' : undefined} time={fixtureTime(match.startsAt)} day={fixtureDay(match.startsAt)}
                    home={{ name: [match.homeClubName, match.homeSquadName].filter(Boolean).join(' ') || match.title, score: match.homeScore }}
                    away={{ name: [match.awayClubName, match.awaySquadName].filter(Boolean).join(' '), score: match.awayScore }}
                    tag={match.homeScore != null ? fixtureDay(match.startsAt) : undefined} />}
            </ScoreGroups> : <EmptyNote title={t('No results recorded yet')} />}
        </WorldField>
    );
}

/** Competitions by age group: name, format and host, and when entries close or how many teams play. */
function CompetitionLines({ items, label, live }: { items: CompetitionCard[]; label: string; live?: boolean }) {
    const t = useWorldCopy();
    return <ScoreGroups label={label} items={items} group={card => card.profile?.rules ? codeLabel(card.profile.rules.ageGroup) : t('Open to all')}>
        {card => {
            const rules = card.profile?.rules, left = daysUntil(closesAt(card));
            return <Line key={card.id} to={`/tournaments/${card.id}`} crest={card.bannerImageUrl} name={card.name}
                detail={[rules && `${rules.sideSize}v${rules.sideSize}`, card.hostClubName || card.organizerName, rules?.city].filter(Boolean).join(' · ')}
                fact={live ? t('{count} teams', { count: card.entryCount }) : left != null && left >= 0 ? t('Closes {date}', { date: shortDate(closesAt(card)) ?? '' }) : shortDate(card.startDate)}
                factTone={!live && left != null && left >= 0 && left <= 7 ? 'warning' : undefined} />;
        }}
    </ScoreGroups>;
}

/** Leagues and cups taking entries now, by age group. */
export function CompetitionsField({ side }: FieldProps) {
    const t = useWorldCopy();
    const data = useOpenCompetitions();
    const items = data.data?.content ?? [];
    return (
        <WorldField id="competitions" side={side} count={data.data ? data.data.totalElements ?? items.length : null} loading={data.loading} error={data.error} onRetry={data.retry}
            hint={items[0]?.name} all={{ label: t('All competitions'), to: '/world/competitions?registration=OPEN' }}>
            {items.length ? <CompetitionLines items={items.slice(0, rowsFor(side))} label={t('Open for entries')} />
                : <EmptyNote title={t('No competitions are taking entries')}>{t('New leagues and cups appear here when entries open.')}</EmptyNote>}
        </WorldField>
    );
}

/** Leagues and cups being played now, to follow. */
export function LiveCompetitionsField({ side }: FieldProps) {
    const t = useWorldCopy();
    const data = useLiveCompetitions();
    const items = data.data?.content ?? [];
    return (
        <WorldField id="liveCompetitions" side={side} count={data.data ? data.data.totalElements ?? items.length : null} loading={data.loading} error={data.error} onRetry={data.retry}
            hint={items[0]?.name} all={{ label: t('All competitions'), to: '/world/competitions?status=ACTIVE' }}>
            {items.length ? <CompetitionLines items={items.slice(0, rowsFor(side))} label={t('Competitions on now')} live />
                : <EmptyNote title={t('No competitions are being played right now')} />}
        </WorldField>
    );
}
