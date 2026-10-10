import { useEffect, useState } from 'react';
import { apiClient } from '../../../api/axiosConfig';
import { useAuth } from '../../../context/AuthContext';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { fetchClubSchedule, type ScheduleEventOccurrence } from '../../schedule/api';
import { localDateTime } from '../../schedule/board/scheduleRange';
import * as squadApi from '../../squadCommunication/api';
import type { TrainingSession } from '../trainingCalendar';
import type { PublicSquad } from '../publicJourney';

interface Timetable { squadId: number; squadName: string; canView: boolean; sessions: TrainingSession[] }
export interface ClubTraining extends TrainingSession { squadId: number; squadName: string }

interface State { key: string; events: ScheduleEventOccurrence[]; training: ClubTraining[]; squads: PublicSquad[]; privateSquads: string[]; mySquads: number[]; error: string }

/**
 * The club schedule: the club calendar plus every squad's training timetable, read through the
 * same access-controlled endpoints as the squad pages. Squads that keep their timetable private stay out.
 */
export function useClubSchedule(clubId: number, from: Date, to: Date) {
    const { status, sessionId } = useAuth();
    const [attempt, setAttempt] = useState(0);
    const fromTime = from.getTime(), toTime = to.getTime();
    const key = `${clubId}:${fromTime}:${toTime}:${sessionId}:${attempt}`;
    const [state, setState] = useState<State | null>(null);
    useEffect(() => {
        const controller = new AbortController();
        const signal = controller.signal;
        const start = new Date(fromTime), end = new Date(toTime);
        void (async () => {
            const [events, squads, spaces] = await Promise.allSettled([
                fetchClubSchedule(clubId, localDateTime(start), localDateTime(end), signal),
                apiClient.get<PublicSquad[]>(`/clubs/${clubId}/squads`, { signal }).then(r => r.data),
                status === 'authenticated' ? squadApi.spaces(signal) : Promise.resolve([]),
            ]);
            const list = squads.status === 'fulfilled' ? squads.value : [];
            const timetables = await Promise.allSettled(list.map(squad => apiClient.get<Timetable>(`/clubs/${clubId}/squads/${squad.id}/training-schedule`, { signal }).then(r => r.data)));
            if (signal.aborted) return;
            const readable = timetables.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
            const training = readable.filter(t => t.canView).flatMap(t => t.sessions.map(session => ({ ...session, squadId: t.squadId, squadName: t.squadName })))
                .filter(session => Date.parse(session.endsAt) >= fromTime && Date.parse(session.startsAt) < toTime);
            setState({
                key, training, squads: list,
                events: events.status === 'fulfilled' ? events.value : [],
                privateSquads: readable.filter(t => !t.canView).map(t => t.squadName),
                mySquads: spaces.status === 'fulfilled' ? spaces.value.filter(space => space.club_id === clubId).map(space => space.id) : [],
                error: events.status === 'rejected' ? extractApiErrorMessage(events.reason, 'The club calendar couldn’t load.')
                    : timetables.some(result => result.status === 'rejected') || squads.status === 'rejected' ? 'Some squad timetables couldn’t load. Matches and club events are shown.' : '',
            });
        })();
        return () => controller.abort();
    }, [clubId, fromTime, toTime, key, status]);
    const current = state?.key === key ? state : null;
    const empty: Omit<State, 'key'> = { events: [], training: [], squads: [], privateSquads: [], mySquads: [], error: '' };
    return { ...(current ?? empty), loading: !current, retry: () => setAttempt(value => value + 1) };
}
