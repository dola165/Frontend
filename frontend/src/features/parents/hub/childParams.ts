/**
 * What a child's page keeps in the address, all of it gone when another child (or Everyone) is chosen: the details
 * view, a full view (`view=calendar|updates`), an open session (`session=squad:id`, with `at`) and the box to bring into
 * view (`part=updates`, from an old squad-page link).
 */
export const CHILD_PARAMS = ['details', 'view', 'session', 'at', 'part'] as const;

/** `session=12:345` as the squad and the session, when it is one. */
export function sessionParam(value: string | null) {
    const match = value ? /^(\d+):(\d+)$/.exec(value) : null;
    return match ? { squadId: Number(match[1]), sessionId: Number(match[2]) } : null;
}

/** A session asked for (`session` with its `at`) outside the seven days from today: the calendar opens on it. */
export function laterSession(params: URLSearchParams, now = new Date()) {
    const asked = sessionParam(params.get('session'));
    const at = new Date(params.get('at') ?? '');
    if (!asked || !Number.isFinite(at.getTime())) return null;
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    return at.getTime() < today.getTime() || at.getTime() >= today.getTime() + 7 * 86400000 ? { ...asked, at } : null;
}

/** A child's page address, for links that open it on one part. */
export function childPath(playerId: number, extra: Record<string, string> = {}) {
    const params = new URLSearchParams({ player: String(playerId), ...extra });
    return `/parent?${params}`;
}

/**
 * The club pop-up over a child's page (`find=club`). A group (a shared link, an old group page) opens on that group and
 * its club, loaded by the group's id above the list, so no filter, distance or page of the list hides it.
 */
export function finderPath(playerId: number, groupId?: number) {
    const params = new URLSearchParams({ player: String(playerId), find: 'club' });
    if (groupId) params.set('group', String(groupId));
    return `/parent?${params}`;
}

/** Where an old squad-page link takes a parent: the child's page, opened on its session or on the updates. */
export function childPageFor(squadId: number, playerId: number, params: URLSearchParams, hash = '') {
    const next = new URLSearchParams({ player: String(playerId) });
    const session = params.get('session') ?? params.get('sessionId');
    const tab = params.get('tab');
    if (session && /^\d+$/.test(session)) { next.set('session', `${squadId}:${session}`); if (params.get('at')) next.set('at', params.get('at')!); }
    else if (tab === 'updates' || tab === 'announcements' || hash.startsWith('#squad-update-')) next.set('view', 'updates');
    else if (tab === 'schedule' || tab === 'sessions') next.set('view', 'calendar');
    // An old link to one update keeps it, so the full list opens on that update.
    return `/parent?${next}${hash.startsWith('#squad-update-') ? hash : ''}`;
}
