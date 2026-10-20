import { useEffect, useSyncExternalStore } from 'react';
import { apiClient } from '../../api/axiosConfig';
import { getAuthSessionId } from '../../utils/authStorage';

/**
 * One person's presentation choices, kept on the server (GET/PUT /users/me/preferences) in named sections. A local
 * copy per account renders instantly and is replaced by the server's on load; changes show at once and are written
 * through. Nothing here grants or removes access. Sign-out removes the local copy (`clearStoredAuth`).
 */
export interface PreferencesTown { name: string; latitude: number; longitude: number; countryCode?: string }
/** A step of the welcome popup after sign-up. */
/** "Set up your profile": ROLES, ABOUT, FOLLOW (clubs near you), PROFILE; the rest are the earlier welcome's, still read. */
export type WelcomeStep = 'ROLES' | 'ABOUT' | 'FOLLOW' | 'PROFILE' | 'CLUB' | 'CHILD' | 'TOURNAMENT' | 'VENUE' | 'BUSINESS';
/** OPEN shows the popup over Home until finished or closed; DONE never shows it by itself again. Skipped steps come back once as a card. */
export interface WelcomeProgress { state: 'OPEN' | 'DONE'; at?: WelcomeStep | null; skipped?: WelcomeStep[]; cardDismissed?: boolean }
/** The first run: the town Home and World start from, and the welcome's progress. */
export interface StartPreferences { town?: PreferencesTown | null; welcome?: WelcomeProgress | null }
export interface StoredPin { path: string; label: string; icon: string }
export interface WorkspacePreferences { hiddenTabs?: string[]; hiddenAreas?: string[]; hiddenResponsibilities?: string[] }
export interface Preferences {
    start?: StartPreferences;
    pins?: { pins: StoredPin[] };
    /** Keyed by club id. */
    workspaces?: Record<string, WorkspacePreferences>;
    tutorials?: { completed: string[] };
    updatedAt?: string | null;
}
/** Every section sent replaces the saved one; workspaces merge per club and per list, as on the server. */
export type PreferencesUpdate = Omit<Preferences, 'updatedAt'>;

export const PREFERENCES_KEY_PREFIX = 'gk-prefs:v1:';
const WORKSPACE_LISTS = ['hiddenTabs', 'hiddenAreas', 'hiddenResponsibilities'] as const;
const EMPTY: Preferences = {};

interface Waiter { resolve: (doc: Preferences) => void; reject: (error: unknown) => void }
interface Entry {
    doc: Preferences;
    /** Changes not yet confirmed by the server, kept with the copy so a reload still sends them. */
    pending: PreferencesUpdate | null;
    loaded: boolean;
    loading?: Promise<Preferences>;
    sending: boolean;
    waiters: Waiter[];
}

// Blocked storage reads as no sign-in marker rather than breaking every screen that shows a preference.
const currentSession = () => { try { return getAuthSessionId(); } catch { return null; } };
const isCurrent = (session: string | null) => currentSession() === session;
const entries = new Map<number, Entry>();
const listeners = new Set<() => void>();
let entriesSession = typeof window === 'undefined' ? null : currentSession();
const notify = () => listeners.forEach(listener => listener());

export function applyPreferencesUpdate(doc: Preferences, update: PreferencesUpdate): Preferences {
    const next: Preferences = { ...doc };
    if (update.start) next.start = update.start;
    if (update.pins) next.pins = update.pins;
    if (update.tutorials) next.tutorials = update.tutorials;
    if (update.workspaces) {
        const all = { ...doc.workspaces };
        for (const [club, workspace] of Object.entries(update.workspaces)) {
            const merged: WorkspacePreferences = { ...all[club] };
            for (const list of WORKSPACE_LISTS) if (workspace[list]) merged[list] = workspace[list];
            if (WORKSPACE_LISTS.every(list => !merged[list]?.length)) delete all[club];
            else all[club] = merged;
        }
        next.workspaces = all;
    }
    return next;
}

/** Two unsent changes as one. Unlike a saved document, an emptied workspace list is kept: it is a reset to send. */
function mergeUpdates(first: PreferencesUpdate | null, second: PreferencesUpdate): PreferencesUpdate {
    const merged: PreferencesUpdate = { ...first, ...second };
    if (first?.workspaces && second.workspaces) {
        const all = { ...first.workspaces };
        for (const [club, workspace] of Object.entries(second.workspaces)) all[club] = { ...all[club], ...workspace };
        merged.workspaces = all;
    }
    return merged;
}

