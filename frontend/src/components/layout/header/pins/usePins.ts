import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import type { NavigationCapabilities } from '../../../../context/navigationCapabilities';
import { loadPreferences } from '../../../../features/preferences/preferencesStore';
import { useJourneyCopy } from '../../../../features/squadCommunication/journeyCopy';
import { pinLabel, type Copy } from './describeRoute';
import { workspaceDestinations } from './pinCatalog';
import { MAX_PINS, readPins, readVisits, subscribePins, writePins, type Pin, type Visits } from './pinStore';

export type { Pin } from './pinStore';
const SUGGEST_AFTER_VISITS = 3;
const MAX_WORK_SUGGESTIONS = 6;
const MAX_VISIT_SUGGESTIONS = 3;
const NO_PINS: Pin[] = [];
const NO_VISITS: Visits = {};

/** A pin the person may want: either opened often lately (`visits`) or part of their own work (`reason`). */
export interface Suggestion extends Pin { visits: number | null; reason?: string }

/**
 * The person's own work, suggested from the start so nothing is lost: hubs that used to be tabs, and every squad,
 * tournament, organization and venue they work in. It only becomes a tab when the person pins it.
 */
export function workSuggestions(capabilities: NavigationCapabilities | undefined, tabPath: string | null, copy: Copy): Suggestion[] {
    const places = workspaceDestinations(capabilities, tabPath, copy).map(place => ({ path: place.path, label: place.label, icon: place.icon, visits: null, reason: place.kind }));
    const venues = capabilities?.workspaces.filter(item => item.id === 'venue.workspace').length ?? 0;
    const organizations = capabilities?.workspaces.filter(item => item.id === 'organization.workspace').length ?? 0;
    // Several venues or organizations also get their overview page.
    const overviews: Suggestion[] = [
        ...(venues > 1 ? [{ path: '/my-organizations?kind=VENUE', label: copy('My venues', 'ჩემი მოედნები'), icon: 'venue' as const, visits: null, reason: copy('All the venues you run', 'ყველა თქვენი მოედანი') }] : []),
        ...(organizations > 1 ? [{ path: '/my-organizations', label: copy('My organizations', 'ჩემი ორგანიზაციები'), icon: 'building' as const, visits: null, reason: copy('All the organizations you work for', 'ყველა თქვენი ორგანიზაცია') }] : []),
    ];
    return [...places, ...overviews];
}

/**
 * Personal pins next to the primary tabs. Nothing is ever pinned for the person: suggestions come from their own
 * work and their recent visits on this device, and wait for a tap. Labels follow the current language.
 */
export function usePins(userId: number | undefined, capabilities: NavigationCapabilities | undefined, tabPath: string | null = null) {
    const copy = useJourneyCopy();
    const stored = useSyncExternalStore(subscribePins, () => userId ? readPins(userId) : NO_PINS, () => NO_PINS);
    const visits = useSyncExternalStore(subscribePins, () => userId ? readVisits(userId) : NO_VISITS, () => NO_VISITS);
    // The header is on every signed-in page, so this is where a sign-in first reads its saved preferences.
    useEffect(() => { if (userId) void loadPreferences(userId).catch(() => undefined); }, [userId]);
    const context = useMemo(() => ({ capabilities, userId, tabPath, copy }), [capabilities, userId, tabPath, copy]);

    const pins = useMemo(() => stored.map(pin => ({ ...pin, label: pinLabel(pin.path, pin.label, context) ?? pin.label })), [stored, context]);

    const suggestions = useMemo<Suggestion[]>(() => {
        const pinned = (path: string) => stored.some(pin => pin.path === path);
        const work = workSuggestions(capabilities, tabPath, copy).filter(item => !pinned(item.path)).slice(0, MAX_WORK_SUGGESTIONS);
        const visited = Object.entries(visits)
            .map(([path, visit]) => ({ path, label: pinLabel(path, visit.label, context), icon: visit.icon ?? 'bookmark', visits: visit.t.length }))
            .filter((item): item is Suggestion & { label: string; visits: number } => item.visits >= SUGGEST_AFTER_VISITS && !!item.label)
            .filter(item => !pinned(item.path) && !work.some(other => other.path === item.path) && item.path !== tabPath)
            .sort((a, b) => b.visits - a.visits)
            .slice(0, MAX_VISIT_SUGGESTIONS);
        return [...work, ...visited];
    }, [visits, stored, capabilities, tabPath, copy, context]);

    // Writes keep each pin's own stored label; only the display follows the language.
    const save = useCallback((next: Pin[]) => { if (userId) writePins(userId, next); }, [userId]);
    const isPinned = useCallback((path: string) => stored.some(pin => pin.path === path), [stored]);
    const pin = useCallback((item: Pin) => {
        if (stored.some(existing => existing.path === item.path) || stored.length >= MAX_PINS) return;
        save([...stored, { path: item.path, label: item.label.slice(0, 60), icon: item.icon }]);
    }, [stored, save]);
    const unpin = useCallback((path: string) => save(stored.filter(item => item.path !== path)), [stored, save]);
    const move = useCallback((path: string, direction: -1 | 1) => {
        const index = stored.findIndex(item => item.path === path), target = index + direction;
        if (index < 0 || target < 0 || target >= stored.length) return;
        const next = [...stored];
        [next[index], next[target]] = [next[target], next[index]];
        save(next);
    }, [stored, save]);

    return { pins, suggestions, isPinned, pin, unpin, move, full: stored.length >= MAX_PINS };
}
