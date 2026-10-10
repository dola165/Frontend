import { useEffect, useState } from 'react';
import * as squadApi from '../../squadCommunication/api';
import { get, type Bootstrap, type OperationRecord } from '../../clubOperations/api';
import { canReadSquad } from '../../clubOperations/squadAccess';
import type { ScheduleEventType } from '../../schedule/api';
import { extractApiErrorMessage } from '../../../utils/apiError';

const DAY = 86_400_000;

/** One of my squads as its squad space sees it: coaches, families, sessions and matches with replies, and recent updates. */
export interface CoachSquad { id: number; overview: squadApi.SquadOverview | null; sessions: squadApi.SquadSession[]; updates: squadApi.SquadMessage[]; error: string }

/** Every squad I coach, read from the squad spaces coaches and families share (the last week and the next four). */
export function useCoachSquads(squadIds: number[], revision: number) {
    const key = `${squadIds.join(',')}:${revision}`;
    const [state, setState] = useState<{ key: string; squads: CoachSquad[] } | null>(null);
    useEffect(() => {
        const controller = new AbortController(), ids = key.split(':')[0].split(',').filter(Boolean).map(Number);
        const window = { from: new Date(Date.now() - 7 * DAY).toISOString(), to: new Date(Date.now() + 28 * DAY).toISOString() };
        void Promise.all(ids.map(async (id): Promise<CoachSquad> => {
            try {
                const [overview, sessions, updates] = await Promise.all([squadApi.overview(id, controller.signal), squadApi.sessions(id, controller.signal, window), squadApi.messages(id, 'ANNOUNCEMENT', null, controller.signal)]);
                return { id, overview, sessions, updates, error: '' };
            } catch (error) {
                return { id, overview: null, sessions: [], updates: [], error: extractApiErrorMessage(error, 'This squad could not be loaded.') };
            }
        })).then(squads => { if (!controller.signal.aborted) setState({ key, squads }); });
        return () => controller.abort();
    }, [key]);
    return state?.key === key ? state.squads : null;
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
    const key = `${club}:${spec}:${revision}`;
    const [state, setState] = useState<{ key: string; rows: OperationRecord[]; mine: OperationRecord[]; error: string } | null>(null);
    useEffect(() => {
        const controller = new AbortController(), queries = JSON.parse(spec) as string[];
        const work = (query: string) => get<OperationRecord[]>(`/clubs/${club}/workspace-roles/work?${query}`, controller.signal);
        void Promise.all([Promise.all(queries.map(work)), work('module=HOME&mine=true')])
            .then(([lists, mine]) => {
                if (controller.signal.aborted) return;
                const rows = lists.flat().filter((row, index, all) => all.findIndex(other => other.id === row.id) === index);
                setState({ key, rows, mine, error: '' });
            })
            .catch(error => { if (!controller.signal.aborted) setState({ key, rows: [], mine: [], error: extractApiErrorMessage(error, 'Could not load your players’ records.') }); });
        return () => controller.abort();
    }, [club, spec, key]);
    const current = state?.key === key ? state : null;
    return { rows: current?.rows ?? [], mine: current?.mine ?? [], loading: !current, error: current?.error ?? '' };
}

/** What kind of activity a squad session is, for its symbol: a friendly is a match with a handshake. */
export function sessionKind(session: squadApi.SquadSession): ScheduleEventType {
    const type = session.event_type ?? 'TRAINING';
    return type === 'MATCH' && /friendly/i.test(session.description ?? '') ? 'FRIENDLY' : type;
}
export const kindNames: Record<ScheduleEventType, string> = { TRAINING: 'Training', MATCH: 'Match', FRIENDLY: 'Friendly', ACTIVITY: 'Club event', TRYOUT: 'Trial' };

/**
 * Who's coming. Matches ask families to reply, so a missing reply needs chasing; training is opt-out,
 * so everyone is expected unless their family said they can't come.
 */
export function replies(session: squadApi.SquadSession) {
    const players = session.attendance.filter(player => player.active !== false);
    const count = (response: string) => players.filter(player => player.response === response).length;
    const asked = Boolean(session.response_requested), going = count('GOING'), cant = count('NOT_GOING'), unsure = count('UNSURE'), none = count('UNANSWERED');
    const parts = asked ? [`${going} coming`, cant ? `${cant} can't come` : '', unsure ? `${unsure} unsure` : '', none ? `${none} no reply` : '']
        : [cant ? `${cant} can't come` : 'Everyone expected', unsure ? `${unsure} unsure` : ''];
    return { asked, going, cant, unsure, none, players, text: parts.filter(Boolean).join(' · ') };
}

/** Upcoming sessions of one squad, soonest first. */
export const upcoming = (squad: CoachSquad, now: number) => squad.sessions
    .filter(session => session.status === 'SCHEDULED' && new Date(session.ends_at || session.starts_at).getTime() >= now)
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