function storageRead(userId: number): Pick<Entry, 'doc' | 'pending'> {
    try {
        const stored = JSON.parse(window.localStorage.getItem(`${PREFERENCES_KEY_PREFIX}${userId}`) ?? 'null') as Partial<Entry> | null;
        if (stored && typeof stored.doc === 'object' && stored.doc) return { doc: stored.doc, pending: stored.pending ?? null };
    } catch { /* A damaged copy is replaced by the server's. */ }
    return { doc: EMPTY, pending: null };
}

function persist(userId: number, entry: Entry) {
    try { window.localStorage.setItem(`${PREFERENCES_KEY_PREFIX}${userId}`, JSON.stringify({ doc: entry.doc, pending: entry.pending })); }
    catch { /* The choices still apply for this visit. */ }
}

function entryFor(userId: number): Entry {
    // A different sign-in never sees the previous one's copy or unsent changes.
    if (entriesSession !== currentSession()) { entries.clear(); entriesSession = currentSession(); }
    let entry = entries.get(userId);
    if (!entry) {
        entry = { ...storageRead(userId), loaded: false, sending: false, waiters: [] };
        entries.set(userId, entry);
    }
    return entry;
}

/** The person's preferences as last known on this device; stable until something changes. */
export const readPreferences = (userId: number): Preferences => entryFor(userId).doc;

export function subscribePreferences(listener: () => void) {
    listeners.add(listener);
    const onStorage = (event: StorageEvent) => {
        if (!event.key?.startsWith(PREFERENCES_KEY_PREFIX)) return;
        const userId = Number(event.key.slice(PREFERENCES_KEY_PREFIX.length));
        const entry = entries.get(userId);
        // Another tab saved: take its copy, keeping this tab's own unsent changes on top.
        if (entry) entry.doc = applyPreferencesUpdate(storageRead(userId).doc, entry.pending ?? {});
        listener();
    };
    window.addEventListener('storage', onStorage);
    return () => { listeners.delete(listener); window.removeEventListener('storage', onStorage); };
}

if (typeof window !== 'undefined') {
    window.addEventListener('gk-auth-changed', () => {
        if (entriesSession === currentSession()) return;
        entries.clear();
        entriesSession = currentSession();
        notify();
    });
}

/** Reads the server's document once per sign-in (later calls share it); unsent local changes stay on top. */
export function loadPreferences(userId: number): Promise<Preferences> {
    const entry = entryFor(userId);
    if (entry.loaded) return Promise.resolve(entry.doc);
    if (entry.loading) return entry.loading;
    const session = currentSession();
    entry.loading = apiClient.get<Preferences>('/users/me/preferences').then(response => {
        if (!isCurrent(session) || entries.get(userId) !== entry) {
            settle(entry, new Error('The session changed before preferences loaded.'));
            return entry.doc;
        }
        const server = response.data ?? EMPTY;
        const carried = carryOverDeviceChoices(userId, server);
        if (carried) entry.pending = mergeUpdates(carried, entry.pending ?? {});
        entry.doc = applyPreferencesUpdate(server, entry.pending ?? {});
        entry.loaded = true;
        persist(userId, entry);
        notify();
        void flush(userId, entry);
        return entry.doc;
    }).finally(() => { entry.loading = undefined; });
    return entry.loading;
}

/**
 * Shows the change at once and writes it through. The promise settles when the server has it; callers that only
 * change presentation may ignore it, since a failed write is retried on the next change or load.
 */
export function updatePreferences(userId: number, update: PreferencesUpdate): Promise<Preferences> {
    const entry = entryFor(userId);
    entry.doc = applyPreferencesUpdate(entry.doc, update);
    entry.pending = mergeUpdates(entry.pending, update);
    persist(userId, entry);
    notify();
    const saved = new Promise<Preferences>((resolve, reject) => entry.waiters.push({ resolve, reject }));
    if (entry.loaded) void flush(userId, entry);
    else loadPreferences(userId).catch(error => settle(entry, error));
    return saved;
}

function settle(entry: Entry, error: unknown) {
    const waiters = entry.waiters.splice(0);
    waiters.forEach(waiter => (error === undefined ? waiter.resolve(entry.doc) : waiter.reject(error)));
}

