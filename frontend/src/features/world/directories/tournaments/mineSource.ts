import { browsePersonalCompetitions } from '../../../competitions/api';
import { fetchMyTournamentInvitations } from '../../../tournaments/api';
import type { AuthSessionId } from '../../../../utils/authStorage';
import { shared } from '../../cache';
import type { ResultGroup } from '../../directory/groups';
import type { DirectorySource } from '../../directory/types';
import { loadMyTeams } from '../../scoreboard/myTeams';
import { TournamentRow } from './TournamentRow';
import { fromInvitation, fromSummary, rulesOf, withPart, type TournamentItem } from './tournamentItem';
import { tournamentLine, tournamentPlace } from './tournamentLines';

type Lane = 'waiting' | 'playing' | 'running' | 'refereeing' | 'finished';
export type MyTournament = TournamentItem & { lane: Lane };

const LANES: Record<Lane, ResultGroup> = {
    waiting: { key: 'waiting', label: 'Waiting for you', rank: 0 },
    playing: { key: 'playing', label: 'Playing in', rank: 1 },
    running: { key: 'running', label: 'Running', rank: 2 },
    refereeing: { key: 'refereeing', label: 'Refereeing', rank: 3 },
    finished: { key: 'finished', label: 'Finished', rank: 4 },
};
const PAGE = 12;

/** Invitations still to answer, shared for a minute by the list and its tab's count. */
const pendingInvitations = (sessionId: AuthSessionId) => shared(`tournament-invitations:${sessionId}`, () => fetchMyTournamentInvitations(0, 20))
    .then(page => page.content.filter(item => item.status === 'PENDING'));

/**
 * My tournaments: what waits for me (invitations to answer), the ones my squads play in, the ones I run or referee,
 * and the finished ones. The tab counts what waits, in amber.
 */
export const myTournaments: DirectorySource<MyTournament> = {
    id: 'mine',
    label: 'My tournaments',
    noun: ['tournament', 'tournaments'],
    searchLabel: 'Search my tournaments',
    searchPlaceholder: 'Search tournaments you run or play in',
    layout: 'rows',
    pageSize: PAGE,
    personal: true,
    filters: [],
    count: async ({ sessionId, authenticated }) => {
        if (!authenticated) return null;
        const waiting = (await pendingInvitations(sessionId)).length;
        return waiting ? { count: waiting, tone: 'warning', label: 'need you' } : null;
    },
    async load(query, page, { sessionId, userId }) {
        const text = query.q.trim().toLowerCase();
        const [personal, invitations, teams] = await Promise.all([
            browsePersonalCompetitions({ page, size: PAGE, search: query.q || undefined }),
            page === 0 ? pendingInvitations(sessionId) : [],
            loadMyTeams(sessionId),
        ]);
        const asked = invitations.filter(item => !text || [item.tournamentName, item.squadName, item.clubName].some(value => (value ?? '').toLowerCase().includes(text)));
        const invited = new Set(asked.map(item => item.tournamentId));
        // An invitation names little more than the tournament: its detail adds the organiser, places and entry window.
        const waiting = await Promise.all(asked.map(async item => ({ ...(await withPart(fromInvitation(item, await rulesOf(item.tournamentId)), userId, teams)), lane: 'waiting' as const })));
        const rest = await Promise.all(personal.content.filter(item => !invited.has(item.id)).map(async summary => {
            const item = fromSummary(summary, await rulesOf(summary.id));
            if (summary.status === 'COMPLETED' || summary.status === 'CANCELLED') return { ...(await withPart(item, userId, teams)), lane: 'finished' as const };
            const part = await withPart(item, userId, teams);
            return { ...part, lane: part.role ?? ('playing' as const) };
        }));
        // An invited tournament the list also brings (my club is in it already) is listed once, as waiting.
        const twice = personal.content.length - rest.length;
        return { items: [...waiting, ...rest], total: personal.totalElements + waiting.length - twice, hasMore: page + 1 < personal.totalPages };
    },
    key: item => `${item.lane === 'waiting' ? 'i' : 't'}${item.id}`,
    Item: TournamentRow,
    line: tournamentLine,
    groups: { of: item => LANES[item.lane] },
    placeKinds: ['TOURNAMENT'],
    place: tournamentPlace,
    empty: { title: 'No tournaments yet', body: 'Tournaments you run, or that your club or squads enter, appear here.' },
};
