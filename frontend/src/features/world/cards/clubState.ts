import { useSyncExternalStore } from 'react';
import type { ClubRelationshipState } from '../../../components/discovery/clubDirectoryTypes';

/**
 * What the person did with a club during this visit (followed it, joined as a trialist, applied), shared by every place
 * the club is shown at once (its row in a list, its pane beside it), so they never disagree. Following is a toggle on
 * the server: two copies that disagreed could undo each other. Kept per session.
 */
export interface ClubChange { following?: boolean; relationship?: ClubRelationshipState }

const changes = new Map<string, ClubChange>();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

export const useClubChange = (key: string) => useSyncExternalStore(subscribe, () => changes.get(key));

export function changeClub(key: string, change: ClubChange) {
    changes.set(key, { ...changes.get(key), ...change });
    listeners.forEach(listener => listener());
}

/** Forgets every change (a fresh visit; tests start each case from the clubs as loaded). */
export function forgetClubChanges() {
    changes.clear();
    listeners.forEach(listener => listener());
}
