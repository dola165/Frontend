import { useState } from 'react';
import { Badge, FixtureRow } from '../../../design/primitives';
import type { HistoryMatch } from '../../matchHistory/api';
import { HistoricalMatchImport } from '../../matchHistory/HistoricalMatchImport';
import { formats, type Match } from '../../matchExchange/api';
import { journeyLabel } from '../../matchExchange/journeyCopy';
import { isGeorgian, useWorldCopy } from '../copy';
import { useMapCounterpart } from '../directory/selection';
import { first, type DirectoryQuery } from '../directory/types';
import { codeLabel, fixtureDay, fixtureTime } from '../format';
import { arrangementState, arrangementTone, HOSTING, readiness, RESULT, SOURCE_LABEL } from './matchLines';
import '../../matchExchange/match-exchange.css';
import '../../matchHistory/match-history.css';

export function FixtureItem({ item: match }: { item: HistoryMatch }) {
    const t = useWorldCopy();
    const counterpart = useMapCounterpart();
    const title = match.homeClubName && match.awayClubName ? `${match.homeClubName} v ${match.awayClubName}` : match.title;
    const squads = match.homeSquadName && match.awaySquadName ? (match.homeSquadName === match.awaySquadName ? match.homeSquadName : `${match.homeSquadName} v ${match.awaySquadName}`) : null;
    const played = match.homeScore != null && match.awayScore != null;
    const result = RESULT[match.resultStatus];
    const [now] = useState(() => Date.now());
    const past = match.startsAt ? Date.parse(match.startsAt) < now : false;
    const trail = match.fixtureStatus === 'CANCELLED' ? <Badge tone="danger">{t('Cancelled')}</Badge>
        : past && match.canRecordResult && (!result || result.tone === 'warning') ? <Badge tone="warning">{t('Result needed')}</Badge>
            : past ? (result ? <Badge tone={result.tone}>{t(result.label)}</Badge> : <Badge>{t('No result yet')}</Badge>)
                : <Badge tone={match.source === 'TOURNAMENT' ? 'violet' : 'neutral'}>{t(SOURCE_LABEL[match.source])}</Badge>;
    return (
        <FixtureRow tone="match" to={match.detailPath} title={title} {...counterpart}
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

/** An open match: when, who, the format, and where it would be played. The tab itself says they need an opponent. */
export function ListingItem({ item: m }: { item: Match }) {
    const t = useWorldCopy();
    const counterpart = useMapCounterpart();
    const hosting = HOSTING[m.venue_preference];
    const [pitch, referee] = readiness(m);
    return (
        <FixtureRow tone="match" to={`/match-exchange/${m.event_id}`} title={m.title} {...counterpart}
            time={fixtureTime(m.starts_at_iso, m.timezone)} day={fixtureDay(m.starts_at_iso, m.timezone)}
            meta={[`${m.club_name} ${m.squad_name}`, t(formats[m.format] ?? codeLabel(m.format)), codeLabel(m.level), m.location_name || m.city, pitch && t(pitch)].filter(Boolean).join(' · ')}
            trail={<>{referee && <Badge tone="info">{t(referee)}</Badge>}{hosting && <Badge tone="accent">{t(hosting)}</Badge>}</>} />
    );
}

export function ArrangementItem({ item: m }: { item: Match }) {
    const t = useWorldCopy();
    const counterpart = useMapCounterpart();
    const state = arrangementState(m);
    return (
        <FixtureRow tone="match" to={`/match-exchange/${m.event_id}`} title={m.opponent_name ? `${m.club_name} v ${m.opponent_name}` : m.title} {...counterpart}
            time={fixtureTime(m.starts_at_iso, m.timezone)} day={fixtureDay(m.starts_at_iso, m.timezone)}
            meta={[m.squad_name, t(formats[m.format] ?? codeLabel(m.format)), m.location_name || m.city].filter(Boolean).join(' · ')}
            trail={<Badge tone={arrangementTone(state)}>{state === 'OPEN' ? t('Looking for an opponent') : journeyLabel(state, isGeorgian() ? 'ka' : 'en')}</Badge>} />
    );
}
