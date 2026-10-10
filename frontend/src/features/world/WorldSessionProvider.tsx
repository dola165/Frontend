import type { ReactNode } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fetchMyClubMembershipContext } from '../clubs/api';
import { useWorldData } from './useWorldData';
import { WorldSessionContext } from './worldSession';

/** Loads what World needs to know about the signed-in person once, for every World page. */
export function WorldSessionProvider({ children }: { children: ReactNode }) {
    const { status, user } = useAuth();
    const membership = useWorldData(status === 'authenticated' ? `membership:${user?.id}` : null, () => fetchMyClubMembershipContext());
    const value = status === 'authenticated'
        ? { membership: membership.loading ? undefined : membership.data ?? null }
        : { membership: status === 'bootstrapping' ? undefined : null };
    return <WorldSessionContext.Provider value={value}>{children}</WorldSessionContext.Provider>;
}
