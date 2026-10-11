import { useAuth } from '../../../../context/AuthContext';
import type { AuthSessionId } from '../../../../utils/authStorage';
import { getMatchHistory, type HistoryMatch } from '../../../matchHistory/api';
import { get as exchangeGet, type Match } from '../../../matchExchange/api';
import { fetchMatchListings } from '../../api';
import { useWorldData } from '../../useWorldData';
import { shared } from './cache';
import { endOf, formOf, lastMeeting, sideIn, type FormResult } from './form';
import { zoned } from './standings';
import { fitsGender, type MySquad, type SquadFocus } from './mySquads';

/** Shared requests outlive the field that started them, so they carry no field's abort signal. */
const detached = () => new AbortController().signal;
type Period = 'UPCOMING' | 'HISTORY';

/** The squads' fixtures or results in the World directory: all squads in focus, or the one. */
export const fixturesLink = (focus: SquadFocus, period: 'UPCOMING' | 'HISTORY') =>
    `/world/matches?${new URLSearchParams({ tab: 'fixtures', period, mine: 'true', ...(focus.focus.length === 1 ? { squadId: String(focus.focus[0].id) } : {}) })}`;

/** Match history for a squad, a club or a competition, shared by every field that needs it for a minute. */
export function historyOf(sessionId: AuthSessionId, scope: { squadId?: number | null; clubId?: number | null; tournamentId?: number | null }, period: Period, size = 20) {
    const query = new URLSearchParams({ period, page: '0', size: String(size) });
    for (const [key, value] of Object.entries(scope)) if (value != null) query.set(key, String(value));
    // Club fixtures and tournament matches come as the venue's wall clock without a zone; friendlies in UTC.
    return shared(`history:${sessionId}:${query}`, () => getMatchHistory(query.toString(), detached(), sessionId)
        .then(page => page.items.map(match => ({ ...match, startsAt: zoned(match.startsAt), endsAt: zoned(match.endsAt) }))));
}

export interface SquadBoard { squad: MySquad; upcoming: HistoryMatch[]; recent: HistoryMatch[] }

/** Each squad in focus with its coming matches (soonest first) and its recent results (newest first). */
export function useSquadBoards(focus: SquadFocus) {
    const { sessionId } = useAuth();
    const ids = focus.focus.map(squad => squad.id).join(',');
    return useWorldData<SquadBoard[]>(focus.status === 'ready' ? `squad-boards:${sessionId}:${ids}` : null, () => Promise.all(focus.focus.map(async squad => {
        const [upcoming, recent] = await Promise.all([historyOf(sessionId, { squadId: squad.id }, 'UPCOMING'), historyOf(sessionId, { squadId: squad.id }, 'HISTORY')]);
        return { squad, upcoming, recent };
    })));
}

/** The other side of a match, seen from one of my squads; `home` says whether my squad is at home. */
export function opponentIn(match: HistoryMatch, squad: MySquad) {
    const end = sideIn(match, { clubId: squad.clubId, squadId: squad.id });
    if (!end) return null;
    const home = end === 'home';
    const club = (home ? match.awayClubName : match.homeClubName) ?? null, squadName = (home ? match.awaySquadName : match.homeSquadName) ?? null;
    return {
        clubId: home ? match.awayClubId : match.homeClubId, squadId: (home ? match.awaySquadId : match.homeSquadId) ?? null,
        club, squad: squadName, name: [club, squadName].filter(Boolean).join(' '), home,
        /** My own club's name as the match gives it. */ myClub: (home ? match.homeClubName : match.awayClubName) ?? '',
    };
}
export type Opponent = NonNullable<ReturnType<typeof opponentIn>>;

/**
 * What a coach wants to know about the next opponent: their last results (the squad's own, or, when it has fewer
 * than three on record, their club's teams of the same age and gender, said so), those matches, and when we last
 * met. Another age group's results say nothing about this match and are never used.
 */
export interface Scout { form: FormResult[]; scope: 'squad' | 'age'; matches: HistoryMatch[]; lastMet: ReturnType<typeof lastMeeting> }

