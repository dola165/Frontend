import { useRef, useState } from 'react';
import { followClub, unfollowClub } from './startApi';

/** The first run's screens, each saving its own choice. */
export type Part = 'town' | 'see' | 'clubs' | 'do';
const ORDER: Part[] = ['town', 'see', 'clubs', 'do'];

/** A choice that did not save, with the save to try again (and, for clubs, how many follows are missing). */
export interface Unsaved { part: Part; save: () => Promise<unknown>; count?: number }

/** Some club follows did not go through. */
export class FollowsFailed extends Error {
    readonly count: number;
    constructor(count: number) { super(`${count} club follows were not saved`); this.count = count; }
}

/**
 * Follows and unfollows each club on its own, and records what the server now holds in `held`, so trying again sends
 * only what failed and never reverses a follow that went through.
 */
export function followChanges(held: Map<number, boolean>, wanted: Map<number, boolean>) {
    return async () => {
        const changes = [...wanted].filter(([id, on]) => (held.get(id) ?? false) !== on);
        const results = await Promise.allSettled(changes.map(async ([id, on]) => {
            await (on ? followClub(id) : unfollowClub(id));
            held.set(id, on);
        }));
        const failed = results.filter(result => result.status === 'rejected').length;
        if (failed) throw new FollowsFailed(failed);
    };
}

/**
 * What the first run could not save, kept across its screens with a way to try again. The person always moves on;
 * a later success of the same screen forgets it.
 */
export function useUnsaved() {
    const [items, setItems] = useState<Unsaved[]>([]);
    // The list as the last save left it, read by the next save before React renders.
    const latest = useRef<Unsaved[]>([]);
    const update = (next: Unsaved[]) => { latest.current = next; setItems(next); };
    /** Saves one screen's choice; true when it saved. */
    const attempt = async (part: Part, save: () => Promise<unknown>) => {
        try {
            await save();
            update(latest.current.filter(item => item.part !== part));
            return true;
        } catch (error) {
            const failed: Unsaved = { part, save, count: error instanceof FollowsFailed ? error.count : undefined };
            update([...latest.current.filter(item => item.part !== part), failed].sort((a, b) => ORDER.indexOf(a.part) - ORDER.indexOf(b.part)));
            return false;
        }
    };
    /** Tries every unsaved choice again; true when nothing is left unsaved. */
    const retry = async () => (await Promise.all(latest.current.map(item => attempt(item.part, item.save)))).every(Boolean);
    return { items, attempt, retry, pending: () => latest.current.length > 0 };
}
