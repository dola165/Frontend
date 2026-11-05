import { legacyWorkspaceTarget } from '../../../../features/clubOffice/officeLinks';
import { readPreferences, subscribePreferences, updatePreferences, type Preferences } from '../../../../features/preferences/preferencesStore';
import { isPinIcon, type PinIcon } from './pinIcons';

/**
 * Pins live with the person's preferences on the server (shown at once from this device's copy); visit counts stay
 * on this device and end with the sign-in. `usePins` is the only consumer of both.
 */
export interface Pin { path: string; label: string; icon: PinIcon }
export interface Visit { t: number[]; label?: string; icon?: PinIcon }
export type Visits = Record<string, Visit>;

export const MAX_PINS = 12;
export const VISIT_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const REVISIT_GAP_MS = 10 * 60 * 1000;
const MAX_VISITED_PAGES = 80;

const visitKey = (userId: number) => `gk-visits:v1:${userId}`;
const cache = new Map<string, unknown>();
const listeners = new Set<() => void>();
const EMPTY_VISITS: Visits = {};
const EMPTY_PINS: Pin[] = [];

export const isSafePath = (value: unknown): value is string =>
    typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && value.length <= 300 && !/[\\\s]/.test(value);

/** Old saved destinations must not bring a retired page back through a pin or suggestion. */
function cleanupPinPath(value: unknown): string | null {
    if (!isSafePath(value)) return null;
    const url = new URL(value, 'https://pins.invalid');
    const path = url.pathname;
    if (['/workspaces', '/matches', '/tournaments/setup', '/join-squad', '/parent/enrollment', '/volunteering', '/event-venues', '/map-workspace-demo.html'].includes(path)
        || path.startsWith('/tournament-series/')) return null;
    if (path.startsWith('/roles/') || path.startsWith('/agents/')) {
        const id = /^\/(?:roles|agents)\/([1-9]\d*)$/.exec(path)?.[1];
        if (!id || !Number.isSafeInteger(Number(id))) return null;
        url.pathname = path.startsWith('/roles/') ? `/jobs/${id}` : `/profile/${id}`;
        if (path.startsWith('/agents/')) url.searchParams.set('tab', 'career');
    }
    if (path === '/account/roles') {
        url.pathname = '/account/football';
        if (url.hash === '#roles') url.hash = '#where';
        if (url.hash === '#professions') url.hash = '#work';
    }
    if (path === '/people') url.pathname = '/world/people';
    if (path === '/agent/dashboard') url.pathname = '/agent';
    if (path === '/squads') url.pathname = '/my-squads';
    if (path === '/clubs/following') { url.pathname = '/world/clubs'; url.searchParams.set('view', 'following'); }
    if (path === '/club-operations') {
        url.pathname = url.searchParams.has('permissionId') ? '/parent' : '/requests';
        if (url.pathname === '/parent') url.searchParams.set('tab', 'connections');
    }
    if (path === '/notifications') { url.pathname = '/requests'; url.searchParams.set('view', 'updates'); }
    if (/^\/clubs\/[1-9]\d*\/squads$/.test(path)) { url.pathname = path.replace(/\/squads$/, ''); url.searchParams.set('tab', 'teams'); }
    // The club workspace became Club office (step 2, 28 October 2026): a saved pin moves to where its tab lives now.
    const workspace = /^\/clubs\/([1-9]\d*)\/workspace$/.exec(path);
    if (workspace) {
        const moved = new URL(legacyWorkspaceTarget(Number(workspace[1]), url.searchParams), url.origin);
        if (moved.pathname === '/requests') return null;
        url.pathname = moved.pathname; url.search = moved.search;
    }
    if (path === '/roles' || path === '/world/opportunities' && (url.searchParams.get('tab') ?? url.searchParams.get('type')) === 'jobs') {
        url.pathname = '/jobs';
        for (const [from, into] of [['search', 'query'], ['q', 'query'], ['engagement', 'terms']]) {
            if (url.searchParams.has(from)) { url.searchParams.set(into, url.searchParams.get(from)!); url.searchParams.delete(from); }
        }
        url.searchParams.delete('tab'); url.searchParams.delete('type');
    }
    return url.pathname + url.search + url.hash;
}

/** Saved as `{ pins: [...] }`. Anything malformed is dropped item by item rather than discarding the rest. */
function parsePins(raw: unknown): Pin[] {
    if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { pins?: unknown }).pins)) return EMPTY_PINS;
    const pins: Pin[] = [];
    for (const item of (raw as { pins: unknown[] }).pins) {
        if (!item || typeof item !== 'object') continue;
        const { label, icon } = item as Record<string, unknown>;
        const path = cleanupPinPath((item as Record<string, unknown>).path);
        if (!path || typeof label !== 'string' || !label.trim() || pins.some(pin => pin.path === path)) continue;
        pins.push({ path, label: label.trim().slice(0, 60), icon: isPinIcon(icon) ? icon : 'bookmark' });
    }
    return pins.slice(0, MAX_PINS);
}

