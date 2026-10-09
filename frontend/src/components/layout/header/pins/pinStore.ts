import { isPinIcon, type PinIcon } from './pinIcons';

/**
 * Device-local pins and visit counts, one record per account. `usePins` is the only consumer,
 * so a server-backed store can replace this module without touching the header.
 */
export interface Pin { path: string; label: string; icon: PinIcon }
export interface Visit { t: number[]; label?: string; icon?: PinIcon }
export type Visits = Record<string, Visit>;

export const MAX_PINS = 12;
export const VISIT_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const REVISIT_GAP_MS = 10 * 60 * 1000;
const MAX_VISITED_PAGES = 80;

const pinKey = (userId: number) => `gk-pins:v1:${userId}`;
const visitKey = (userId: number) => `gk-visits:v1:${userId}`;
const cache = new Map<string, unknown>();
const listeners = new Set<() => void>();
const EMPTY_VISITS: Visits = {};
const EMPTY_PINS: Pin[] = [];

export const isSafePath = (value: unknown): value is string =>
    typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && value.length <= 300 && !/[\\\s]/.test(value);

/** Stored as `{ pins: [...] }`. Anything malformed is dropped item by item rather than discarding the rest. */
function parsePins(raw: unknown): Pin[] {
    if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { pins?: unknown }).pins)) return EMPTY_PINS;
    const pins: Pin[] = [];
    for (const item of (raw as { pins: unknown[] }).pins) {
        if (!item || typeof item !== 'object') continue;
        const { path, label, icon } = item as Record<string, unknown>;
        if (!isSafePath(path) || typeof label !== 'string' || !label.trim() || pins.some(pin => pin.path === path)) continue;
        pins.push({ path, label: label.trim().slice(0, 60), icon: isPinIcon(icon) ? icon : 'bookmark' });
    }
    return pins.slice(0, MAX_PINS);
}

/** Visits older than the two-week window are dropped as they are read, so counts always mean "lately". */
function parseVisits(raw: unknown): Visits {
    if (!raw || typeof raw !== 'object') return EMPTY_VISITS;
    const since = Date.now() - VISIT_WINDOW_MS;
    const visits: Visits = {};
    for (const [path, value] of Object.entries(raw as Record<string, unknown>)) {
        if (!isSafePath(path) || !value || typeof value !== 'object') continue;
        const { t, label, icon } = value as Record<string, unknown>;
        if (!Array.isArray(t)) continue;
        visits[path] = {
            t: t.filter((stamp): stamp is number => Number.isFinite(stamp) && stamp > since).slice(-20),
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

function persist(key: string, stored: unknown) {
    try { window.localStorage.setItem(key, JSON.stringify(stored)); } catch { /* Pins still work for this visit without storage. */ }
    listeners.forEach(listener => listener());
}

function write(key: string, value: unknown) {
    cache.set(key, value);
    persist(key, value);
}

export function subscribePins(listener: () => void) {
    listeners.add(listener);
    const onStorage = (event: StorageEvent) => {
        if (!event.key?.startsWith('gk-pins:') && !event.key?.startsWith('gk-visits:')) return;
        cache.delete(event.key);
        listener();
    };
    window.addEventListener('storage', onStorage);
    return () => { listeners.delete(listener); window.removeEventListener('storage', onStorage); };
}

export const readPins = (userId: number) => read(pinKey(userId), parsePins);
export const readVisits = (userId: number) => read(visitKey(userId), parseVisits);
export function writePins(userId: number, pins: Pin[]) {
    const next = pins.slice(0, MAX_PINS);
    cache.set(pinKey(userId), next);
    persist(pinKey(userId), { pins: next });
}

/** Count a visit at most once per ten minutes per page, keeping two weeks of history. */
export function recordVisit(userId: number, path: string, icon: PinIcon, label: string | null) {
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
    const current = readVisits(userId);
    const visit = current[path];
    if (!visit || visit.label === label) return;
    write(visitKey(userId), { ...current, [path]: { ...visit, label } });
}
