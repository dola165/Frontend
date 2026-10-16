import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../../../api/axiosConfig';
import * as squadApi from '../../squadCommunication/api';
import { get, type Bootstrap, type OperationRecord } from '../../clubOperations/api';
import { canReadSquad } from '../../clubOperations/squadAccess';
import type { ScheduleEventOccurrence, ScheduleEventType } from '../../schedule/api';
import { eventSquadId } from '../fixtures';
import type { SquadRosterGroup } from '../../../components/squads/SquadRosterTable';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { translate } from '../../../locales/useCopy';
import { coachHubEn, fixtureCopyEn } from '../../../locales/workspaceDesign';

const DAY = 86_400_000;

/** "updates couldn't load" as a sentence on its own. */
export const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** The three things read for a squad, each on its own: one failing never empties the others. */
export type CoachPart = 'overview' | 'sessions' | 'updates';

/**
 * One of my squads as its squad space sees it: coaches, families, sessions and matches with replies, and recent updates.
 * `failed` names the parts that could not be read: an empty list there means "not loaded", never "none".
 */
export interface CoachSquad { id: number; overview: squadApi.SquadOverview | null; sessions: squadApi.SquadSession[]; updates: squadApi.SquadMessage[]; failed: CoachPart[]; error: string }

/** Reads one squad's parts independently; on a retry, a part that fails again keeps what it had. */
async function loadSquad(id: number, signal: AbortSignal, previous?: CoachSquad): Promise<CoachSquad> {
    const window = { from: new Date(Date.now() - 7 * DAY).toISOString(), to: new Date(Date.now() + 28 * DAY).toISOString() };
    const [overview, sessions, updates] = await Promise.allSettled([squadApi.overview(id, signal), squadApi.sessions(id, signal, window), squadApi.messages(id, 'ANNOUNCEMENT', null, signal)]);
    const failed: CoachPart[] = [];
    const take = <T,>(part: CoachPart, result: PromiseSettledResult<T>, fallback: T) => { if (result.status === 'fulfilled') return result.value; failed.push(part); return fallback; };
    const squad = { id, overview: take('overview', overview, previous?.overview ?? null), sessions: take('sessions', sessions, previous?.sessions ?? []), updates: take('updates', updates, previous?.updates ?? []) };
    const reason = [overview, sessions, updates].find(result => result.status === 'rejected') as PromiseRejectedResult | undefined;
    return { ...squad, failed, error: reason ? extractApiErrorMessage(reason.reason, 'Part of this squad could not be loaded.') : '' };
}

/** Every squad I coach, read from the squad spaces coaches and families share (the last week and the next four), with a retry per squad. */
export function useCoachSquads(squadIds: number[], revision: number) {
    const key = `${squadIds.join(',')}:${revision}`;
    const [state, setState] = useState<{ key: string; squads: CoachSquad[] } | null>(null);
    const [retrying, setRetrying] = useState<number[]>([]);
    useEffect(() => {
        const controller = new AbortController(), ids = key.split(':')[0].split(',').filter(Boolean).map(Number);
        void Promise.all(ids.map(id => loadSquad(id, controller.signal)))
            .then(squads => { if (!controller.signal.aborted) setState({ key, squads }); });
        return () => controller.abort();
    }, [key]);
    const squads = state?.key === key ? state.squads : null;
    const retry = useCallback((id: number) => {
        const previous = squads?.find(squad => squad.id === id);
        if (!previous) return;
        setRetrying(list => [...list, id]);
        void loadSquad(id, new AbortController().signal, previous).then(fresh => {
            setState(current => current?.key === key ? { key, squads: current.squads.map(squad => squad.id === id ? fresh : squad) } : current);
            setRetrying(list => list.filter(item => item !== id));
        });
    }, [key, squads]);
    return { squads, retry, retrying };
}

