import { apiClient, type AuthSessionRequestConfig } from '../../api/axiosConfig';
import type { AuthSessionId } from '../../utils/authStorage';
import type { LifecycleDates, LifecycleDateCommand, AdmissionCase, AdmissionHome, AdmissionInquiry, InquiryInput, InquiryCommand, AdmissionInvitation, AdmissionWorkspace, CaseCommand, ClaimInvitationInput, DiscoveryQuery, GroupInput, GroupSchedule, GuardianReviewInput, OfflineInvitationInput, Opportunity, OpportunityPage, Participant, PlayerCardInput, Submission } from './types';
export const ADMISSIONS_CONTRACT_VERSION = '1.3.0';
export { JOINING_CONTRACT_REVISION, fetchPlayerIdentity, savePlayerIdentity, uploadPlayerPhoto, fetchClubJoiningOptions, submitClubEnquiry, createPlayerLinkCode, previewPlayerLinkCode, redeemPlayerLinkCode } from '../joining-contract/api';
const config = (sessionId: AuthSessionId, signal?: AbortSignal): AuthSessionRequestConfig => ({ _authSessionId: sessionId, signal });
export const searchOpportunities = (params: DiscoveryQuery, signal?: AbortSignal) => apiClient.get<OpportunityPage>('/admissions/opportunities', { params, signal }).then(r => r.data);
export const fetchOpportunity = (id: number, signal?: AbortSignal) => apiClient.get<Opportunity>(`/admissions/opportunities/${id}`, { signal }).then(r => r.data);
export const fetchAdmissionHome = (sessionId: AuthSessionId, signal?: AbortSignal) => apiClient.get<AdmissionHome>('/admissions/home', config(sessionId, signal)).then(r => r.data);
export const fetchAdmissionCase = (id: number, sessionId: AuthSessionId, signal?: AbortSignal) => apiClient.get<AdmissionCase>(`/admissions/cases/${id}`, config(sessionId, signal)).then(r => r.data);
export const submitAdmission = (body: Submission, sessionId: AuthSessionId, signal?: AbortSignal) => apiClient.post<AdmissionCase>('/admissions/cases', body, config(sessionId, signal)).then(r => r.data);
export const commandAdmission = (id: number, body: CaseCommand, sessionId: AuthSessionId, signal?: AbortSignal) => apiClient.post<AdmissionCase>(`/admissions/cases/${id}/commands`, body, config(sessionId, signal)).then(r => r.data);
export const fetchClubAdmissions = (clubId: number, sessionId: AuthSessionId, signal?: AbortSignal) => apiClient.get<AdmissionWorkspace>(`/clubs/${clubId}/admissions`, config(sessionId, signal)).then(r => r.data);
export const fetchOrganizationAdmissions = (id: number, sessionId: AuthSessionId, signal?: AbortSignal) => apiClient.get<AdmissionWorkspace>(`/organizations/${id}/admissions`, config(sessionId, signal)).then(r => r.data);
export const createAdmissionGroup = (organizationId: number, body: GroupInput, sessionId: AuthSessionId, signal?: AbortSignal) => apiClient.post<Opportunity>(`/organizations/${organizationId}/admissions/groups`, body, config(sessionId, signal)).then(r => r.data);
export const updateAdmissionGroup = (organizationId: number, id: number, body: GroupInput, sessionId: AuthSessionId, signal?: AbortSignal) => apiClient.put<Opportunity>(`/organizations/${organizationId}/admissions/groups/${id}`, body, config(sessionId, signal)).then(r => r.data);
export const newAdmissionRequestId = () => crypto.randomUUID();
export const updateAdmissionPlayerCard = (playerId: number, body: PlayerCardInput, sessionId: AuthSessionId, signal?: AbortSignal) => apiClient.put<Participant>(`/admissions/players/${playerId}`, body, config(sessionId, signal)).then(r => r.data);
export const createAdmissionInvitation = (organizationId: number, body: OfflineInvitationInput, sessionId: AuthSessionId, signal?: AbortSignal) => apiClient.post<AdmissionInvitation>(`/organizations/${organizationId}/admissions/invitations`, body, config(sessionId, signal)).then(r => r.data);
export const claimAdmissionInvitation = (id: number, body: ClaimInvitationInput, sessionId: AuthSessionId, signal?: AbortSignal) => apiClient.post<AdmissionCase | null>(`/admissions/invitations/${id}/respond`, body, config(sessionId, signal)).then(r => r.data);
export const reportAdmissionGuardianReview = (playerId: number, body: GuardianReviewInput, sessionId: AuthSessionId, signal?: AbortSignal) => apiClient.post<void>(`/admissions/players/${playerId}/guardian-review`, body, config(sessionId, signal)).then(r => r.data);
export const fetchAdmissionGroupSchedule = (id: number, playerId: number, sessionId: AuthSessionId, signal?: AbortSignal) => apiClient.get<GroupSchedule>(`/admissions/groups/${id}/schedule`, { ...config(sessionId, signal), params: { playerId } }).then(r => r.data);

export const submitAdmissionInquiry = (organizationId: number, body: InquiryInput, sessionId: AuthSessionId, signal?: AbortSignal) => apiClient.post<AdmissionInquiry>(`/organizations/${organizationId}/admissions/inquiries`, body, config(sessionId, signal)).then(r => r.data);
export const fetchAdmissionInquiry = (id: number, sessionId: AuthSessionId, signal?: AbortSignal) => apiClient.get<AdmissionInquiry>(`/admissions/inquiries/${id}`, config(sessionId, signal)).then(r => r.data);
export const commandAdmissionInquiry = (id: number, body: InquiryCommand, sessionId: AuthSessionId, signal?: AbortSignal) => apiClient.post<AdmissionInquiry>(`/admissions/inquiries/${id}/commands`, body, config(sessionId, signal)).then(r => r.data);

export const fetchLifecycleDates = (id:number,sessionId:AuthSessionId,signal?:AbortSignal) => apiClient.get<LifecycleDates>(`/admissions/cases/${id}/lifecycle`,config(sessionId,signal)).then(r=>r.data);
export const commandLifecycleDates = (id:number,body:LifecycleDateCommand,sessionId:AuthSessionId,signal?:AbortSignal) => apiClient.post<LifecycleDates>(`/admissions/cases/${id}/lifecycle`,body,config(sessionId,signal)).then(r=>r.data);
