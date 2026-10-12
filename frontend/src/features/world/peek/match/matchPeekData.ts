import { useAuth } from '../../../../context/AuthContext';
import type { HistoryMatch } from '../../../matchHistory/api';
import type { Match } from '../../../matchExchange/api';
import { fetchTournament } from '../../../tournaments/api';
import type { TournamentDetail, TournamentFixtureDto } from '../../../tournaments/domain';
import { shared } from '../../cache';
import { loadWindow } from '../../directories/matches/matchday';
import { isoDay, isoDayOf } from '../../format';
import { listingDetail } from '../../front/coach/coachMatches';
import { parseMatchCode } from '../../scoreboard/matchCode';
import { rememberedMatch, rememberedStart } from '../../scoreboard/matchRegistry';
import { zonedMatch } from '../../scoreboard/matchState';
import { zoned } from '../../scoreboard/standings';
import { useWorldData } from '../../useWorldData';

/** A tournament's detail, shared by the match drawer, the tournament drawer and their tables for a minute. */
export const tournamentDetail = (id: number) => shared(`tournament:${id}`, () => fetchTournament(id));

/** An arranged match or open listing as a match-history row (the same shape every match drawer reads). */
export function historyOfListing(m: Match): HistoryMatch {
    const confirmed = m.result_status === 'CONFIRMED';
    return {
        id: `event:${m.event_id}`, source: 'MATCH_EXCHANGE', sourceId: m.event_id, title: m.title, startsAt: m.starts_at_iso, endsAt: m.ends_at_iso, timezone: m.timezone,
        homeClubId: m.club_id, homeClubName: m.club_name, homeSquadId: m.squad_id, homeSquadName: m.squad_name,
        // A club invited and not yet answering is the away side by id only (the listing does not name it).
        awayClubId: m.opponent_club_id ?? m.requested_club_id ?? null, awayClubName: m.opponent_name ?? null, awaySquadId: m.target_squad_id ?? m.requested_squad_id ?? null, awaySquadName: m.opponent_squad_name ?? null,
        homeScore: confirmed ? m.home_score : null, awayScore: confirmed ? m.away_score : null, resultStatus: m.result_status ?? 'NONE',
        fixtureStatus: m.event_status === 'CANCELLED' || m.listing_status === 'CANCELLED' ? 'CANCELLED' : confirmed ? 'COMPLETED' : 'SCHEDULED',
        legacy: Boolean(m.result_legacy), locationName: m.location_name || null, tournamentId: null, tournamentName: null, detailPath: `/match-exchange/${m.event_id}`, canRecordResult: false,
    };
}

/** The person runs the tournament (admin or staff; a referee assignment is not running it), so adds its results. */
export const runsTournament = (t: Pick<TournamentDetail, 'staffAssignments'>, userId: number | null) =>
    userId != null && t.staffAssignments.some(assignment => assignment.userId === userId && assignment.status === 'ACTIVE' && (assignment.role === 'ADMIN' || assignment.role === 'STAFF'));

/** A tournament fixture as a match-history row, from the tournament's detail (thin: no end time, no ground). */
export function historyOfFixture(t: TournamentDetail, f: TournamentFixtureDto, canRecordResult = false): HistoryMatch {
    const entry = (id: number | null) => t.entries.find(item => item.id === id);
    const home = entry(f.homeEntryId), away = entry(f.awayEntryId);
    const counted = f.homeScore != null && f.awayScore != null && f.status === 'COMPLETED';
    return {
        id: `fixture:${f.id}`, source: 'TOURNAMENT', sourceId: f.id, title: t.name, startsAt: zoned(f.scheduledAt), endsAt: null, timezone: null,
        homeClubId: home?.clubId ?? null, homeClubName: home?.clubName ?? f.homeLabel, homeSquadId: home?.squadId ?? null, homeSquadName: home?.squadName ?? null,
        awayClubId: away?.clubId ?? null, awayClubName: away?.clubName ?? f.awayLabel, awaySquadId: away?.squadId ?? null, awaySquadName: away?.squadName ?? null,
        homeScore: counted ? f.homeScore : null, awayScore: counted ? f.awayScore : null, resultStatus: counted ? 'RECORDED' : 'NONE', fixtureStatus: f.status ?? 'SCHEDULED',
        legacy: false, locationName: null, tournamentId: t.id, tournamentName: t.name, detailPath: `/tournaments/${t.id}?fixtureId=${f.id}`, canRecordResult,
    };
}

export interface MatchPeekData { match: HistoryMatch; listing?: Match; tournament?: TournamentDetail; fixture?: TournamentFixtureDto }

/**
 * The match a drawer shows, from its code: an arranged match or listing from its detail (for its result, offers and
 * players), a club fixture from what a list loaded (else today's window), a tournament fixture from its tournament.
 * Shared links work cold; a match no list has loaded and no endpoint returns says so.
 */
export function useMatchPeek(code: string) {
    const { sessionId, user } = useAuth();
    const parsed = parseMatchCode(code);
    const data = useWorldData<MatchPeekData | null>(parsed ? `match-peek:${sessionId}:${code}` : null, async () => {
        const known = rememberedMatch(sessionId, code);
        if (parsed!.source === 'MATCH_EXCHANGE') {
            const listing = await listingDetail(sessionId, parsed!.id);
            return { match: known ? zonedMatch(known) : historyOfListing(listing), listing };
        }
        if (parsed!.source === 'TOURNAMENT') {
            const tournament = await tournamentDetail(parsed!.tournamentId!);
            const fixture = tournament.fixtures.find(item => item.id === parsed!.id);
            if (!fixture) return null;
            return { match: known ? zonedMatch(known) : historyOfFixture(tournament, fixture, runsTournament(tournament, user?.id ?? null)), tournament, fixture };
        }
        if (known) return { match: zonedMatch(known) };
        // Not loaded by a list, or doubted after a change: read again around its own day (else today).
        const start = zoned(rememberedStart(sessionId, code));
        const window = await loadWindow(sessionId, '', start ? isoDayOf(start) : isoDay(0));
        const found = window.items.find(item => item.code === code);
        return found ? { match: found.m } : null;
    }, 'This match could not load.');
    return { ...data, missing: !parsed || (!data.loading && !data.error && data.data === null) };
}