const SOURCES = [
    { module: 'AVAILABILITY', query: 'state=open' },
    { module: 'GUARDIANS', query: 'kind=CONSENT&state=open' },
    { module: 'DEVELOPMENT', query: 'state=open' },
    { module: 'STAFF', query: 'state=open' },
] as const;

/** Open records about my squads (restrictions, consents, development, staff duties) where I may read them, and the work assigned to me. */
export function useCoachRecords(club: number, squads: number[], boot: Bootstrap | null, revision: number) {
    const spec = JSON.stringify(SOURCES.flatMap(source => squads.filter(squad => canReadSquad(boot, source.module, squad)).map(squad => `module=${source.module}&squad=${squad}&${source.query}`)));
    const [attempt, setAttempt] = useState(0);
    const key = `${club}:${spec}:${revision}:${attempt}`;
    const [state, setState] = useState<{ key: string; rows: OperationRecord[]; mine: OperationRecord[]; error: string } | null>(null);
    useEffect(() => {
        const controller = new AbortController(), queries = JSON.parse(spec) as string[];
        const work = (query: string) => get<OperationRecord[]>(`/clubs/${club}/workspace-roles/work?${query}`, controller.signal);
        // Each list on its own: the lists that answered are shown, and one failure is reported rather than emptying them all.
        void Promise.allSettled([...queries.map(work), work('module=HOME&mine=true')]).then(results => {
            if (controller.signal.aborted) return;
            const lists = results.map(result => result.status === 'fulfilled' ? result.value : []);
            const mine = lists.pop() ?? [];
            const rows = lists.flat().filter((row, index, all) => all.findIndex(other => other.id === row.id) === index);
            const failure = results.find(result => result.status === 'rejected') as PromiseRejectedResult | undefined;
            setState({ key, rows, mine, error: failure ? extractApiErrorMessage(failure.reason, 'Some of your players’ records could not be loaded.') : '' });
        });
        return () => controller.abort();
    }, [club, spec, key]);
    // While a retry runs, what was already loaded stays in view.
    const current = state?.key === key ? state : state?.key.startsWith(`${club}:${spec}:${revision}:`) ? state : null;
    const retry = useCallback(() => setAttempt(value => value + 1), []);
    return { rows: current?.rows ?? [], mine: current?.mine ?? [], loading: !current, retrying: Boolean(current && current.key !== key), error: current?.key === key ? current.error : '', retry };
}

/** What kind of activity a squad session is, for its symbol: a friendly is a match with a handshake. */
export function sessionKind(session: squadApi.SquadSession): ScheduleEventType {
    const type = session.event_type ?? 'TRAINING';
    return type === 'MATCH' && /friendly/i.test(session.description ?? '') ? 'FRIENDLY' : type;
}
/** Each activity's name in the person's language, read when it is shown. */
export const kindNames = Object.defineProperties({} as Record<ScheduleEventType, string>,
    Object.fromEntries((['TRAINING', 'MATCH', 'FRIENDLY', 'ACTIVITY', 'TRYOUT'] as const).map(type => [type, { enumerable: true, get: () => translate('fixtureCopy', fixtureCopyEn, type) }])));

/**
 * Who's coming. Matches ask families to reply, so a missing reply needs chasing; training is opt-out,
 * so everyone is expected unless their family said they can't come.
 */
export function replies(session: squadApi.SquadSession) {
    const players = session.attendance.filter(player => player.active !== false);
    const count = (response: string) => players.filter(player => player.response === response).length;
    const asked = Boolean(session.response_requested), going = count('GOING'), cant = count('NOT_GOING'), unsure = count('UNSURE'), none = count('UNANSWERED');
    const tr = (key: keyof typeof coachHubEn, count: number) => translate('coachHub', coachHubEn, key, { count });
    const parts = asked ? [tr('repliesComing', going), cant ? tr('repliesCant', cant) : '', unsure ? tr('repliesUnsure', unsure) : '', none ? tr('needNoReply', none) : '']
        : [cant ? tr('repliesCant', cant) : translate('coachHub', coachHubEn, 'repliesEveryone'), unsure ? tr('repliesUnsure', unsure) : ''];
    return { asked, going, cant, unsure, none, players, text: parts.filter(Boolean).join(' · ') };
}

