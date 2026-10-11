import { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useWorldSession } from '../worldSession';
import type { WorldAudience } from './audience';
import { FIELDS, fieldInfo, type FieldId } from './fields';
import { ROLES, defaultRole, roleLayout, type OverviewLayout, type WorldRole } from './roles';

const knownFields = new Set<string>(FIELDS.map(field => field.id));
const knownRoles = new Set<string>(ROLES.map(role => role.id));
// v2 (11 October 2026): coach, parent and player pages were rebuilt, so pages saved before start again from the role.
const key = (userId: number | undefined) => `gk-world-overview:v2:${userId ?? 'guest'}`;

/** A saved page, or null. Unknown roles or fields (renamed or retired) are dropped; a list must sit beside the map. */
function read(userId: number | undefined): OverviewLayout | null {
    try {
        const saved = JSON.parse(localStorage.getItem(key(userId)) ?? 'null') as OverviewLayout | null;
        if (saved && knownRoles.has(saved.role) && knownFields.has(saved.side) && fieldInfo(saved.side).shape === 'list' && Array.isArray(saved.fields)) {
            return { role: saved.role, side: saved.side, fields: [...new Set(saved.fields.filter((id): id is FieldId => knownFields.has(id) && id !== saved.side))] };
        }
    } catch { /* storage unavailable or damaged: start from the role's page */ }
    return null;
}

/**
 * The person's own World front page: their role, the field beside the map and the fields below. Until they
 * save one, the page follows their relationships (coaching, a chosen child, playing). Kept in this browser for
 * now (backend needed: a per-person preference so it follows them to other devices).
 */
export function useOverviewLayout(audience: WorldAudience) {
    const { user } = useAuth();
    const { membership } = useWorldSession();
    const [saved, setSaved] = useState<{ userId?: number; layout: OverviewLayout | null } | null>(null);
    const stored = saved && saved.userId === user?.id ? saved.layout : read(user?.id);
    const suggested: WorldRole = defaultRole(audience, membership?.myRole);
    const layout = stored ?? roleLayout(suggested);
    const save = (next: OverviewLayout | null) => {
        try { if (next) localStorage.setItem(key(user?.id), JSON.stringify(next)); else localStorage.removeItem(key(user?.id)); } catch { /* kept for this visit only */ }
        setSaved({ userId: user?.id, layout: next });
    };
    return { layout, save, chosen: stored !== null };
}
