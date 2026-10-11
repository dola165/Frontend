import { createContext, useContext } from 'react';
import { apiClient, type AuthSessionRequestConfig } from '../../../../api/axiosConfig';
import type { AuthSessionId } from '../../../../utils/authStorage';

const PAGE = 50, PAGES = 4;

/** The people this person follows: up to four pages, and whether that is all of them. */
export async function loadFollowing(userId: number, sessionId: AuthSessionId, signal: AbortSignal) {
    const ids = new Set<number>();
    for (let page = 0; page < PAGES; page++) {
        const { data } = await apiClient.get<{ content: { id: number }[]; totalElements?: number }>(`/users/${userId}/following`,
            { params: { page, size: PAGE }, signal, _authSessionId: sessionId } as AuthSessionRequestConfig);
        data.content.forEach(person => ids.add(person.id));
        if (data.content.length < PAGE || (data.totalElements != null && ids.size >= data.totalElements)) return { ids, complete: true };
    }
    return { ids, complete: false };
}

export interface Following {
    /** Whether this person is followed; undefined when it is not known (then nothing offers to follow them). */ follows: (id: number) => boolean | undefined;
    toggle: (id: number) => Promise<void>;
}
export const FollowingContext = createContext<Following>({ follows: () => undefined, toggle: async () => undefined });

/** Whether a person is followed (undefined when unknown) and how to change it. */
export function useFollow(id: number) {
    const { follows, toggle } = useContext(FollowingContext);
    return { following: follows(id), toggle: () => toggle(id) };
}
