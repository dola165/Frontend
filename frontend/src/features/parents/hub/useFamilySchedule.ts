import { useEffect, useState } from 'react';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { loadSquadEvents, type CalendarSquad, type SquadCalendarEvent } from '../../squadCommunication/useSquadSchedule';

/** One child in the family's calendar: their first name (shown as the initial) and the squads they play in. */
export interface FamilyMember { playerId: number; name: string; squads: CalendarSquad[] }

/**
 * Every child's sessions and matches in one calendar, each entry marked with whose it is (`who`, `whoId`); a session two
 * siblings share shows once for each. A child whose squads fail to load is named in the error, as is one whose match or
 * event listings partly failed; the others stay in view.
 * It refreshes when the window comes back into focus.
 */
export function useFamilySchedule(members: FamilyMember[] | undefined, from: string, to: string, revision = 0) {
    const identity = JSON.stringify((members ?? []).map(m => ({ playerId: m.playerId, name: m.name, squads: m.squads.map(({ id, name, club_id }) => ({ id, name, club_id })) })));
    const key = `${identity}:${from}:${to}:${revision}`;
    const [state, setState] = useState<{ key: string; events: SquadCalendarEvent[]; error: string; loading: boolean }>({ key: '', events: [], error: '', loading: true });
    useEffect(() => {
        const wanted = JSON.parse(identity) as FamilyMember[];
        if (!wanted.length) return;
        const abort = new AbortController();
        const load = async () => {
            const settled = await Promise.allSettled(wanted.map(async member => {
                const loaded = await loadSquadEvents(member.squads, from, to, member.playerId, abort.signal);
                return { error: loaded.error, events: loaded.events.map(event => ({ ...event, id: `${member.playerId}:${event.id}`, who: member.name, whoId: member.playerId })) };
            }));
            if (abort.signal.aborted) return;
            const failed = wanted.filter((_, index) => settled[index].status === 'rejected');
            const failure = settled.find((r): r is PromiseRejectedResult => r.status === 'rejected');
            const partly = settled.flatMap((r, index) => r.status === 'fulfilled' && r.value.error ? [`${wanted[index].name}: ${r.value.error}`] : []);
            setState({ key, events: settled.flatMap(r => r.status === 'fulfilled' ? r.value.events : []), loading: false,
                error: [failed.length ? `${failed.map(m => m.name).join(', ')}: ${extractApiErrorMessage(failure?.reason, 'the schedule could not load.')}` : '', ...partly].filter(Boolean).join(' ') });
        };
        void load();
        const refresh = () => { if (!document.hidden) void load(); };
        window.addEventListener('focus', refresh);
        return () => { abort.abort(); window.removeEventListener('focus', refresh); };
    }, [identity, from, to, key]);
    if (!members?.length) return { events: [] as SquadCalendarEvent[], error: '', loading: false };
    return state.key === key ? state : { events: [] as SquadCalendarEvent[], error: '', loading: true };
}
