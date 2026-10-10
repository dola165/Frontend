import type { ReactNode } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fetchAdmissionHome } from '../admissions/api';
import { fetchMyClubMembershipContext } from '../clubs/api';
import { useWorldData } from './useWorldData';
import { WorldSessionContext } from './worldSession';

/** Loads what World needs to know about the signed-in person once, for every World page. */
export function WorldSessionProvider({ children }: { children: ReactNode }) {
    const { status, user, sessionId } = useAuth();
    const signedIn = status === 'authenticated';
    const membership = useWorldData(signedIn ? `membership:${user?.id}` : null, () => fetchMyClubMembershipContext());
    // The children a parent searches for. Without them World still works, just not on a child's behalf.
    const family = useWorldData(signedIn ? `participants:${sessionId}` : null,
        signal => fetchAdmissionHome(sessionId, signal).then(home => home.participants ?? []).catch(() => []));
    const value = signedIn
        ? { membership: membership.loading ? undefined : membership.data ?? null, participants: family.loading ? undefined : family.data ?? [] }
        : { membership: status === 'bootstrapping' ? undefined : null, participants: status === 'bootstrapping' ? undefined : [] };
    return <WorldSessionContext.Provider value={value}>{children}</WorldSessionContext.Provider>;
}
