import { apiClient, type AuthSessionRequestConfig } from '../../../api/axiosConfig';
import type { AuthSessionId } from '../../../utils/authStorage';
import type { Booking } from '../../venues/api';

export type ClosurePreview = {
    accountId: number; version: string; passwordRequired: boolean;
    blockers: { code: string; name: string; recoveryPath: string; action: string }[];
    consequences: string[];
};
/** `keepUntil`: signing in before it offers "Keep my account"; after it the account is erased. */
export type ClosureReceipt = { accountId: number; requestId: string; closedAt: string; keepUntil: string; outcome: 'CLOSED' };
export type CloseAccount = { requestId: string; version: string; currentPassword: string; acknowledged: boolean };

export async function cancelPersonalBookingForClosure(venueId: number, bookingId: number, sessionId: AuthSessionId) {
    const config: AuthSessionRequestConfig & { _skipAuthRefresh: boolean } = { _authSessionId: sessionId, _skipAuthRefresh: true };
    return (await apiClient.post<Booking>('/auth/account-closure/cancel-booking', { venueId, bookingId }, config)).data;
}

export async function previewAccountClosure(sessionId: AuthSessionId, signal: AbortSignal) {
    const config: AuthSessionRequestConfig = { signal, _authSessionId: sessionId };
    return (await apiClient.get<ClosurePreview>('/auth/account-closure', config)).data;
}

export async function closeAccount(body: CloseAccount, sessionId: AuthSessionId, signal: AbortSignal) {
    // A destructive write is never automatically replayed, including after refresh.
    const config: AuthSessionRequestConfig & { _skipAuthRefresh: boolean } = { signal, _authSessionId: sessionId, _skipAuthRefresh: true };
    return (await apiClient.post<ClosureReceipt>('/auth/account-closure', body, config)).data;
}