export async function scoutOpponent(sessionId: AuthSessionId, squad: MySquad, opponent: Opponent, max = 5): Promise<Scout> {
    let source = opponent.squadId ? await historyOf(sessionId, { squadId: opponent.squadId }, 'HISTORY') : [];
    let form = formOf(source, { clubId: null, squadId: opponent.squadId }, max), scope: Scout['scope'] = 'squad';
    if (form.length < 3 && opponent.clubId) {
        const theirs = { clubId: opponent.clubId };
        source = (await historyOf(sessionId, theirs, 'HISTORY', 40)).filter(match => {
            const end = sideIn(match, theirs), name = end ? endOf(match, end).squad ?? '' : '';
            return name.includes(squad.ageGroup) && fitsGender(name, squad.gender);
        });
        form = formOf(source, theirs, max); scope = 'age';
    }
    const shown = new Set(form.map(result => result.id));
    return { form, scope, matches: source.filter(match => shown.has(match.id)), lastMet: lastMeeting(await historyOf(sessionId, { squadId: squad.id }, 'HISTORY', 50), { clubId: squad.clubId, squadId: squad.id }, { clubId: opponent.clubId, squadId: opponent.squadId }) };
}

export interface NextUp extends SquadBoard { next: HistoryMatch | null; opponent: Opponent | null; /** Undefined when their record could not load. */ scout?: Scout }

/** Each squad in focus with its next match and what is known about the opponent. */
export function useNextOpponents(focus: SquadFocus, max = 5) {
    const { sessionId } = useAuth();
    const boards = useSquadBoards(focus);
    const ids = focus.focus.map(squad => squad.id).join(',');
    const scouted = useWorldData<NextUp[]>(boards.data ? `next-opponents:${sessionId}:${ids}:${max}` : null, () => Promise.all(boards.data!.map(async board => {
        const next = board.upcoming[0] ?? null, opponent = next ? opponentIn(next, board.squad) : null;
        const scout = opponent?.clubId ? await scoutOpponent(sessionId, board.squad, opponent, max).catch(() => undefined) : undefined;
        return { ...board, next, opponent, scout };
    })));
    return { data: scouted.data, loading: boards.loading || scouted.loading, error: boards.error || scouted.error, retry: boards.error ? boards.retry : scouted.retry };
}

/** The match exchange listings this person's club is part of, shared by the invitation and referee fields. */
export function useMyListings() {
    const { status, sessionId } = useAuth();
    const key = status === 'authenticated' ? `my-listings:${sessionId}` : null;
    return useWorldData(key, () => shared(key!, () => fetchMatchListings(new URLSearchParams({ mine: 'true' }), detached()).then(page => page.items)));
}

/** One listing in full (with the offers on it), shared for a minute. */
export const listingDetail = (sessionId: AuthSessionId, id: number) =>
    shared(`listing:${sessionId}:${id}`, () => exchangeGet<Match>(`/match-exchange/${id}`, undefined, detached()));

const ahead = (match: Match, now: number) => Date.parse(match.starts_at_iso) > now && match.event_status !== 'CANCELLED' && match.event_status !== 'COMPLETED';
/** My squad's own listing, still without an opponent. */
export const openListingOf = (match: Match, squads: MySquad[]) => squads.some(squad => squad.id === match.squad_id && squad.clubId === match.club_id) && !match.opponent_club_id;

/** 'open': my listing whose offers could not be read, so nothing is claimed about them. */
export type InvitationKind = 'reply' | 'offers' | 'waiting' | 'open';
export interface Invitation { match: Match; squad: MySquad; kind: InvitationKind; /** Offers waiting on my listing. */ offers: number; /** Starts within three days. */ soon: boolean }

/**
 * Match invitations as a waiting list: requests my squad must answer, offers on my squad's open listings, and my
 * listings still waiting for an opponent. Answering stays on the match page.
 */
