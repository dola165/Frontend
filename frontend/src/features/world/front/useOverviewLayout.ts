import { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import type { WorldAudience } from './audience';
import { DEFAULT_LAYOUT, FIELDS, fieldInfo, type FieldId, type OverviewLayout } from './fields';

const known = new Set<string>(FIELDS.map(field => field.id));
const key = (userId: number | undefined, audience: WorldAudience) => `gk-world-overview:${userId ?? 'guest'}:${audience}`;

/** A saved layout, or the audience's default. Unknown fields (renamed or retired) are dropped; a list must sit beside the map. */
function read(userId: number | undefined, audience: WorldAudience): OverviewLayout {
    try {
        const saved = JSON.parse(localStorage.getItem(key(userId, audience)) ?? 'null') as OverviewLayout | null;
        if (saved && known.has(saved.side) && fieldInfo(saved.side).shape === 'list' && Array.isArray(saved.fields)) {
            return { side: saved.side, fields: [...new Set(saved.fields.filter((id): id is FieldId => known.has(id) && id !== saved.side))] };
        }
    } catch { /* storage unavailable or damaged: start from the default */ }
    return DEFAULT_LAYOUT[audience];
}

/**
 * The person's own World front page: which field sits beside the map and which follow below. Kept in this
 * browser for now (backend needed: a per-person preference so it follows them to other devices).
 */
export function useOverviewLayout(audience: WorldAudience) {
    const { user } = useAuth();
    const [state, setState] = useState<{ key: string; layout: OverviewLayout } | null>(null);
    const current = key(user?.id, audience);
    const layout = state?.key === current ? state.layout : read(user?.id, audience);
    const save = (next: OverviewLayout | null) => {
        try { if (next) localStorage.setItem(current, JSON.stringify(next)); else localStorage.removeItem(current); } catch { /* kept for this visit only */ }
        setState({ key: current, layout: next ?? DEFAULT_LAYOUT[audience] });
    };
    const customised = JSON.stringify(layout) !== JSON.stringify(DEFAULT_LAYOUT[audience]);
    return { layout, save, reset: () => save(null), customised };
}
