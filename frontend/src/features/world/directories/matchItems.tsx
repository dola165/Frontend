import { useState } from 'react';
import { Badge, FixtureRow, type BadgeTone } from '../../../design/primitives';
import type { HistoryMatch } from '../../matchHistory/api';
import { HistoricalMatchImport } from '../../matchHistory/HistoricalMatchImport';
import { formats, type Match } from '../../matchExchange/api';
import { journeyLabel } from '../../matchExchange/journeyCopy';
import { first, type DirectoryQuery } from '../directory/types';
import { fixtureDay, fixtureTime, sentence } from '../format';
import '../../matchExchange/match-exchange.css';
import '../../matchHistory/match-history.css';

const SOURCE_LABEL: Record<HistoryMatch['source'], string> = { MATCH_EXCHANGE: 'Friendly', SCHEDULE: 'Club fixture', TOURNAMENT: 'Competition' };
const RESULT: Partial<Record<HistoryMatch['resultStatus'], { label: string; tone: BadgeTone }>> = {
    CONFIRMED: { label: 'Final', tone: 'accent' }, RECORDED: { label: 'Final', tone: 'accent' }, LEGACY: { label: 'Final', tone: 'neutral' },
    PROPOSED: { label: 'Awaiting confirmation', tone: 'warning' }, DISPUTED: { label: 'Disputed', tone: 'danger' }, BYE: { label: 'Bye', tone: 'neutral' },
};
export function FixtureItem({ item: match }: { item: HistoryMatch }) {
    const played = match.homeScore != null && match.awayScore != null;
    const title = match.homeClubName && match.awayClubName ? `${match.homeClubName} v ${match.awayClubName}` : match.title;
    const squads = match.homeSquadName && match.awaySquadName ? (match.homeSquadName === match.awaySquadName ? match.homeSquadName : `${match.homeSquadName} v ${match.awaySquadName}`) : null;
    const result = RESULT[match.resultStatus];
    const [now] = useState(() => Date.now());
    const past = match.startsAt ? Date.parse(match.startsAt) < now : false;
    const trail = match.fixtureStatus === 'CANCELLED' ? <Badge tone="danger">Cancelled</Badge>
        : past && match.canRecordResult && (!result || result.tone === 'warning') ? <Badge tone="warning">Result needed</Badge>
            : past ? (result ? <Badge tone={result.tone}>{result.label}</Badge> : <Badge>No result yet</Badge>)
                : <Badge tone={match.source === 'TOURNAMENT' ? 'violet' : 'neutral'}>{SOURCE_LABEL[match.source]}</Badge>;
    return (
        <FixtureRow tone="match" to={match.detailPath} title={title}
            time={played ? `${match.homeScore} – ${match.awayScore}` : fixtureTime(match.startsAt, match.timezone ?? undefined)}
            day={fixtureDay(match.startsAt, match.timezone ?? undefined)}
            meta={[squads, match.tournamentName, match.locationName].filter(Boolean).join(' · ')}
            trail={trail} />
    );
}

/** Adding a past match is club record-keeping; it is offered beside results to staff who can do it. */
export function PastMatchTool({ query, refresh }: { query: DirectoryQuery; refresh: () => void }) {
    if (first(query, 'period') === 'UPCOMING' || !first(query, 'period')) return null;
    return <div className="gk-world-legacy gk-world-past"><HistoricalMatchImport clubId={Number(first(query, 'clubId')) || undefined} onSaved={refresh} /></div>;
}

export function ListingItem({ item: m }: { item: Match }) {
    return (
        <FixtureRow tone="match" to={`/match-exchange/${m.event_id}`} title={m.title}
            time={fixtureTime(m.starts_at_iso, m.timezone)} day={fixtureDay(m.starts_at_iso, m.timezone)}
            meta={[`${m.club_name} ${m.squad_name}`, formats[m.format] ?? sentence(m.format), sentence(m.level), m.location_name || m.city].filter(Boolean).join(' · ')}
            trail={<>{m.referee_required && m.referee_status === 'NEEDED' && <Badge tone="info">Referee needed</Badge>}<Badge tone="accent">Needs an opponent</Badge></>} />
    );
}

export function ArrangementItem({ item: m }: { item: Match }) {
    const state = m.event_status === 'CANCELLED' ? 'CANCELLED' : m.listing_status;
    const tone: BadgeTone = ['ARRANGED', 'BOOKED', 'ACCEPTED', 'COMPLETED'].includes(state) ? 'accent' : state === 'CANCELLED' ? 'danger' : state === 'OPEN' ? 'neutral' : 'warning';
    return (
        <FixtureRow tone="match" to={`/match-exchange/${m.event_id}`} title={m.opponent_name ? `${m.club_name} v ${m.opponent_name}` : m.title}
            time={fixtureTime(m.starts_at_iso, m.timezone)} day={fixtureDay(m.starts_at_iso, m.timezone)}
            meta={[m.squad_name, formats[m.format] ?? sentence(m.format), m.location_name || m.city].filter(Boolean).join(' · ')}
            trail={<Badge tone={tone}>{state === 'OPEN' ? 'Looking for an opponent' : journeyLabel(state, 'en')}</Badge>} />
    );
}
