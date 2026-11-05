import { apiClient, type AuthSessionRequestConfig } from '../../api/axiosConfig';
import { getAuthSessionId } from '../../utils/authStorage';
import type { Job } from './api';

export type ResponseAction = 'REPLY' | 'OFFER' | 'ACCEPT' | 'DECLINE' | 'WITHDRAW';
export interface JobResponse {
    id: number; jobId: number; title: string; direction: 'HIRING' | 'OFFERING'; listingStatus: string;
    terms: Pick<Job, 'description' | 'category' | 'engagementType' | 'hours' | 'pay' | 'licence' | 'ageGroup' | 'level'> & { version: number; city: string | null };
    offeredListingVersion: number | null; contactAllowed: boolean;
    applicantId: number; applicantName: string; status: string; version: number;
    applicant: boolean; publisher: boolean; actions: ResponseAction[]; updatedAt: string;
    events: Array<{ id: number; side: 'APPLICANT' | 'PUBLISHER' | 'SYSTEM'; action: string; note: string | null; createdAt: string }>;
}
export interface ResponseWorkspace { publisher: boolean; canSubmit: boolean; reason: string | null; responses: JobResponse[] }
export interface ResponseCommand { requestId: string; expectedVersion: number; note: string; action?: ResponseAction; expectedListingVersion?: number }
const session = () => ({ _authSessionId: getAuthSessionId() } as AuthSessionRequestConfig);
export const fetchResponses = async (jobId: number, signal: AbortSignal) => (await apiClient.get<ResponseWorkspace>(`/jobs/${jobId}/responses`, { signal, ...session() })).data;
export const fetchMyResponses = async (signal: AbortSignal) => (await apiClient.get<JobResponse[]>('/jobs/responses/mine', { signal, ...session() })).data;
export const sendResponse = async (jobId: number, responseId: number | null, input: ResponseCommand) => (await apiClient.post<JobResponse>(responseId == null ? `/jobs/${jobId}/responses` : `/jobs/responses/${responseId}`, input, session())).data;
