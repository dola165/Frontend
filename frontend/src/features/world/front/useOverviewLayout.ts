import { useSyncExternalStore } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useWorldSession } from '../worldSession';
import { useWorldAudience, type WorldAudience } from './audience';
import { FIELDS, fieldInfo, type FieldId } from './fields';
import { ROLES, defaultRole, roleLayout, type OverviewLayout, type WorldRole } from './roles';

const knownFields = new Set<string>(FIELDS.map(field => field.id));
const knownRoles = new Set<string>(ROLES.map(role => role.id));
// v2 (11 October 2026): coach, parent and player pages were rebuilt, so pages saved before start again from the role.
const key = (userId: number | undefined) => `gk-world-overview:v2:${userId ?? 'guest'}`;

// Every part of World that shows the person's role (the page, the World bar) reads the same saved value and
// hears when it changes, so saving a role in Customize updates them all at once.
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const stored = (userId: number | undefined) => { try { return localStorage.getItem(key(userId)); } catch { return null; } };
let unsaved: { userId?: number; layout: OverviewLayout | null } | null = null;
/** Bumped on every save, so a save is heard even when storage is unavailable and the stored text does not change. */
let version = 0;

/** A saved page, or null. Unknown roles or fields (renamed or retired) are dropped; a list must sit beside the map. */
function parse(raw: string | null): OverviewLayout | null {
    try {
        const saved = JSON.parse(raw ?? 'null') as OverviewLayout | null;
        if (saved && knownRoles.has(saved.role) && knownFields.has(saved.side) && fieldInfo(saved.side).shape === 'list' && Array.isArray(saved.fields)) {
            return { role: saved.role, side: saved.side, fields: [...new Set(saved.fields.filter((id): id is FieldId => knownFields.has(id) && id !== saved.side))] };
        }
    } catch { /* damaged: start from the role's page */ }
    return null;
}

/** Saves one person's World page (null starts again from their role). Customize and the first run both write through here. */
export function writeOverviewLayout(userId: number | undefined, next: OverviewLayout | null) {
    unsaved = { userId, layout: next };
    version += 1;
    // Storage can be unavailable; then a save holds for this visit only.
    try { if (next) localStorage.setItem(key(userId), JSON.stringify(next)); else localStorage.removeItem(key(userId)); } catch { /* kept for this visit only */ }
    listeners.forEach(listener => listener());
}

/**
 * The person's own World front page: their role, the field beside the map and the fields below. Until they
 * save one, the page follows their relationships (coaching, a chosen child, playing). Kept in this browser for
 * now (backend needed: a per-person preference so it follows them to other devices).
 */
export function useOverviewLayout(audience: WorldAudience) {
    const { user } = useAuth();
    const { membership } = useWorldSession();
    const snapshot = useSyncExternalStore(subscribe, () => `${version}:${stored(user?.id) ?? ''}`, () => '0:');
    const raw = snapshot.slice(snapshot.indexOf(':') + 1) || null;
    const fallback = unsaved && unsaved.userId === user?.id ? unsaved.layout : null;
    const saved = parse(raw) ?? fallback;
    const suggested: WorldRole = defaultRole(audience, membership?.myRole);
    const layout = saved ?? roleLayout(suggested);
    const save = (next: OverviewLayout | null) => writeOverviewLayout(user?.id, next);
    return { layout, save, chosen: saved !== null };
}

/** Who the person is on World (the role chosen in Customize, or the one their relationships suggest). */
export function useWorldRole(): WorldRole {
    return useOverviewLayout(useWorldAudience()).layout.role;
}
