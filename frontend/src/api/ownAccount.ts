import { apiClient } from './axiosConfig';
import type { CompletedLogin } from '../components/auth/useSecondFactorLogin';

/**
 * A child's own account from a parent's link (release 7): what the link is for, and accepting it with a password,
 * which signs the child in with their history kept. Backend: fnd-signup-b (`/api/auth/own-account/*`): 400 invalid_token / PASSWORD_WEAK, 410 used_token / expired_token.
 */
export interface OwnAccountLink { name: string; email: string | null; status: 'PENDING' | 'USED' | 'EXPIRED' }
export const fetchOwnAccountLink = (token: string) =>
    apiClient.post<OwnAccountLink>('/auth/own-account/context', { token }).then(response => response.data);
export const acceptOwnAccount = (token: string, password: string) =>
    apiClient.post<CompletedLogin>('/auth/own-account/accept', { token, password }).then(response => response.data);