export function invitationsOf(listings: Match[], details: Map<number, Match>, squads: MySquad[], now = Date.now()): Invitation[] {
    const soon = (match: Match) => Date.parse(match.starts_at_iso) - now < 72 * 3_600_000;
    return listings.filter(match => ahead(match, now)).flatMap((match): Invitation[] => {
        // A request names my squad, or only my club: then the squad of that age answers.
        const invited = !match.can_respond ? undefined : match.requested_squad_id != null ? squads.find(squad => squad.id === match.requested_squad_id)
            : squads.find(squad => squad.ageGroup === match.age_group);
        if (invited) return [{ match, squad: invited, kind: 'reply', offers: 0, soon: soon(match) }];
        if (!openListingOf(match, squads)) return [];
        const squad = squads.find(mine => mine.id === match.squad_id)!, detail = details.get(match.event_id);
        if (!detail) return [{ match, squad, kind: 'open', offers: 0, soon: soon(match) }];
        const offers = (detail.proposals ?? []).filter(proposal => proposal.status === 'PENDING').length;
        return [{ match, squad, kind: offers ? 'offers' : 'waiting', offers, soon: soon(match) }];
    }).sort((a, b) => Date.parse(a.match.starts_at_iso) - Date.parse(b.match.starts_at_iso));
}

/** The squads in focus' invitations, with the offers on their open listings counted (at most eight listings opened). */
export function useInvitations(focus: SquadFocus) {
    const { sessionId } = useAuth();
    const listings = useMyListings();
    const ids = focus.focus.map(squad => squad.id).join(',');
    const details = useWorldData(listings.data && focus.status === 'ready' ? `listing-offers:${sessionId}:${ids}` : null, async () => {
        const open = listings.data!.filter(match => ahead(match, Date.now()) && openListingOf(match, focus.focus)).slice(0, 8);
        const loaded = await Promise.allSettled(open.map(match => listingDetail(sessionId, match.event_id)));
        return new Map(loaded.flatMap(result => result.status === 'fulfilled' ? [[result.value.event_id, result.value] as const] : []));
    });
    const items = listings.data && details.data ? invitationsOf(listings.data, details.data, focus.focus) : [];
    return { items, loading: listings.loading || details.loading, error: listings.error || details.error, retry: listings.error ? listings.retry : details.retry, ready: Boolean(details.data) };
}

export interface Scouting { squad: MySquad; opponent: Opponent; before: HistoryMatch; matches: HistoryMatch[]; /** Their fixtures could not load: nothing is known, not 'none'. */ failed: boolean }

/**
 * Matches the next two opponents of each squad in focus play before they meet it, to go and watch. The
 * opponent's own squad when known, otherwise the club's teams of the same age group. Matches against my own
 * club are left out.
 */
export function useWatchList(focus: SquadFocus) {
    const { sessionId } = useAuth();
    const boards = useSquadBoards(focus);
    const ids = focus.focus.map(squad => squad.id).join(',');
    const list = useWorldData<Scouting[]>(boards.data ? `watch-list:${sessionId}:${ids}` : null, async () => {
        const wanted = boards.data!.flatMap(board => board.upcoming.slice(0, 2).flatMap(match => {
            const opponent = opponentIn(match, board.squad);
            return opponent?.clubId ? [{ squad: board.squad, opponent, before: match }] : [];
        }));
        const loaded = await Promise.allSettled(wanted.map(entry => historyOf(sessionId, entry.opponent.squadId ? { squadId: entry.opponent.squadId } : { clubId: entry.opponent.clubId }, 'UPCOMING')));
        return wanted.map((entry, index) => {
            const result = loaded[index], at = Date.parse(entry.before.startsAt ?? '');
            const matches = result.status !== 'fulfilled' ? [] : result.value.filter(match => match.id !== entry.before.id && match.startsAt && Date.parse(match.startsAt) < at
                && match.homeClubId !== entry.squad.clubId && match.awayClubId !== entry.squad.clubId
                && (entry.opponent.squadId != null || [match.homeSquadName, match.awaySquadName].some(name => name?.includes(entry.squad.ageGroup))));
            return { ...entry, matches, failed: result.status !== 'fulfilled' };
        });
    });
    return { data: list.data, loading: boards.loading || list.loading, error: boards.error || list.error, retry: boards.error ? boards.retry : list.retry };
}
