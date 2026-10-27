import { apiClient, type AuthSessionRequestConfig } from '../../api/axiosConfig';
import type { AuthSessionId } from '../../utils/authStorage';

export type FollowSubject = { kind: 'club'; id: number } | { kind: 'person'; id: number };

/**
 * Follow or stop following, and the state the server settled on. A club has POST and DELETE (both safe to repeat);
 * a person has one toggle (POST), so it is sent only when the state is known to differ.
 */
export async function setFollowing(subject: FollowSubject, following: boolean, sessionId?: AuthSessionId): Promise<boolean> {
    const config = sessionId === undefined ? undefined : { _authSessionId: sessionId } as AuthSessionRequestConfig;
    if (subject.kind === 'club') {
        const url = `/clubs/${subject.id}/follow`;
        const { data } = await (following ? apiClient.post<{ following?: boolean }>(url, undefined, config) : apiClient.delete<{ following?: boolean }>(url, config));
        return typeof data?.following === 'boolean' ? data.following : following;
    }
    const { data } = await apiClient.post<{ following?: boolean }>(`/users/${subject.id}/follow`, undefined, config);
    return typeof data?.following === 'boolean' ? data.following : following;
}

/** Follows each club not followed yet (the welcome's pickers); resolves to how many did not go through. */
export const followClubs = async (clubs: { id: number; following?: boolean }[]) =>
    (await Promise.allSettled(clubs.filter(club => !club.following).map(club => setFollowing({ kind: 'club', id: club.id }, true)))).filter(result => result.status === 'rejected').length;
