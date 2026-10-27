import { apiClient } from '../../api/axiosConfig';
import type { ScoreTarget } from '../scores/api';

/** A finished match of the person's squads that still has no score (`GET /me/results-waiting`), newest first. */
export interface ResultWaiting {
    kind: 'MATCH_EXCHANGE' | 'SCHEDULE_EVENT';
    id: number;
    title: string;
    startsAt: string;
    squadId: number | null;
    squadName: string | null;
    opponentName: string | null;
    /** The side to report for: the person's squad (HOME or AWAY), or REFEREE. */
    reportAs?: 'HOME' | 'AWAY' | 'REFEREE' | null;
}

export const fetchResultsWaiting = async (signal?: AbortSignal) =>
    (await apiClient.get<ResultWaiting[]>('/me/results-waiting', { signal })).data ?? [];

/** The score card a waiting match opens. */
export const scoreTargetOf = (result: Pick<ResultWaiting, 'kind' | 'id'>): ScoreTarget =>
    ({ kind: result.kind === 'MATCH_EXCHANGE' ? 'EXCHANGE' : 'CALENDAR', eventId: result.id });
