import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { hasNavigationCapability, type NavigationCapabilities } from '../../../../context/navigationCapabilities';
import { MAX_PINS, readPins, readVisits, subscribePins, writePins, type Pin, type Visits } from './pinStore';

export type { Pin } from './pinStore';
export const VISIBLE_PINS = 5;
const SUGGEST_AFTER_VISITS = 3;
const MAX_SUGGESTIONS = 6;
const NO_PINS: Pin[] = [];
const NO_VISITS: Visits = {};

/** A pin the person may want: either opened often lately (`visits`) or part of their own work (`reason`). */
export interface Suggestion extends Pin { visits: number | null; reason?: string }

/**
 * Work the person already has that used to be a tab of its own (Parent Hub, officiating, agent and venue work).
 * It is suggested from the start so nothing is lost, but it only becomes a tab when the person pins it.
 */
function workSuggestions(capabilities: NavigationCapabilities | undefined): Suggestion[] {
    const has = (id: string) => hasNavigationCapability(capabilities, id);
    const venues = capabilities?.workspaces.some(item => item.id === 'venue.workspace');
    const organizations = capabilities?.workspaces.some(item => item.id === 'organization.workspace');
    return [
        ...(has('parent.hub') || has('club.family') ? [{ path: '/parent', label: 'Parent Hub', icon: 'family' as const, visits: null, reason: 'Your children and their football' }] : []),
        ...(has('referee.workspace') ? [{ path: '/referees/me', label: 'Officiating', icon: 'flag' as const, visits: null, reason: 'Your appointments and availability' }] : []),
        ...(has('agent.hub') ? [{ path: '/agent', label: 'Agent Hub', icon: 'briefcase' as const, visits: null, reason: 'Your players and opportunities' }] : []),
        ...(venues ? [{ path: '/my-organizations?kind=VENUE', label: 'My venues', icon: 'venue' as const, visits: null, reason: 'Bookings and pitches you run' }]
            : organizations ? [{ path: '/my-organizations', label: 'My organizations', icon: 'building' as const, visits: null, reason: 'Organizations you work for' }] : []),
    ];
}

/**
 * Personal pins next to the primary tabs. Nothing is ever pinned for the person:
 * suggestions come from their own recent visits and their own work, and wait for a tap.
 */
export function usePins(userId: number | undefined, capabilities: NavigationCapabilities | undefined) {
    const pins = useSyncExternalStore(subscribePins, () => userId ? readPins(userId) : NO_PINS, () => NO_PINS);
    const visits = useSyncExternalStore(subscribePins, () => userId ? readVisits(userId) : NO_VISITS, () => NO_VISITS);

    const suggestions = useMemo<Suggestion[]>(() => {
        const visited = Object.entries(visits)
            .map(([path, visit]) => ({ path, label: visit.label, icon: visit.icon ?? 'bookmark', visits: visit.t.length }))
            .filter((item): item is Suggestion & { label: string; visits: number } => item.visits >= SUGGEST_AFTER_VISITS && !!item.label)
            .sort((a, b) => b.visits - a.visits);
        return [...workSuggestions(capabilities), ...visited]
            .filter((item, index, all) => !pins.some(pin => pin.path === item.path) && all.findIndex(other => other.path === item.path) === index)
            .slice(0, MAX_SUGGESTIONS);
    }, [visits, pins, capabilities]);

    const save = useCallback((next: Pin[]) => { if (userId) writePins(userId, next); }, [userId]);
    const isPinned = useCallback((path: string) => pins.some(pin => pin.path === path), [pins]);
    const pin = useCallback((item: Pin) => {
        if (pins.some(existing => existing.path === item.path) || pins.length >= MAX_PINS) return;
        save([...pins, { path: item.path, label: item.label.slice(0, 60), icon: item.icon }]);
    }, [pins, save]);
    const unpin = useCallback((path: string) => save(pins.filter(item => item.path !== path)), [pins, save]);
    const move = useCallback((path: string, direction: -1 | 1) => {
        const index = pins.findIndex(item => item.path === path), target = index + direction;
        if (index < 0 || target < 0 || target >= pins.length) return;
        const next = [...pins];
        [next[index], next[target]] = [next[target], next[index]];
        save(next);
    }, [pins, save]);

    return { pins, suggestions, isPinned, pin, unpin, move, full: pins.length >= MAX_PINS };
}
