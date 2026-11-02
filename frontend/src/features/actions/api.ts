import { apiClient } from '../../api/axiosConfig';
import type { ScoreTarget } from '../scores/api';

/**
 * A finished match waiting on the person's score (`GET /me/results-waiting`), newest first: one to report, one whose
 * reported score their side confirms or disputes, a dispute they settle, or a dispute waiting on someone else.
 */
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
    action?: 'REPORT' | 'CONFIRM' | 'SETTLE' | 'DISPUTED';
    /** The side that confirms or disputes (CONFIRM), with the reported score and the record's revision for one tap. */
    answerAs?: 'HOME' | 'AWAY' | null; reported?: { home: number; away: number } | null; disputed?: { home: number; away: number } | null;
    revision?: number | null; disputeUntil?: string | null;
}

export const fetchResultsWaiting = async (signal?: AbortSignal) =>
    (await apiClient.get<ResultWaiting[]>('/me/results-waiting', { signal })).data ?? [];

/** The score card a waiting match opens. */
export const scoreTargetOf = (result: Pick<ResultWaiting, 'kind' | 'id'>): ScoreTarget =>
    ({ kind: result.kind === 'MATCH_EXCHANGE' ? 'EXCHANGE' : 'CALENDAR', eventId: result.id });
