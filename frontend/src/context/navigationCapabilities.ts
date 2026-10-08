/** Server-issued navigation hints, never permissions. Unknown capabilities are ignored. */
export interface NavigationCapabilities {
    version: 1;
    workspaces: WorkspaceCapability[];
}

export interface WorkspaceCapability {
    id: string;
    context: { type: string; id: number; label: string };
}

export interface WorkspaceLink {
    key: string;
    capability: string;
    path: string;
    label: string;
}

const destinations: Record<string, { type: string; title: string; path: (id: number) => string }> = {
    'club.workspace': { type: 'club', title: 'Workspace', path: id => `/clubs/${id}/workspace` },
    'club.operations': { type:'club',title:'Club responsibilities',path:id=>`/clubs/${id}/workspace` },
    'club.member': { type:'club',title:'Club appointment',path:id=>`/clubs/${id}` },
    'club.family': { type:'club',title:'Family football',path:()=>'/parent' },
    'club.agent': { type:'club',title:'Agent engagement',path:id=>`/clubs/${id}` },
    'club.work': { type:'user',title:'My club work',path:()=>'/club-operations' },
    'club.player': { type: 'club', title: 'My club', path: id => `/clubs/${id}` },
    'parent.hub': { type: 'user', title: 'Parent Hub', path: () => '/parent' },
    'referee.workspace': { type: 'user', title: 'Referee workspace', path: () => '/referees/me' },
    'agent.hub': { type: 'user', title: 'Agent Hub', path: () => '/agent' },
    'organization.workspace': { type: 'organization', title: 'Organization workspace', path: id => `/organizations/${id}/workspace` },
    'organization.settings': { type: 'organization', title: 'Organization settings', path: id => `/organizations/${id}/workspace?tab=settings` },
    'organization.create': { type: 'user', title: 'Create organization', path: () => '/organizations/create' },
    'tournament.create': { type: 'organization', title: 'Create tournament', path: id => `/tournaments/setup?organizer=${id}` },
    'tournament.workspace': { type: 'tournament', title: 'Tournament workspace', path: id => `/tournaments/${id}/workspace` },
    'venue.workspace': { type: 'organization', title: 'Stadium workspace', path: id => `/stadiums/${id}/manage` },
    'squad.workspace': { type: 'squad', title: 'Squad', path: id => `/squads/${id}` },
    'admin.console': { type: 'user', title: 'Admin', path: () => '/admin' },
};

const record = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

export function normalizeNavigationCapabilities(value: unknown, userId: number): NavigationCapabilities | undefined {
    // Only absence means an older server. Malformed or unsupported projections fail closed.
    if (value === undefined) return undefined;
    const result: NavigationCapabilities = { version: 1, workspaces: [] };
    if (!record(value) || value.version !== 1 || !Array.isArray(value.workspaces)) return result;
    const seen = new Set<string>();
    for (const item of value.workspaces) {
        if (!record(item) || typeof item.id !== 'string' || !Object.hasOwn(destinations, item.id) || !record(item.context)) continue;
        const destination = destinations[item.id];
        const context = item.context;
        if (context.type !== destination.type || typeof context.id !== 'number' || !Number.isSafeInteger(context.id) || context.id < 1
            || typeof context.label !== 'string' || !context.label.trim() || (context.type === 'user' && context.id !== userId)) continue;
        const key = `${item.id}:${context.type}:${context.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        result.workspaces.push({ id: item.id, context: { type: context.type as string, id: context.id, label: context.label } });
    }
    return result;
}

export function workspaceLinks(projection?: NavigationCapabilities): WorkspaceLink[] {
    return (projection?.workspaces ?? []).flatMap(item => {
        const destination = Object.hasOwn(destinations, item.id) ? destinations[item.id] : undefined;
        if (!destination || destination.type !== item.context.type) return [];
        return [{ key: `${item.id}:${item.context.type}:${item.context.id}`, capability: item.id,
            path: destination.path(item.context.id),
            label: item.context.type === 'user' ? destination.title : `${destination.title} — ${item.context.label}` }];
    });
}

export const hasNavigationCapability = (projection: NavigationCapabilities | undefined, id: string) =>
    projection?.workspaces.some(item => item.id === id) === true;
