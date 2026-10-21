import { apiClient, type AuthSessionRequestConfig } from '../../api/axiosConfig';
import type { AuthSessionId } from '../../utils/authStorage';

export type ResultStatus = 'NONE' | 'PROPOSED' | 'CONFIRMED' | 'DISPUTED' | 'LEGACY' | 'RECORDED' | 'BYE';
export type MatchPeriod = 'UPCOMING' | 'NEEDS_RESULT' | 'HISTORY' | 'ALL';
export type HistorySource = 'MATCH_EXCHANGE' | 'SCHEDULE' | 'TOURNAMENT';
export type HistoryMatch = {
  id: string; source: HistorySource; sourceId: number; title: string;
  startsAt: string | null; endsAt: string | null; timezone: string | null;
  homeClubId: number | null; homeClubName: string | null; homeSquadId?: number | null; homeSquadName?: string | null;
  awayClubId: number | null; awayClubName: string | null; awaySquadId?: number | null; awaySquadName?: string | null;
  homeScore: number | null; awayScore: number | null; resultStatus: ResultStatus; fixtureStatus: string;
  legacy: boolean; locationName?: string | null; tournamentId?: number | null; tournamentName?: string | null;
  detailPath: string; canRecordResult: boolean;
};
export type MatchHistoryPage = { items: HistoryMatch[]; total: number; page: number; pageSize: number };
export type ImportOptions = { clubs: { id: number; name: string; squads: { id: number; name: string }[] }[] };
export type HistoricalMatchInput = { clubId: number; opponentClubId: number; homeSquadId?: number; awaySquadId?: number; title?: string; startsAt: string; endsAt: string; homeScore: number; awayScore: number; visibility: 'PRIVATE' | 'PUBLIC'; reason: string; requestId: string };
export type HistoricalMatchCreated = { eventId: number; detailPath: string; resultStatus: 'RECORDED'; historicalImport: true; homeScore: number; awayScore: number };
export async function getHistoricalImportOptions(signal: AbortSignal, sessionId: AuthSessionId) {
  const config: AuthSessionRequestConfig = { signal, _authSessionId: sessionId, timeout: 15000 };
  return (await apiClient.get<ImportOptions>('/match-history/import/options', config)).data;
}
export async function searchHistoricalOpponents(search: string, page: number, signal: AbortSignal, sessionId: AuthSessionId) {
  const config: AuthSessionRequestConfig = { signal, _authSessionId: sessionId, params: { search, page, size: 20 }, timeout: 15000 };
  return (await apiClient.get<{ content: { id: number; name: string; city?: string }[]; totalElements: number }>('/clubs', config)).data;
}
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
