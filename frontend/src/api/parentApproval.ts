import { apiClient } from './axiosConfig';

/**
 * A 13 to 15-year-old's account waits for a parent's one-tap approval (F1, 26 October 2026); without it the account is
 * removed after 7 days. While it waits, the server answers everything else with 403 PARENT_APPROVAL_REQUIRED.
 * Backend: fnd-signup-b (`/api/auth/parent-approval*`).
 */
export interface ParentApprovalStatus {
    /** WAITING: a link went to `parentEmail`. PARENT_EMAIL_NEEDED: staff asked for a parent; ask for the email. */
    status: 'WAITING' | 'PARENT_EMAIL_NEEDED' | 'NOT_NEEDED';
    parentEmail?: string | null;
    linkSent?: boolean;
    sentAt?: string | null;
    /** Without approval, the account is removed after this moment. */
    deleteAfter?: string | null;
}

export const fetchParentApproval = (signal?: AbortSignal) =>
    apiClient.get<ParentApprovalStatus>('/auth/parent-approval', { signal }).then(response => response.data);
/** Sends a new link (to the same or a corrected email); the previous link stops working. */
export const sendParentApproval = (parentEmail: string) =>
    apiClient.post<ParentApprovalStatus>('/auth/parent-approval', { parentEmail }).then(response => response.data);

/** What the parent's link shows: the child's name only, never a birth date. */
export interface ParentApprovalLink { childName: string; status: 'PENDING' | 'APPROVED' | 'REPLACED' }
export const fetchParentApprovalLink = (token: string) =>
    apiClient.post<ParentApprovalLink>('/auth/parent-approval/context', { token }).then(response => response.data);
export const approveParentApproval = (token: string) =>
    apiClient.post<ParentApprovalLink>('/auth/parent-approval/approve', { token }).then(response => response.data);
