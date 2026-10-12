import { useAuth } from '../../../../context/AuthContext';
import { browseCompetitions, browsePersonalCompetitions, getCompetitionProfile, type CompetitionCard, type CompetitionRules } from '../../../competitions/api';
import { fetchGroupStandings, fetchMyTournamentInvitations, fetchTournament } from '../../../tournaments/api';
import type { TournamentDetail, TournamentEntryDto, TournamentFixtureDto, TournamentInvitationInboxItem, TournamentStageDto } from '../../../tournaments/domain';
import { searchTryouts, type TryoutPosting } from '../../../tryouts/api';
import { useWorldData } from '../../useWorldData';
import type { WorldRole } from '../roles';
import { shared } from '../../cache';
import { historyOf } from './coachMatches';
import { fitsGender, type MySquad, type SquadFocus } from './mySquads';
import { orderForRole } from './relevance';
import { cupPath, nextFixture, tableRows, type CupStep, type TableRow } from '../../scoreboard/standings';

const LIVE = new Set(['ACTIVE', 'PLANNING']);
const TABLES = new Set(['LEAGUE', 'ROUND_ROBIN', 'GROUP']);

/** A competition my squads play in, read the way the coach wants it: the table, the cup run, or the festival date. */
export interface MyCompetition {
    detail: TournamentDetail; rules: CompetitionRules | null; entries: TournamentEntryDto[]; squads: MySquad[];
    view: { kind: 'table'; stage: TournamentStageDto; rows: TableRow[] } | { kind: 'cup'; steps: CupStep[]; eliminated: boolean } | { kind: 'festival' };
    next: TournamentFixtureDto | null;
}

/** Which entries are mine: an entry for a squad in focus, or (the whole club in focus) any entry of my club without a squad. */
export const entriesOf = (detail: TournamentDetail, squads: MySquad[], wholeClub: number[] = []) =>
    detail.entries.filter(entry => entry.status !== 'WITHDRAWN' && entry.status !== 'REJECTED'
        && (squads.some(squad => squad.id === entry.squadId) || (entry.squadId == null && entry.clubId != null && wholeClub.includes(entry.clubId))));

/** How to show a competition: a knockout run once my entry has a knockout fixture, a table where there are standings, otherwise a festival date. */
export function viewOf(detail: TournamentDetail, rules: CompetitionRules | null, mine: Set<number>) {
    const played = (stage: TournamentStageDto) => detail.fixtures.some(fixture => fixture.stageId === stage.id && (mine.has(fixture.homeEntryId ?? -1) || mine.has(fixture.awayEntryId ?? -1)));
    const knockout = detail.stages.find(stage => stage.stageType === 'KNOCKOUT' && played(stage));
    if (knockout) return { kind: 'cup' as const, stage: knockout };
    const table = rules?.standings === false || rules?.family === 'FESTIVAL' ? undefined : detail.stages.find(stage => TABLES.has(stage.stageType) && played(stage)) ?? detail.stages.find(stage => TABLES.has(stage.stageType));
    return table ? { kind: 'table' as const, stage: table } : { kind: 'festival' as const };
}

/** The competitions (being played or about to start) that the squads in focus are entered in, at most six. */
export function useMyCompetitions(focus: SquadFocus) {
    const { sessionId } = useAuth();
    const ids = focus.focus.map(squad => squad.id).join(',');
    // A director looking at the whole club also follows entries the club made without naming a squad.
    const wholeClub = focus.scope === 'club' && focus.focus.length === focus.squads.length ? focus.clubIds : [];
    return useWorldData<MyCompetition[]>(focus.status === 'ready' ? `my-competitions:${sessionId}:${ids}` : null, async () => {
        const page = await shared(`personal-competitions:${sessionId}`, () => browsePersonalCompetitions({ page: 0, size: 20 }));
        const candidates = page.content.filter(summary => LIVE.has(summary.status)).slice(0, 8);
        const loaded = await Promise.allSettled(candidates.map(async summary => {
            const detail = await shared(`tournament:${summary.id}`, () => fetchTournament(summary.id));
            const entries = entriesOf(detail, focus.focus, wholeClub);
            if (!entries.length) return null;
            const rules = (await getCompetitionProfile(summary.id).catch(() => null))?.rules ?? null;
            const mine = new Set(entries.map(entry => entry.id)), how = viewOf(detail, rules, mine);
            const squads = focus.focus.filter(squad => entries.some(entry => entry.squadId === squad.id));
            const view: MyCompetition['view'] = how.kind === 'cup' ? { kind: 'cup', ...cupPath(detail.fixtures.filter(fixture => fixture.stageId === how.stage.id), mine) }
                : how.kind === 'table' ? { kind: 'table', stage: how.stage, rows: tableRows(await fetchGroupStandings(summary.id, how.stage.id), mine) }
                : { kind: 'festival' };
            return { detail, rules, entries, squads, view, next: nextFixture(detail.fixtures, mine) };
        }));
        return loaded.flatMap(result => result.status === 'fulfilled' && result.value ? [result.value] : []).slice(0, 6);
    });
}