/** Upcoming sessions of one squad, soonest first. */
export const upcoming = (squad: CoachSquad, now: number) => squad.sessions
    .filter(session => session.status === 'SCHEDULED' && new Date(session.ends_at || session.starts_at).getTime() >= now)
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

const crests = new Map<number, Promise<string | null>>();
/** Club crests by club id, from each club's public summary, fetched once per club. */
export function useCrests(ids: number[]) {
    const key = [...new Set(ids)].sort((a, b) => a - b).join(',');
    const [found, setFound] = useState<Map<number, string | null>>(() => new Map());
    useEffect(() => {
        let alive = true;
        const list = key ? key.split(',').map(Number) : [];
        void Promise.all(list.map(id => {
            if (!crests.has(id)) crests.set(id, apiClient.get<{ logoUrl?: string | null }>(`/clubs/${id}`).then(response => response.data.logoUrl ?? null).catch(() => null));
            return crests.get(id)!.then(url => [id, url] as const);
        })).then(entries => { if (alive) setFound(new Map(entries)); });
        return () => { alive = false; };
    }, [key]);
    return found;
}

/** The other club in a match, from the club calendar entry at the same time for the same squad (or from the title when the calendar has none). */
export function opponentOf(session: squadApi.SquadSession, squad: number, events: ScheduleEventOccurrence[], clubName: string): { id: number | null; name: string } | null {
    if (sessionKind(session) === 'TRAINING') return null;
    const start = new Date(session.starts_at).getTime();
    const event = events.find(item => item.opponentClubName && eventSquadId(item) === squad && Math.abs(new Date(item.startsAt).getTime() - start) < 60_000);
    if (event?.opponentClubName) return { id: event.opponentClubId, name: event.opponentClubName };
    const sides = session.title.split(/\s+vs\.?\s+/i);
    const other = sides.length === 2 ? sides.find(side => side.trim() !== clubName) : null;
    return other ? { id: null, name: other.trim() } : null;
}

/** "in 40 min", "in 14 h", "in 3 days", or "now" once it has started. */
export function startsIn(start: number, now: number) {
    const minutes = Math.round((start - now) / 60_000);
    if (minutes <= 0) return 'now';
    if (minutes < 60) return `in ${minutes} min`;
    if (minutes < 24 * 60) return `in ${Math.round(minutes / 60)} h`;
    const days = Math.round(minutes / (24 * 60));
    return `in ${days} ${days === 1 ? 'day' : 'days'}`;
}

export interface SquadRoster { id: number; groups: SquadRosterGroup[] | null; error: string }
/** Each squad's players, grouped by position with shirt numbers, ages and photos, from the club's squad roster. */
export function useSquadRosters(club: number, squadIds: number[], revision: number) {
    const key = `${club}|${squadIds.join(',')}|${revision}`;
    const [state, setState] = useState<{ key: string; rosters: SquadRoster[] } | null>(null);
    useEffect(() => {
        const controller = new AbortController(), [clubId, ids] = key.split('|');
        void Promise.all(ids.split(',').filter(Boolean).map(Number).map(async (id): Promise<SquadRoster> => {
            try { return { id, groups: (await apiClient.get<SquadRosterGroup[]>(`/clubs/${clubId}/squads/${id}/roster`, { signal: controller.signal })).data, error: '' }; }
            catch (error) { return { id, groups: null, error: extractApiErrorMessage(error, 'This squad’s players could not be loaded.') }; }
        })).then(rosters => { if (!controller.signal.aborted) setState({ key, rosters }); });
        return () => controller.abort();
    }, [key]);
    return state?.key === key ? state.rosters : null;
}
