import { apiClient, type AuthSessionRequestConfig } from '../../../api/axiosConfig';
import { getAuthSessionId, type AuthSessionId } from '../../../utils/authStorage';
import type { OperationRecord } from '../api';

export interface RegistrationItem {
  id: number; kind: 'REGISTRATION' | 'CREDENTIAL'; title: string; status: string; revision: number; previousId: number | null;
  eligibility: { state: string; reasons: string[]; expiresOn: string | null; credentialIds: number[]; supersededBy: number | null };
  canReplace: boolean; canOpen: boolean; requirements: string; requirementsSource: string;
  history: { id: number; action: string; status: string | null; note: string | null; actor: string; at: string }[];
}
export interface RegistrationProfile {
  clubId: number; personId: number; squadId: number | null; asOf: string; currentPlayer: boolean; staff: boolean;
  canCreate: boolean; records: RegistrationItem[]; affiliations: { id: number; status: string; joinedOn: string; endedOn: string | null }[]; departurePath: string | null;
}
export const registrationRoot = (club: number) => `/clubs/${club}/registration`;
export interface RegistrationScope { clubId: number; clubName: string; squadId: number | null; squadName: string | null }
export const loadRegistrationScopes = async (person: number, signal: AbortSignal, session: AuthSessionId) => {
  const config: AuthSessionRequestConfig = { signal, _authSessionId: session };
  return (await apiClient.get<RegistrationScope[]>(`/registration/people/${person}/scopes`, config)).data;
};
export const loadRegistration = async (club: number, person: number, squad: number | null, signal: AbortSignal, session = getAuthSessionId()) => {
  const config: AuthSessionRequestConfig = { params: squad ? { squad } : undefined, signal, _authSessionId: session };
  return (await apiClient.get<RegistrationProfile>(`${registrationRoot(club)}/people/${person}`, config)).data;
};
export interface RegistrationDecision { requestId: string; revision: number; status: string; note: string }
export const decideRegistration = async (club: number, id: number, command: RegistrationDecision, session: AuthSessionId) => {
  const config: AuthSessionRequestConfig = { _authSessionId: session };
  return (await apiClient.post<Pick<OperationRecord, 'id' | 'revision' | 'status'>>(`${registrationRoot(club)}/records/${id}/decision`, command, config)).data;
};

export const eligibilityLabel = (state: string) => ({ RECORDED_CURRENT: 'Recorded evidence current', UNKNOWN: 'Eligibility unknown',
  NOT_CURRENT: 'Earlier club or squad relationship', REVIEW_REQUIRED: 'Review needed', EXPIRED: 'Expired', SUPERSEDED: 'Replaced by a later record' })[state] ?? 'Eligibility unknown';
