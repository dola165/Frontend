import { apiClient, type AuthSessionRequestConfig } from '../../api/axiosConfig';
import type { AuthSessionId } from '../../utils/authStorage';

export type FollowSubject = { kind: 'club'; id: number } | { kind: 'person'; id: number };

/**
 * Follow or stop following, and the state the server settled on. A club has POST and DELETE (both safe to repeat);
 * a person has one toggle (POST), so it is sent only when the state is known to differ.
 */
export async function setFollowing(subject: FollowSubject, following: boolean, sessionId?: AuthSessionId): Promise<boolean> {
    const config = sessionId === undefined ? undefined : { _authSessionId: sessionId } as AuthSessionRequestConfig;
    let settled: boolean;
    if (subject.kind === 'club') {
        const url = `/clubs/${subject.id}/follow`;
        const { data } = await (following ? apiClient.post<{ following?: boolean }>(url, undefined, config) : apiClient.delete<{ following?: boolean }>(url, config));
        settled = typeof data?.following === 'boolean' ? data.following : following;
    } else {
        const { data } = await apiClient.post<{ following?: boolean }>(`/users/${subject.id}/follow`, undefined, config);
        settled = typeof data?.following === 'boolean' ? data.following : following;
    }
    window.dispatchEvent(new CustomEvent<FollowSettled>(FOLLOW_SETTLED, { detail: { subject, following: settled } }));
    return settled;
}

/** Every Follow showing the same club or person takes the state the server settled on, wherever it was changed. */
export const FOLLOW_SETTLED = 'gk-follow-settled';
export type FollowSettled = { subject: FollowSubject; following: boolean };

/**
 * Several follows at once (the welcome's pickers, the first week's clubs near you) change what Home shows: Home loads
 * again when told. A single Follow beside a post leaves the feed where it is.
 */
export const FOLLOWS_CHANGED = 'gk-follows-changed';
export const followsChanged = () => window.dispatchEvent(new Event(FOLLOWS_CHANGED));

/** Follows each club not followed yet (the welcome's pickers); resolves to how many did not go through. */
export const followClubs = async (clubs: { id: number; following?: boolean }[]) => {
    const results = await Promise.allSettled(clubs.filter(club => !club.following).map(club => setFollowing({ kind: 'club', id: club.id }, true)));
    if (results.some(result => result.status === 'fulfilled')) followsChanged();
    return results.filter(result => result.status === 'rejected').length;
};
