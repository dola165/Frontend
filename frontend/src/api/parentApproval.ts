import { apiClient } from './axiosConfig';

/**
 * A 13 to 15-year-old's account waits for a parent's one-tap approval (F1, 26 October 2026); without it the account is
 * removed after 7 days. Shape agreed with the backend worker fnd-signup-b.
 */
export interface ParentApprovalRequest {
    status: 'NOT_SENT' | 'SENT' | 'APPROVED';
    parentEmail?: string | null;
    sentAt?: string | null;
    /** When the waiting account is removed if nobody approves it. */
    expiresAt?: string | null;
}

export const fetchParentApproval = (signal?: AbortSignal) =>
    apiClient.get<ParentApprovalRequest>('/me/parent-approval', { signal }).then(response => response.data);
export const sendParentApproval = (parentEmail: string) =>
    apiClient.post<ParentApprovalRequest>('/me/parent-approval', { parentEmail }).then(response => response.data);
export const resendParentApproval = () =>
    apiClient.post<ParentApprovalRequest>('/me/parent-approval/resend').then(response => response.data);

/** What the parent's link shows: only the child's first name and age. */
export interface ParentApprovalLink { childName: string; childAge: number }
export const fetchParentApprovalLink = (token: string, signal?: AbortSignal) =>
    apiClient.get<ParentApprovalLink>(`/parent-approval/${encodeURIComponent(token)}`, { signal }).then(response => response.data);
export const answerParentApproval = (token: string, answer: 'approve' | 'decline') =>
    apiClient.post(`/parent-approval/${encodeURIComponent(token)}/${answer}`);
