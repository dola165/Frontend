import { apiClient, type AuthSessionRequestConfig } from '../../api/axiosConfig';
import type { AuthSessionId } from '../../utils/authStorage';

/**
 * A match score as a shared reported record (product model F4): one report stands, the other side confirms or
 * disputes with its own score, the organiser or referee settles, and an undisputed report is final after 48 hours.
 * A calendar match with one GrassKickZ side is final at once and its club may correct it for 48 hours.
 * Contract: backend `api-spec/openapi.yaml` (MatchResultState, MatchResultSummary) and `docs/MATCH_RESULT_AUTHORITY.md`.
 */
export type ScoreStatus = 'NONE' | 'REPORTED' | 'CONFIRMED' | 'DISPUTED' | 'SETTLED' | 'FINAL';
/** Who acts: a club, the lead referee, or the competition's organiser. */
export type ScoreParty = 'HOME' | 'AWAY' | 'REFEREE' | 'ORGANISER';
export type ScoreSide = 'HOME' | 'AWAY' | 'REFEREE';
/** A Match Exchange match, or a match on a club's own calendar: the same record under its own address. */
export type ScoreKind = 'EXCHANGE' | 'CALENDAR';
export type ScoreTarget = { kind: ScoreKind; eventId: number };
export type Goals = { home: number; away: number };
export type ScoreVersion = { homeScore: number | null; awayScore: number | null; side: ScoreParty; at: string };
export type ScoreSettlement = { choice: 'REPORTED' | 'DISPUTED' | 'CORRECTED'; homeScore: number; awayScore: number; side: 'REFEREE' | 'ORGANISER'; at: string };
export type ScoreHistory = {
  id: number; action: 'IMPORTED' | 'PROPOSE' | 'CONFIRM' | 'DISPUTE' | 'CORRECT' | 'REPORT' | 'SETTLE' | 'FINALIZE';
  actorId: number | null; actorName: string | null; side: ScoreParty | null;
  homeScore: number; awayScore: number; previousHomeScore: number | null; previousAwayScore: number | null;
  previousStatus: string | null; status: string; reason: string | null; createdAt: string; revision: number;
};
/** The full record, for the two clubs' staff, the referee and accepted officials. `homeScore`/`awayScore` are the official score only. */
export type ScoreRecord = {
  eventId: number; kind: ScoreKind; status: ScoreStatus; fixtureStatus: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED'; revision: number;
  homeScore: number | null; awayScore: number | null; official: boolean; legacy: boolean;
  /** Nobody on GrassKickZ can answer (an internal match, or an opponent not on the app): final at once, correctable for 48 h. */
  oneSided: boolean;
  reported: ScoreVersion | null; disputed: ScoreVersion | null; settled: ScoreSettlement | null;
  responders: ScoreSide[]; confirmations: ScoreSide[];
  /** Null while disputed means nobody can settle (a friendly without a referee): both versions stay showing. */
  settler: 'REFEREE' | 'ORGANISER' | null;
  deadlines: { refereeOnlyUntil: string | null; disputeUntil: string | null; correctUntil: string | null };
  /** The parties the reader holds, and under which each action is open now: the buttons follow these. */
  permissions: { parties: ScoreSide[]; report: ScoreSide[]; respond: ('HOME' | 'AWAY')[]; settle: ('REFEREE' | 'ORGANISER')[]; correct: ('HOME' | 'AWAY')[] };
  history: ScoreHistory[];
};
/** What any permitted viewer may see: no identities, reasons or history. `scorePrivate` is an under-11 match the viewer is not part of. */
export type ScoreSummary = {
  eventId: number; kind: ScoreKind; oneSided: boolean; status: ScoreStatus; fixtureStatus: string; revision: number;
  homeScore: number | null; awayScore: number | null; reported: Goals | null; disputed: Goals | null;
  official: boolean; legacy: boolean; scorePrivate: boolean; canReadAudit: boolean;
};

type Stamp = { revision: number; requestId: string };
export type ScoreWrite =
  | { action: 'report'; body: Stamp & { homeScore: number; awayScore: number; side: ScoreSide; note?: string } }
  | { action: 'confirm'; body: Stamp & { side: 'HOME' | 'AWAY' } }
  | { action: 'dispute'; body: Stamp & { homeScore: number; awayScore: number; side: 'HOME' | 'AWAY'; note?: string } }
  | { action: 'settle'; body: Stamp & { settlement: ScoreSettlement['choice']; homeScore?: number; awayScore?: number; side: 'REFEREE' | 'ORGANISER'; reason: string } }
  | { action: 'correct'; body: Stamp & { homeScore: number; awayScore: number; side: 'HOME' | 'AWAY'; reason: string } };

const base = ({ kind, eventId }: ScoreTarget) => kind === 'CALENDAR' ? `/schedule/events/${eventId}/result` : `/match-exchange/${eventId}/result`;

export async function getScoreRecord(target: ScoreTarget, signal: AbortSignal, sessionId: AuthSessionId) {
  const config: AuthSessionRequestConfig = { signal, _authSessionId: sessionId, timeout: 15000 };
  return (await apiClient.get<ScoreRecord>(base(target), config)).data;
}
export async function getScoreSummary(target: ScoreTarget, signal: AbortSignal, sessionId: AuthSessionId) {
  const config: AuthSessionRequestConfig = { signal, _authSessionId: sessionId, timeout: 15000 };
  return (await apiClient.get<ScoreSummary>(`${base(target)}/summary`, config)).data;
}
/** Report, confirm, dispute, settle or correct; every one answers with the record as it now stands. */
export async function writeScore(target: ScoreTarget, { action, body }: ScoreWrite, signal: AbortSignal, sessionId: AuthSessionId) {
  const config: AuthSessionRequestConfig = { signal, _authSessionId: sessionId, timeout: 30000 };
  return (await apiClient.post<ScoreRecord>(action === 'report' ? base(target) : `${base(target)}/${action}`, body, config)).data;
}