async function flush(userId: number, entry: Entry) {
    if (entry.sending) return;
    if (!entry.pending) { settle(entry, undefined); return; }
    const sent = entry.pending, waiters = entry.waiters.splice(0), session = currentSession();
    entry.pending = null;
    entry.sending = true;
    try {
        const response = await apiClient.put<Preferences>('/users/me/preferences', sent);
        if (isCurrent(session) && entries.get(userId) === entry) {
            entry.doc = applyPreferencesUpdate(response.data ?? entry.doc, entry.pending ?? {});
            persist(userId, entry);
            notify();
        }
        waiters.forEach(waiter => waiter.resolve(entry.doc));
    } catch (error) {
        const status = (error as { response?: { status?: number } }).response?.status;
        // The server refused this change outright: drop it rather than resend it forever. Otherwise keep it.
        const refused = status !== undefined && status >= 400 && status < 500 && ![401, 403, 408, 429].includes(status);
        if (!refused && entries.get(userId) === entry) entry.pending = mergeUpdates(sent, entry.pending ?? {});
        if (refused) { entry.loaded = false; void loadPreferences(userId).catch(() => undefined); }
        persist(userId, entry);
        waiters.forEach(waiter => waiter.reject(error));
        return;
    } finally {
        entry.sending = false;
    }
    if (entry.pending && isCurrent(session) && entries.get(userId) === entry) void flush(userId, entry);
}

/** The person's preferences for rendering, loaded from the server once per sign-in. */
export function usePreferences(userId: number | null | undefined): Preferences {
    const doc = useSyncExternalStore(subscribePreferences, () => (userId ? readPreferences(userId) : EMPTY), () => EMPTY);
    useEffect(() => { if (userId) void loadPreferences(userId).catch(() => undefined); }, [userId]);
    return doc;
}

export function completeTutorial(userId: number, name: string) {
    const completed = readPreferences(userId).tutorials?.completed ?? [];
    if (completed.includes(name)) return;
    void updatePreferences(userId, { tutorials: { completed: [...completed, name] } }).catch(() => undefined);
}

// ---------------------------------------------------------------- choices made before preferences were saved

const WORKSPACE_TOKEN = /^[A-Za-z0-9][A-Za-z0-9_:.-]{0,59}$/;
const PIN_ICON = /^[a-z][a-z-]{0,29}$/;
const LEGACY_TUTORIAL_KEY = 'tutorial.calendar.completed';

function readJson(key: string): unknown {
    try { return JSON.parse(window.localStorage.getItem(key) ?? 'null'); } catch { return null; }
}
const tokens = (value: unknown) => (Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string' && WORKSPACE_TOKEN.test(id)) : []);

/**
 * Pins, workspace rails and the calendar tutorial used to live only on this device. The first load after the
 * change sends them for whatever the server does not hold yet, then forgets the device copies.
 */
function carryOverDeviceChoices(userId: number, server: Preferences): PreferencesUpdate | null {
    const update: PreferencesUpdate = {};
    const used: string[] = [];
    try {
        const pinKey = `gk-pins:v1:${userId}`;
        const legacyPins = (readJson(pinKey) as { pins?: unknown } | null)?.pins;
        if (Array.isArray(legacyPins)) {
            used.push(pinKey);
            if (!server.pins) update.pins = {
                pins: legacyPins.flatMap(item => {
                    const { path, label, icon } = (item ?? {}) as Record<string, unknown>;
                    if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || typeof label !== 'string' || !label.trim()) return [];
                    return [{ path, label: label.trim().slice(0, 60), icon: typeof icon === 'string' && PIN_ICON.test(icon) ? icon : 'bookmark' }];
                }).slice(0, 12),
            };
        }
        const workspaces: Record<string, WorkspacePreferences> = {};
        for (const key of Object.keys(window.localStorage)) {
            const match = /^gk-ws-(layout|focus):v1:(\d+):(\d+)$/.exec(key);
            if (!match || Number(match[3]) !== userId) continue;
            used.push(key);
            const club = match[2];
            if (server.workspaces?.[club]) continue;
            const value = readJson(key);
            const workspace = workspaces[club] ?? (workspaces[club] = {});
            if (match[1] === 'focus') workspace.hiddenResponsibilities = tokens(value);
            else { workspace.hiddenTabs = tokens((value as { tabs?: unknown } | null)?.tabs); workspace.hiddenAreas = tokens((value as { areas?: unknown } | null)?.areas); }
        }
        const kept = Object.entries(workspaces).filter(([, workspace]) => WORKSPACE_LISTS.some(list => workspace[list]?.length));
        if (kept.length) update.workspaces = Object.fromEntries(kept);
        if (window.localStorage.getItem(LEGACY_TUTORIAL_KEY) === 'true') {
            used.push(LEGACY_TUTORIAL_KEY);
            if (!server.tutorials) update.tutorials = { completed: ['calendar'] };
        }
        used.forEach(key => window.localStorage.removeItem(key));
    } catch { /* Storage unavailable: nothing to carry over. */ }
    return Object.keys(update).length ? update : null;
}
