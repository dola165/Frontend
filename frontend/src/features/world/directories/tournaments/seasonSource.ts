import { browseCompetitions, browsePersonalCompetitions, type CompetitionCard } from '../../../competitions/api';
import { fetchTournamentOverview } from '../../../tournaments/api';
import type { TournamentSummary } from '../../../tournaments/domain';
import { shared } from '../../cache';
import type { ResultGroup } from '../../directory/groups';
import type { DirectorySource, LoadContext } from '../../directory/types';
import { isoDay, isoDayOf } from '../../format';
import { loadMyTeams, NO_TEAMS } from '../../scoreboard/myTeams';
import { competitionTimestamp as zoned } from '../../../competitions/competitionTime';
import { TournamentRow } from './TournamentRow';
import { WaitingLine } from './WaitingLine';
import { detailOf, fromCard, fromInvitation, fromSummary, rulesOf, tournamentInvitations, withPart, type TournamentItem } from './tournamentItem';
import { nearParams, tournamentLine, tournamentPlace } from './tournamentLines';

type Lane = 'yours' | 'spotlight' | 'now' | 'open' | 'coming';
export type SeasonItem = TournamentItem & { lane: Lane };

const LANES: Record<Lane, ResultGroup> = {
    yours: { key: 'yours', label: 'Yours', rank: 0 },
    spotlight: { key: 'spotlight', label: 'In the spotlight', rank: 1 },
    now: { key: 'now', label: 'On now', rank: 2 },
    open: { key: 'open', label: 'Open for entries', rank: 3 },
    coming: { key: 'coming', label: 'Coming up', rank: 4 },
};
/** Each list reads at most this many; a season near one place has fewer. */
const SIZE = '24';
/** The most of my tournaments whose detail is read (to say which of my squads is in and whether I run it). */
const DETAILED = 8;

const live = (status: string) => status === 'PLANNING' || status === 'ACTIVE';

/**
 * The season in one list: mine first (my squads' entries and the tournaments I run, with invitations to answer), then
 * what is on now, what takes entries (my squads' ages first) and what is coming up, near the World area. A guest first
 * sees the overview's spotlight. Each tournament is listed once, in its first group.
 */
async function loadSeason({ signal, sessionId, authenticated, area, userId }: LoadContext): Promise<SeasonItem[]> {
    const near = nearParams(new URLSearchParams({ page: '0', size: SIZE }), area);
    const cards = (extra: Record<string, string>) => {
        const params = new URLSearchParams(near);
        for (const [key, value] of Object.entries(extra)) params.set(key, value);
        return browseCompetitions(params, signal).then(page => page.content);
    };
    const [active, open, planning, personal, invitations, spotlight, teams] = await Promise.all([
        cards({ status: 'ACTIVE' }), cards({ registration: 'OPEN' }), cards({ status: 'PLANNING' }),
        // The lists are the season; mine, my invitations and the spotlight add to it, and a failure there leaves them out.
        authenticated ? shared(`personal-competitions:${sessionId}`, () => browsePersonalCompetitions({ page: 0, size: 20 })).then(page => page.content).catch((): TournamentSummary[] => []) : [] as TournamentSummary[],
        authenticated ? tournamentInvitations(sessionId).catch(() => []) : [],
        authenticated ? [] as TournamentSummary[] : fetchTournamentOverview(signal).then(overview => overview.highlights).catch((): TournamentSummary[] => []),
        authenticated ? loadMyTeams(sessionId) : NO_TEAMS,
    ]);
    const card = new Map<number, CompetitionCard>([...active, ...open, ...planning].map(item => [item.id, item]));
    const summary = new Map(personal.map(item => [item.id, item]));
    const invited = new Map(invitations.map(item => [item.tournamentId, item]));
    // A list card has the format and places, a summary the entry window: a tournament of mine takes both where it can.
    const itemOf = async (id: number, fallback?: TournamentSummary): Promise<TournamentItem> => {
        const known = card.get(id), about = summary.get(id) ?? fallback;
        const base = known ? fromCard(known) : about ? fromSummary(about, await rulesOf(id)) : fromInvitation(invited.get(id)!, await rulesOf(id));
        return { ...base, ...(about ? { opensAt: zoned(about.registrationOpensAt, base.rules?.timezone), closesAt: zoned(about.registrationClosesAt, base.rules?.timezone) } : {}), invitation: invited.get(id) };
    };
    const yourIds = [...new Set([...invitations.map(item => item.tournamentId), ...personal.filter(item => live(item.status)).map(item => item.id)])];
    const yours = await Promise.all(yourIds.map(async (id, index) => {
        const item = await itemOf(id);
        return { ...(index < DETAILED ? await withPart(item, userId, teams) : item), lane: 'yours' as const };
    }));
    const seen = new Set(yourIds);
    const fresh = <T extends { id: number }>(list: T[]) => list.filter(item => !seen.has(item.id) && Boolean(seen.add(item.id)));
    const highlighted = await Promise.all(fresh(spotlight).map(async item => ({ ...(await itemOf(item.id, item)), lane: 'spotlight' as const })));
    const fits = (item: CompetitionCard) => (teams.ages.has(item.profile?.rules?.ageGroup ?? '') ? 0 : 1);
    const today = isoDay();
    // A list card does not say how entries are taken: the detail (the pane's own, cached) does, so an invitation-only
    // tournament is never called open for entries.
    const openItems = await Promise.all(fresh([...open].sort((a, b) => fits(a) - fits(b))).map(async item => {
        const detail = await detailOf(item.id).catch(() => null);
        return detail?.registrationPolicy === 'INVITE_ONLY' ? { ...fromCard(item), inviteOnly: true, lane: 'coming' as const } : { ...fromCard(item, 'OPEN'), lane: 'open' as const };
    }));
    return [
        ...yours, ...highlighted,
        ...fresh(active).map(item => ({ ...fromCard(item), lane: 'now' as const })),
        ...openItems,
        ...fresh(planning.filter(item => !item.endDate || isoDayOf(zoned(item.endDate)!) >= today)).map(item => ({ ...fromCard(item), lane: 'coming' as const })),
    ];
}

const matches = (item: TournamentItem, text: string) => !text || [item.name, item.organizer, item.rules?.city].some(value => (value ?? '').toLowerCase().includes(text));

/** This season (the default list): mine, on now, open for entries, coming up. */
export const season: DirectorySource<SeasonItem> = {
    id: 'season',
    label: 'This season',
    noun: ['tournament', 'tournaments'],
    searchLabel: 'Search this season',
    searchPlaceholder: 'Search tournaments on now and coming up',
    pageSize: 48,
    // Mine wherever they are; the rest near the World area.
    area: 'partly',
    filters: [],
    async load(query, _page, context) {
        const text = query.q.trim().toLowerCase();
        const items = (await loadSeason(context)).filter(item => matches(item, text));
        return { items, total: items.length, hasMore: false };
    },
    key: item => String(item.id),
    Item: TournamentRow,
    line: tournamentLine,
    groups: { of: item => LANES[item.lane] },
    // What waits for me (invitations, work in the tournaments I run) sits above the season, never as a second list.
    Tools: WaitingLine,
    placeKinds: ['TOURNAMENT'],
    place: tournamentPlace,
    empty: { title: 'Nothing on this season yet', body: 'Leagues, cups and festivals near you appear here when organisers publish them.' },
};