/** Visits older than the two-week window are dropped as they are read, so counts always mean "lately". */
function parseVisits(raw: unknown): Visits {
    if (!raw || typeof raw !== 'object') return EMPTY_VISITS;
    const since = Date.now() - VISIT_WINDOW_MS;
    const visits: Visits = {};
    for (const [savedPath, value] of Object.entries(raw as Record<string, unknown>)) {
        const path = cleanupPinPath(savedPath);
        if (!path || !value || typeof value !== 'object') continue;
        const { t, label, icon } = value as Record<string, unknown>;
        if (!Array.isArray(t)) continue;
        visits[path] = {
            ...visits[path],
            t: [...new Set([...(visits[path]?.t ?? []), ...t.filter((stamp): stamp is number => Number.isFinite(stamp) && stamp > since)])].sort((a, b) => a - b).slice(-20),
            ...(typeof label === 'string' && label.trim() ? { label: label.trim().slice(0, 60) } : {}),
            ...(isPinIcon(icon) ? { icon } : {}),
        };
    }
    return visits;
}

function read<T>(key: string, parse: (raw: unknown) => T): T {
    if (cache.has(key)) return cache.get(key) as T;
    let value: T;
    try { value = parse(JSON.parse(window.localStorage.getItem(key) ?? 'null')); } catch { value = parse(null); }
    cache.set(key, value);
    return value;
}

function write(key: string, value: unknown) {
    cache.set(key, value);
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* Suggestions still work for this visit without storage. */ }
    listeners.forEach(listener => listener());
}

// Visit history belongs to one sign-in: sign-in and sign-out remove it from storage (`clearStoredAuth`), so the
// in-memory copy is dropped as well. Pins come back from the server with the next sign-in.
if (typeof window !== 'undefined') {
    window.addEventListener('gk-auth-changed', () => {
        for (const key of [...cache.keys()]) if (key.startsWith('gk-visits:')) cache.delete(key);
        listeners.forEach(listener => listener());
    });
}

export function subscribePins(listener: () => void) {
    listeners.add(listener);
    const onStorage = (event: StorageEvent) => {
        if (!event.key?.startsWith('gk-visits:')) return;
        cache.delete(event.key);
        listener();
    };
    window.addEventListener('storage', onStorage);
    const stopPreferences = subscribePreferences(listener);
    return () => { listeners.delete(listener); window.removeEventListener('storage', onStorage); stopPreferences(); };
}

// One parsed list per saved document, so readers get the same array until the pins change.
const parsedPins = new WeakMap<Preferences, Pin[]>();
export function readPins(userId: number) {
    const preferences = readPreferences(userId);
    let pins = parsedPins.get(preferences);
    if (!pins) { pins = parsePins(preferences.pins); parsedPins.set(preferences, pins); }
    return pins;
}
export const readVisits = (userId: number) => read(visitKey(userId), parseVisits);
/** Shows the new pins at once and keeps them for the person on every device. */
export function writePins(userId: number, pins: Pin[]) {
    void updatePreferences(userId, { pins: { pins: parsePins({ pins }) } }).catch(() => undefined);
}

/**
 * Count a visit at most once per ten minutes per page, keeping two weeks of history. A page the route can name
 * is stored without a label (it is named in the current language when shown); others keep their visible title.
 */
export function recordVisit(userId: number, path: string, icon: PinIcon, label: string | null) {
    const cleaned = cleanupPinPath(path);
    if (!cleaned) return;
    path = cleaned;
    const now = Date.now();
    const current = readVisits(userId);
    const previous = current[path];
    const recent = (previous?.t ?? []).filter(stamp => now - stamp < VISIT_WINDOW_MS);
    if (recent.length && now - recent[recent.length - 1] < REVISIT_GAP_MS) return;
    const next: Visits = {};
    const kept = Object.entries(current)
        .map(([key, visit]) => [key, { ...visit, t: visit.t.filter(stamp => now - stamp < VISIT_WINDOW_MS) }] as const)
        .filter(([key, visit]) => key !== path && visit.t.length > 0)
        .sort((a, b) => b[1].t[b[1].t.length - 1] - a[1].t[a[1].t.length - 1])
        .slice(0, MAX_VISITED_PAGES - 1);
    for (const [key, visit] of kept) next[key] = visit;
    next[path] = { t: [...recent, now].slice(-20), icon, ...(label ?? previous?.label ? { label: label ?? previous?.label } : {}) };
    write(visitKey(userId), next);
}

/** Remember a page's visible title for suggestions, once it has rendered. */
export function nameVisit(userId: number, path: string, label: string) {
    const cleaned = cleanupPinPath(path);
    if (!cleaned) return;
    path = cleaned;
    const current = readVisits(userId);
    const visit = current[path];
    if (!visit || visit.label === label) return;
    write(visitKey(userId), { ...current, [path]: { ...visit, label } });
}
