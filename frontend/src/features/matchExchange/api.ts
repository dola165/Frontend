import { apiClient, type AuthSessionRequestConfig } from "../../api/axiosConfig";
import { isAxiosError } from "axios";
import type { AuthSessionId } from "../../utils/authStorage";
export const formats: Record<string, string> = {
  "5_A_SIDE": "5-a-side",
  "7_A_SIDE": "7-a-side",
  "9_A_SIDE": "9-a-side",
  "11_A_SIDE": "11-a-side",
  FUTSAL: "Futsal",
  OTHER: "Other",
};
export const levels = ["DEVELOPMENT", "RECREATIONAL", "COMPETITIVE", "ELITE"];
export const ages = [
  "U6",
  "U7",
  "U8",
  "U9",
  "U10",
  "U11",
  "U12",
  "U13",
  "U14",
  "U15",
  "U16",
  "U17",
  "U18",
  "U19",
  "U21",
  "SENIOR",
  "VETERANS",
];
export type Squad = {
  id: number;
  club_id: number;
  name: string;
  category: string;
  club_name: string;
};
export type Appointment = {
  id: number;
  event_id: number;
  referee_id: number;
  full_name?: string;
  duty: string;
  status: string;
  volunteer: boolean;
  fee: number | null;
  currency: string | null;
  report: string | null;
  report_submitted_at: string | null;
  title: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  event_status: string;
  starts_at_iso: string;
  ends_at_iso: string;
  club_name: string;
  opponent_name: string | null;
  location_name: string;
  invited_by_name?: string;
  venue_status?: string;
  allowed_actions?: string[];
  acceptance_blocker?: string | null;
  action_explanation?: string | null;
  attendance_issue?: string | null;
  attendance_issue_at?: string | null;
  inbox_section?: "CURRENT" | "HISTORY";
};
export type Proposal = {
  id: number;
  squad_id: number;
  squad_name: string;
  club_name: string;
  club_id: number;
  note: string;
  status: string;
};
export type Match = {
  requested_club_id?: number | null;
  requested_squad_id?: number | null;
  external_referee_name?: string | null;
  referee_responsibility?: string;
  hosting_choice?: string;
  can_respond?: boolean;
  can_arrange_official?: boolean;
  home_score: number | null;
  away_score: number | null;
  result_status?: "PROPOSED" | "CONFIRMED" | "DISPUTED" | null;
  result_legacy?: boolean;
  event_id: number;
  squad_id: number;
  squad_name: string;
  club_id: number;
  club_name: string;
  club_profile_kind: string | null;
  club_logo_url: string | null;
  club_banner_url: string | null;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string;
  starts_at_iso: string;
  ends_at_iso: string;
  timezone: string;
  city: string;
  location_name: string;
  location_lat: number | null;
  location_lng: number | null;
  age_group: string;
  level: string;
  format: string;
  venue_preference: string;
  referee_required: boolean;
  venue_id: number | null;
  booking_id: number | null;
  booking?: { id: number; venue_id: number; status: string; stored_status: string; starts_at: string; ends_at: string };
  external_venue_confirmed: boolean;
  revision: number;
  listing_status: string;
  event_status: string;
  venue_status: string;
  referee_status: string;
  opponent_name: string | null;
  opponent_club_id: number | null;
  opponent_squad_name: string | null;
  target_squad_id: number | null;
  head_coach_id: number | null;
  coach_name: string | null;
  can_manage?: boolean;
  can_arrange?: boolean;
  can_record_result?: boolean;
  proposals?: Proposal[];
  appointments?: Appointment[];
  own_appointments?: Appointment[];
  history?: { id: number; action: string; created_at: string; reason: string | null }[];
};
export type Career = {
  id: number;
  kind: string;
  title: string;
  organization: string;
  starts_on: string;
  ends_on: string | null;
  description: string;
};
export type Referee = {
  user_id: number;
  full_name: string;
  published: boolean;
  biography: string;
  qualifications: string;
  formats: string;
  languages: string;
  service_area: string;
  travel_km: number;
  accepts_paid: boolean;
  accepts_volunteer: boolean;
  fee: number;
  currency: string;
  timezone: string;
  revision: number;
  career?: Career[];
  match_history?: {
    id: number;
    title: string;
    starts_at: string;
    timezone: string;
    duty: string;
    volunteer: boolean;
    club_name: string;
    opponent_name: string;
  }[];
};
export type RefereeHub = {
  profileAccess?: { canManage: boolean; reason: string };
  profile: Referee | null;
  availability: { id: number; starts_at: string; ends_at: string }[];
  appointments: Appointment[];
  appointmentCounts?: { current: number; history: number; total: number; returnedHistory: number };
};
export type OfficialOffer = { id: number; eventId: number; status: string; outcomeReason?: string | null; canWithdraw: boolean; appointmentId?: number | null; appointmentPath?: string | null; createdAt: string; resolvedAt?: string | null; originalTermsKnown: boolean; originalTerms: { volunteer: boolean; fee?: number | null; currency?: string | null; title: string; startsAt: string; endsAt: string; timezone: string; city: string; locationName: string; format: string } | null; changedTerms?: { volunteer: boolean; fee?: number | null; currency?: string | null; title: string; startsAt: string; endsAt: string; timezone: string; city: string; locationName: string; format: string } | null };
export type RefereePageResult<T> = { items: T[]; total: number; page: number; pageSize: number };
export type OfficialCoordinationMessage = { id: number; authorId: number; authorName: string; body: string; createdAt: string };
export type OfficialCoordination = {
  eventId: number; status: string; readOnly: boolean;
  participants: { userId: number; fullName: string; role: "STAFF" | "OFFICIAL"; squadId?: number; squadName?: string; duty?: string }[];
  messages: OfficialCoordinationMessage[]; page: number; size: number; totalElements: number; totalPages: number; hasMore: boolean;
};
export type ResultSide = "HOME" | "AWAY" | "REFEREE";
export type MatchResultHistory = {
  id: number;
  action: string;
  actor_id: number | null;
  actor_side: ResultSide | null;
  home_score: number | null;
  away_score: number | null;
  previous_home_score: number | null;
  previous_away_score: number | null;
  previous_status: string | null;
  status: string;
  reason: string | null;
  created_at: string;
  revision: number;
};
export type MatchResultState = {
  eventId: number;
  fixtureStatus?: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  status: "NONE" | "PROPOSED" | "CONFIRMED" | "DISPUTED";
  revision: number;
  homeScore: number | null;
  awayScore: number | null;
  proposalSide: ResultSide | null;
  requiredConfirmations: ResultSide[];
  confirmations: ResultSide[];
  legacy: boolean;
  authority: {
    roles: ResultSide[];
    canPropose: boolean;
    canCorrect: boolean;
    canDispute: boolean;
    confirmableRoles: ResultSide[];
    correctableRoles: ResultSide[];
  };
  history: MatchResultHistory[];
};
export type ResultWrite = { side: ResultSide; revision: number; requestId: string };
export type ResultScoreWrite = ResultWrite & { homeScore: number; awayScore: number };
export type ResultReasonWrite = ResultWrite & { reason: string };
export type PublicMatchResult = {
  eventId: number; status: MatchResultState['status']; fixtureStatus: string; revision: number;
  homeScore: number | null; awayScore: number | null; official: boolean; legacy: boolean; canReadAudit: boolean;
};
export type ResultSuggestion = {
  id: number; homeScore: number; awayScore: number; note: string | null; evidenceUrl: string | null;
  status: 'PENDING' | 'ADOPTED' | 'DISMISSED'; revision: number; createdAt: string; reviewedAt: string | null;
  adoptedResultRevision: number | null;
  reviewReason?: string | null;
};
export type ResultSuggestions = {
  eventId: number; resultRevision: number; canSuggest: boolean; canReview: boolean;
  reviewableRoles: ResultSide[]; adoptableRoles: ResultSide[];
  ownSuggestions: ResultSuggestion[]; suggestions: ResultSuggestion[]; pendingCount: number; page: number; hasMore: boolean;
  reviewedSuggestions?: ResultSuggestion[]; hasMoreReviewed?: boolean;
};
export type SuggestionWrite = { homeScore: number; awayScore: number; note?: string; evidenceUrl?: string; revision: number; requestId: string };
export type SuggestionReview = { action: 'ADOPT' | 'DISMISS'; side: ResultSide; revision: number; suggestionRevision: number; requestId: string; reason: string };
export async function getPublicMatchResult(eventId: number, signal: AbortSignal, sessionId: AuthSessionId) {
  const config: AuthSessionRequestConfig = { signal, _authSessionId: sessionId, timeout: 15000 };
  return (await apiClient.get<PublicMatchResult>(`/match-exchange/${eventId}/result/summary`, config)).data;
}
export async function getResultSuggestions(eventId: number, page: number, signal: AbortSignal, sessionId: AuthSessionId) {
  const config: AuthSessionRequestConfig = { signal, params: { page }, _authSessionId: sessionId, timeout: 15000 };
  return (await apiClient.get<ResultSuggestions>(`/match-exchange/${eventId}/result/suggestions`, config)).data;
}
export async function suggestMatchResult(eventId: number, body: SuggestionWrite, signal: AbortSignal, sessionId: AuthSessionId) {
  const config: AuthSessionRequestConfig = { signal, _authSessionId: sessionId, timeout: 30000 };
  return (await apiClient.post<ResultSuggestions>(`/match-exchange/${eventId}/result/suggestions`, body, config)).data;
}
export async function reviewResultSuggestion(eventId: number, suggestionId: number, body: SuggestionReview, signal: AbortSignal, sessionId: AuthSessionId) {
  const config: AuthSessionRequestConfig = { signal, _authSessionId: sessionId, timeout: 30000 };
  return (await apiClient.post<ResultSuggestions>(`/match-exchange/${eventId}/result/suggestions/${suggestionId}/review`, body, config)).data;
}
export async function get<T>(
  path: string,
  params?: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  return (await apiClient.get(path, { params, signal, timeout: 15000 })).data;
}
export async function post(path: string, data: unknown = {}, impactToken?: string) {
  return (await apiClient.post(path, data, { timeout: 30000, headers: impactToken ? { "X-Match-Impact-Token": impactToken } : {} })).data;
}
export async function getOfficialCoordination(eventId: number, page: number, signal: AbortSignal, sessionId: AuthSessionId) {
  const config: AuthSessionRequestConfig = { params: { page, size: 30 }, signal, _authSessionId: sessionId };
  return (await apiClient.get<OfficialCoordination>(`/match-exchange/${eventId}/coordination`, config)).data;
}
export async function getMatchResult(eventId: number, signal: AbortSignal, sessionId: AuthSessionId) {
  const config: AuthSessionRequestConfig = { signal, _authSessionId: sessionId };
  return (await apiClient.get<MatchResultState>(`/match-exchange/${eventId}/result`, config)).data;
}
export async function writeMatchResult(eventId: number, action: "propose" | "confirm" | "dispute" | "correct", body: ResultWrite | ResultScoreWrite | ResultReasonWrite, signal: AbortSignal, sessionId: AuthSessionId) {
  const config: AuthSessionRequestConfig = { signal, _authSessionId: sessionId };
  const path = `/match-exchange/${eventId}/result${action === "propose" ? "" : `/${action}`}`;
  return (await apiClient.post<MatchResultState>(path, body, config)).data;
}
export async function sendOfficialCoordination(eventId: number, body: string, requestId: string, signal: AbortSignal, sessionId: AuthSessionId) {
  const config: AuthSessionRequestConfig = { signal, _authSessionId: sessionId };
  return (await apiClient.post<OfficialCoordinationMessage>(`/match-exchange/${eventId}/coordination`, { body, requestId }, config)).data;
}
export async function withdrawOfficialOffer(offerId: number, signal: AbortSignal, sessionId: AuthSessionId) {
  const config: AuthSessionRequestConfig = { signal, _authSessionId: sessionId };
  return (await apiClient.post(`/referees/me/offers/${offerId}/withdraw`, {}, config)).data;
}
export async function put(path: string, data: unknown, impactToken?: string) {
  return (await apiClient.put(path, data, { timeout: 30000, headers: impactToken ? { "X-Match-Impact-Token": impactToken } : {} })).data;
}
export type ChangeImpact = {
  action: "REVISE" | "CANCEL";
  revision: number;
  material: boolean;
  changedFields: string[];
  dependencies: { domain: string; id: number | null; state: string; consequence: string }[];
  needsAttention: { code: string; id: number | null; message: string; blocking?: boolean }[];
  confirmationRequired: boolean;
  confirmationToken: string;
};
export function changeImpactFrom(error: unknown): ChangeImpact | undefined {
  if (isAxiosError(error) && error.response?.data?.code === "MATCH_CHANGE_NEEDS_ATTENTION")
    return error.response.data.impact;
}
export function hasBlockingAttention(impact: ChangeImpact) {
  return impact.needsAttention.some(item => item.blocking !== false);
}
export async function remove(path: string) {
  await apiClient.delete(path);
}
export function label(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (v) => v.toUpperCase());
}
export function when(value: string) {
  return new Date(value).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