/** Recorded results in the competitions my squads play, newest first, ten per competition. */
export function useCompetitionResults(focus: SquadFocus) {
    const { sessionId } = useAuth();
    const competitions = useMyCompetitions(focus);
    const ids = (competitions.data ?? []).map(item => item.detail.id).join(',');
    const results = useWorldData(competitions.data ? `competition-results:${sessionId}:${ids}` : null, () => Promise.all((competitions.data ?? []).map(async item => ({
        competition: item, matches: await historyOf(sessionId, { tournamentId: item.detail.id }, 'HISTORY', 10).catch(() => []),
    }))));
    return { data: results.data, loading: competitions.loading || results.loading, error: competitions.error || results.error, retry: competitions.error ? competitions.retry : results.retry };
}

export interface OpenCompetition { card: CompetitionCard; squads: MySquad[] }

/**
 * Competitions taking entries for the ages in focus that admit my squads' gender, without those the club is
 * already part of; pending invitations for my squads; and how many competitions are open in all.
 */
export function useCompetitionsForYou(focus: SquadFocus) {
    const { sessionId } = useAuth();
    const key = focus.status === 'ready' ? `competitions-for:${sessionId}:${focus.focus.map(squad => squad.id).join(',')}` : null;
    return useWorldData(key, async signal => {
        const [open, total, personal, invitations] = await Promise.all([
            Promise.all(focus.ages.map(age => browseCompetitions(new URLSearchParams({ registration: 'OPEN', ageGroup: age, page: '0', size: '12' }), signal).then(page => page.content))),
            browseCompetitions(new URLSearchParams({ registration: 'OPEN', page: '0', size: '1' }), signal).then(page => page.totalElements),
            shared(`personal-competitions:${sessionId}`, () => browsePersonalCompetitions({ page: 0, size: 20 })),
            fetchMyTournamentInvitations(0, 20).then(page => page.content).catch(() => [] as TournamentInvitationInboxItem[]),
        ]);
        const involved = new Set(personal.content.map(summary => summary.id));
        const seen = new Set<number>();
        const items: OpenCompetition[] = open.flat().flatMap(card => {
            if (seen.has(card.id) || involved.has(card.id)) return [];
            seen.add(card.id);
            const rules = card.profile?.rules;
            const squads = focus.focus.filter(squad => (!rules || rules.ageGroup === squad.ageGroup) && fitsGender(rules?.eligibilityCategory, squad.gender));
            return squads.length ? [{ card, squads }] : [];
        });
        // Invitations for my squads in focus, by the invited squad's id, and those to my club as a whole (it names the squad when answering).
        const ids = new Set(focus.focus.map(squad => squad.id));
        return { items, total, invitations: invitations.filter(invitation => invitation.squadId != null ? ids.has(invitation.squadId) : invitation.clubId != null && focus.clubIds.includes(invitation.clubId)) };
    });
}

/** Other clubs' open trials for the ages and genders in focus, ordered for the role (keepers first for a goalkeeper coach). */
export function trialsFor(trials: TryoutPosting[], squads: MySquad[], clubIds: number[], role: WorldRole) {
    const fits = trials.filter(trial => !clubIds.includes(trial.clubId) && squads.some(squad => trial.ageGroup === squad.ageGroup
        && (!trial.gender || !squad.gender || squad.gender === 'MIXED' || trial.gender === squad.gender)));
    return orderForRole(fits, role, trial => [trial.title, trial.position].filter(Boolean).join(' '));
}

export function useAgeTrials(focus: SquadFocus, role: WorldRole) {
    const data = useWorldData(focus.status === 'ready' ? 'age-trials' : null, signal => searchTryouts({ status: 'OPEN', page: 0, size: 50 }, signal));
    return { ...data, items: data.data ? trialsFor(data.data.items, focus.focus, focus.clubIds, role) : [] };
}
