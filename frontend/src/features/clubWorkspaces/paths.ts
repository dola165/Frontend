import type { JobWorkspace } from './types';

export const jobWorkspacePath = (club: number, workspace?: string, context = new URLSearchParams()) => {
    const search = context.toString();
    return `/clubs/${club}/work${workspace ? `/${encodeURIComponent(workspace)}` : ''}${search ? `?${search}` : ''}`;
};

/** Keep person/session/squad and source/return tokens. A different tool starts without the previous tool's record or filters. */
export function workspaceSectionPath(club: number, workspace: JobWorkspace, section: string, context: URLSearchParams) {
    const next = new URLSearchParams(context);
    ['tool', 'deskTab', 'record', 'from', 'new', 'care', 'kind', 'q', 'page', 'sort', 'dir', 'state', 'mine', 'registration', 'prospect', 'view', 'travelPlan', 'travelTab'].forEach(key => next.delete(key));
    if (section === 'tools') next.set('deskTab', 'tools');
    else if (section !== 'overview') next.set('tool', section);
    return jobWorkspacePath(club, workspace.key, next);
}

export function workspaceRecordPath(club: number, workspace: JobWorkspace, tool: string, record: { id: number; squad_id: number | null }, context: URLSearchParams) {
    const next = new URLSearchParams(workspaceSectionPath(club, workspace, tool, context).split('?')[1]);
    next.set('record', String(record.id));
    if (record.squad_id !== null) next.set('squad', String(record.squad_id));
    return jobWorkspacePath(club, workspace.key, next);
}

/** Existing destinations keep their canonical route; source context may accompany it without replacing its club. */
export function workspaceDestinationPath(workspace: JobWorkspace, context = new URLSearchParams()) {
    const [path, query] = workspace.path.split('?');
    const next = new URLSearchParams(context);
    next.delete('tool'); next.delete('deskTab');
    new URLSearchParams(query).forEach((value, key) => next.set(key, value));
    return `${path}${next.size ? `?${next}` : ''}`;
}
