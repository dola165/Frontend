import { getDraw, getOperations, type CompetitionRules, type DrawState } from '../../../competitions/api';
import { fetchTournamentHost } from '../../../tournaments/api';
import type { TournamentDetail, TournamentEntryDto, TournamentFixtureDto, TournamentHost, TournamentInvitationInboxItem } from '../../../tournaments/domain';
import { actualShape, plannedShape, type ActualShape, type ShapeKind } from '../../../tournaments/shape/shapeOf';
import type { AuthSessionId } from '../../../../utils/authStorage';
import { detached, forget, notifyWorldChanged, shared } from '../../cache';
import { detailOf, rulesOf, tournamentInvitations } from '../../directories/tournaments/tournamentItem';
export { organiserWork } from '../../directories/tournaments/tournamentItem';
import { loadMyTeams, sideIsMine } from '../../scoreboard/myTeams';
import { historyOfFixture, runsTournament } from '../match/matchPeekData';
import { matchCode } from '../../scoreboard/matchCode';
import type { useWorldCopy } from '../../copy';

/** Everything the tournament's pane shows, read at once so it paints once. */
export interface TournamentPaneData {
    detail: TournamentDetail; rules: CompetitionRules | null; draw: DrawState | null; shape: ActualShape | null;
    /** The organiser as World's organiser drawer knows it; null when it could not be read. */ host: TournamentHost | null;
    /** My entries: my squads', and my club's own. */ mine: Set<number>;
    /** The person runs it (admin or staff; a referee assignment is not running it). */ canManage: boolean;
    /** The person's invitation to it, still to answer. */ invitation: TournamentInvitationInboxItem | null;
}

/** Who runs a tournament, as the organiser drawer's id: the club that hosts it, else the organisation behind it. */
export const organiserOf = (detail: Pick<TournamentDetail, 'hostClubId' | 'organizerOrganizationId'>) =>
    detail.hostClubId != null ? { kind: 'CLUB' as const, id: detail.hostClubId, peek: `club.${detail.hostClubId}` } : { kind: 'ORGANIZATION' as const, id: detail.organizerOrganizationId, peek: `org.${detail.organizerOrganizationId}` };

export async function loadTournamentPane(id: number, sessionId: AuthSessionId, userId: number | null): Promise<TournamentPaneData> {
    const [detail, rules, draw, teams, invitations] = await Promise.all([
        detailOf(id), rulesOf(id),
        // A tournament from before the engine (or not drawn) has no draw state; the pane then reads its stages alone.
        shared(`tournament-draw:${id}`, () => getDraw(id, detached())).catch(() => null),
        loadMyTeams(sessionId),
        userId != null ? tournamentInvitations(sessionId).catch(() => []) : [],
    ]);
    const organiser = organiserOf(detail);
    // A ladder and Swiss rounds rank by the engine's own order, which only the tournament's operations carry.
    const ranked = rules?.structure === 'LADDER' || rules?.structure === 'SWISS';
    const [host, ranking] = await Promise.all([
        shared(`tournament-host:${organiser.kind}:${organiser.id}`, () => fetchTournamentHost(organiser.kind, organiser.id)).catch(() => null),
        ranked ? shared(`tournament-ops:${id}`, () => getOperations(id, detached())).then(state => state.standings, () => null) : null,
    ]);
    const mine = new Set(detail.entries.filter(entry => !['WITHDRAWN', 'REJECTED'].includes(entry.status) && (sideIsMine(entry, teams) || (entry.clubId != null && teams.clubIds.has(entry.clubId)))).map(entry => entry.id));
    const canManage = runsTournament(detail, userId);
    return { detail, rules, draw, shape: actualShape(detail, rules, draw, ranking), host, mine, canManage, invitation: invitations.find(item => item.tournamentId === id) ?? null };
}

