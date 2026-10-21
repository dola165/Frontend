import { browsePersonalCompetitions } from '../../../competitions/api';
import type { ResultGroup } from '../../directory/groups';
import type { DirectorySource } from '../../directory/types';
import { loadMyTeams } from '../../scoreboard/myTeams';
import { TournamentRow } from './TournamentRow';
import { fromInvitation, fromSummary, rulesOf, tournamentInvitations, withPart, type TournamentItem } from './tournamentItem';
import { tournamentLine, tournamentPlace } from './tournamentLines';

type Lane = 'waiting' | 'playing' | 'running' | 'refereeing' | 'organisation' | 'finished';
export type MyTournament = TournamentItem & { lane: Lane };

const LANES: Record<Lane, ResultGroup> = {
    waiting: { key: 'waiting', label: 'Waiting for you', rank: 0 },
    playing: { key: 'playing', label: 'Playing in', rank: 1 },
    running: { key: 'running', label: 'Running', rank: 2 },
    refereeing: { key: 'refereeing', label: 'Refereeing', rank: 3 },
    // Seen through my organisation only: neither my team nor my staff role is in it.
    organisation: { key: 'organisation', label: 'Your organisation', rank: 4 },
    finished: { key: 'finished', label: 'Finished', rank: 5 },
};
const PAGE = 12;


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
    pageSize: PAGE,
    personal: true,
    filters: [],
    count: async ({ sessionId, authenticated }) => {
        if (!authenticated) return null;
        const waiting = (await tournamentInvitations(sessionId)).length;
        return waiting ? { count: waiting, tone: 'warning', label: 'need you' } : null;
    },
    async load(query, page, { sessionId, userId }) {
        const text = query.q.trim().toLowerCase();
        const [personal, invitations, teams] = await Promise.all([
            browsePersonalCompetitions({ page, size: PAGE, search: query.q || undefined }),
            // Every page: an invited tournament is listed once, as waiting, whichever page brings it again.
            tournamentInvitations(sessionId),
            loadMyTeams(sessionId),
        ]);
        const asked = invitations.filter(item => !text || [item.tournamentName, item.squadName, item.clubName].some(value => (value ?? '').toLowerCase().includes(text)));
        const invited = new Set(asked.map(item => item.tournamentId));
        // An invitation names little more than the tournament: its detail adds the organiser, places and entry window.
        const waiting = page > 0 ? [] : await Promise.all(asked.map(async item => ({ ...(await withPart(fromInvitation(item, await rulesOf(item.tournamentId)), userId, teams)), lane: 'waiting' as const })));
        const rest = await Promise.all(personal.content.filter(item => !invited.has(item.id)).map(async summary => {
            const item = fromSummary(summary, await rulesOf(summary.id));
            if (summary.status === 'COMPLETED' || summary.status === 'CANCELLED') return { ...(await withPart(item, userId, teams)), lane: 'finished' as const };
            const part = await withPart(item, userId, teams);
            // A tournament I run with work waiting is waiting for me; its row says what, and its pane leads to it.
            return { ...part, lane: part.work?.length ? 'waiting' as const : part.role ?? (part.mine?.length === 0 ? 'organisation' as const : 'playing' as const) };
        }));
        // An invited tournament the list also brings (my club is in it already) is listed once, as waiting.
        const twice = personal.content.length - rest.length;
        // The count is the first page's; later pages keep it.
        return { items: [...waiting, ...rest], total: page === 0 ? personal.totalElements + asked.length - twice : null, hasMore: page + 1 < personal.totalPages };
    },
    key: item => `${item.lane === 'waiting' ? 'i' : 't'}${item.id}`,
    Item: TournamentRow,
    line: tournamentLine,
    groups: { of: item => LANES[item.lane] },
    placeKinds: ['TOURNAMENT'],
    place: tournamentPlace,
    empty: { title: 'No tournaments yet', body: 'Tournaments you run, or that your club or squads enter, appear here.' },
};
