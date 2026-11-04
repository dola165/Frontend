import { apiClient, type AuthSessionRequestConfig } from '../../api/axiosConfig';
import type { AuthSessionId } from '../../utils/authStorage';

import type { AnyScoreStatus } from '../scores/status';

/** A listing's result: the shared record's status (F4), or a historical, organiser-recorded or bye row. */
export type ResultStatus = AnyScoreStatus;
export type MatchPeriod = 'UPCOMING' | 'NEEDS_RESULT' | 'HISTORY' | 'ALL';
export type HistorySource = 'MATCH_EXCHANGE' | 'SCHEDULE' | 'TOURNAMENT';
export type HistoryMatch = {
  id: string; source: HistorySource; sourceId: number; title: string;
  startsAt: string | null; endsAt: string | null; timezone: string | null;
  homeClubId: number | null; homeClubName: string | null; homeSquadId?: number | null; homeSquadName?: string | null;
  awayClubId: number | null; awayClubName: string | null; awaySquadId?: number | null; awaySquadName?: string | null;
  homeScore: number | null; awayScore: number | null; resultStatus: ResultStatus; fixtureStatus: string;
  legacy: boolean; locationName?: string | null; /** A children's match for someone outside it: the day alone (step 3). */ timeHidden?: boolean; tournamentId?: number | null; tournamentName?: string | null;
  detailPath: string; canRecordResult: boolean;
};
export type MatchHistoryPage = { items: HistoryMatch[]; total: number; page: number; pageSize: number };
/**
 * A past match our squad played (step 6): our squad is the home side of the record, against a club in GrassKickZ or
 * one named by hand. Our score stands; a club in the app may confirm or dispute it for 48 hours.
 */
export type HistoricalMatchInput = { clubId: number; opponentClubId: number | null; outsideOpponent: string | null; homeSquadId: number; title?: string; startsAt: string; endsAt: string; homeScore: number; awayScore: number; visibility: 'PRIVATE' | 'PUBLIC'; reason?: string; requestId: string };
export type HistoricalMatchCreated = { eventId: number; detailPath: string; resultStatus: 'REPORTED'; historicalImport: true; homeScore: number; awayScore: number };
export async function importHistoricalMatch(body: HistoricalMatchInput, signal: AbortSignal, sessionId: AuthSessionId) {
  const config: AuthSessionRequestConfig = { signal, _authSessionId: sessionId, timeout: 30000 };
  return (await apiClient.post<HistoricalMatchCreated>('/match-history/import', body, config)).data;
}
export async function getMatchHistory(query: string, signal: AbortSignal, sessionId: AuthSessionId) {
  const config: AuthSessionRequestConfig = { signal, _authSessionId: sessionId, timeout: 15000 };
  return (await apiClient.get<MatchHistoryPage>(`/match-history?${query}`, config)).data;
}

export function matchHistoryPath(scope: { clubId?: number | null; squadId?: number | null; tournamentId?: number | null; period?: MatchPeriod; mine?: boolean } = {}) {
  const query = new URLSearchParams({ period: scope.period ?? 'HISTORY' });
  for (const key of ['clubId', 'squadId', 'tournamentId'] as const) if (scope[key]) query.set(key, String(scope[key]));
  if (scope.mine) query.set('mine', 'true');
  return `/match-history?${query}`;
}