export type TournamentPart = 'draw' | 'matches' | 'teams' | 'about';
/** The format's own tab, named as football names it. */
const SHAPE_TAB: Record<ShapeKind, string> = { league: 'Table', swiss: 'Table', cup: 'Bracket', groups: 'Groups', festival: 'Festival', ladder: 'Ladder' };

export const shapeKindOf = (data: Pick<TournamentPaneData, 'shape' | 'rules'>) => data.shape?.kind ?? plannedShape(data.rules)?.kind ?? null;

/** The pane's tabs after the overview: the format's own view (before the draw too), matches, teams, about. */
export function tournamentParts(data: TournamentPaneData): { id: TournamentPart; label: string }[] {
    const kind = shapeKindOf(data);
    return [...(kind ? [{ id: 'draw' as const, label: SHAPE_TAB[kind] }] : []), { id: 'matches', label: 'Matches' }, { id: 'teams', label: 'Teams' }, { id: 'about', label: 'About' }];
}

/** Entry states everyone sees; the organiser's staff and the entrant also see entries still waiting. */
const LIVE = new Set(['APPROVED', 'ACTIVE', 'COMPLETED', 'ELIMINATED']);
export const visibleEntries = (data: TournamentPaneData) => data.detail.entries.filter(entry => LIVE.has(entry.status)
    || ((data.canManage || data.mine.has(entry.id)) && (entry.status === 'PENDING' || entry.status === 'WAITLISTED')));
/** Entries that count as places taken (as the list counts them). */
export const placesTaken = (detail: TournamentDetail) => detail.entries.filter(entry => LIVE.has(entry.status)).length;

/** A side's name: its club (the squad shows beside it), else the entry's own name, else the fixture's label. */
export const sideName = (entry: TournamentEntryDto | undefined, label?: string | null) => entry?.clubName ?? entry?.displayName ?? label ?? null;
export const entryById = (detail: TournamentDetail, id: number | null) => (id == null ? undefined : detail.entries.find(entry => entry.id === id));

/** A fixture as World's score line (and its drawer): the match code and the history row every match drawer reads; the organiser's lines say a result is to add. */
export const fixtureMatch = (detail: TournamentDetail, fixture: TournamentFixtureDto, canRecordResult = false) => {
    const match = historyOfFixture(detail, fixture, canRecordResult);
    return { match, code: matchCode(match) };
};

/** Which side of a score line is mine: by its squad when it names one, by its club when my club entered as a whole. */
export function mineSideOf(data: TournamentPaneData) {
    const entries = data.detail.entries.filter(entry => data.mine.has(entry.id));
    const squads = new Set(entries.flatMap(entry => entry.squadId != null ? [entry.squadId] : []));
    const clubs = new Set(entries.flatMap(entry => entry.squadId == null && entry.clubId != null ? [entry.clubId] : []));
    return (side: { clubId: number | null; squadId: number | null }) => side.squadId != null ? squads.has(side.squadId) : side.clubId != null && clubs.has(side.clubId);
}

/** After entering, answering or withdrawing: the tournament and every list that shows it are read again, and Requests too. */
export function tournamentChanged(id: number) {
    forget(`tournament:${id}`);
    forget(`tournament-draw:${id}`);
    forget(`tournament-ops:${id}`);
    notifyWorldChanged(['tournament-invitations:', 'personal-competitions:', 'my-competitions:', 'competitions-for:']);
    window.dispatchEvent(new Event('requests-updated'));
}

/** How an entry stands, in words: in, waiting for the organiser, on the waiting list, out. */
export function entryWords(entry: Pick<TournamentEntryDto, 'status'>, team: string, t: ReturnType<typeof useWorldCopy>) {
    return entry.status === 'PENDING' ? t('{team}: waiting for the organiser', { team }) : entry.status === 'WAITLISTED' ? t('{team}: on the waiting list', { team })
        : entry.status === 'ELIMINATED' ? t('{team}: out', { team }) : t('{team} in', { team });
}

