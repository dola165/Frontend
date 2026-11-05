import { apiClient, type AuthSessionRequestConfig } from '../../api/axiosConfig';
import { assertCurrentAuthSession, type AuthSessionId } from '../../utils/authStorage';
import { workspaceKeys, type JobWorkspace, type JobWorkspaceManifest, type ModuleScope } from './types';

const invalid = () => new Error('Could not confirm your club workspaces. Try again.');
const object = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid();
    return value as Record<string, unknown>;
};
export const positiveId = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const strings = (value: unknown): string[] => {
    if (!Array.isArray(value) || !value.every(item => typeof item === 'string' && item.trim())) throw invalid();
    return [...new Set(value)];
};
const ids = (value: unknown): number[] => {
    if (!Array.isArray(value) || !value.every(positiveId)) throw invalid();
    return [...new Set(value)];
};
const boolean = (value: unknown): boolean => { if (typeof value !== 'boolean') throw invalid(); return value; };
const name = (value: unknown): string => { if (typeof value !== 'string' || !value.trim()) throw invalid(); return value; };

function decodeScope(value: unknown): ModuleScope {
    const scope = object(value);
    const decoded = { module: name(scope.module), globalRead: boolean(scope.globalRead), globalWrite: boolean(scope.globalWrite), readSquadIds: ids(scope.readSquadIds), writeSquadIds: ids(scope.writeSquadIds) };
    if (decoded.globalWrite && !decoded.globalRead || !decoded.globalRead && decoded.writeSquadIds.some(id => !decoded.readSquadIds.includes(id))) throw invalid();
    return decoded;
}

/** Validate identity and navigation, including every module's own scope. Titles and the workspace union grant nothing. */
export function decodeJobWorkspaces(value: unknown, club: number, actor: number): JobWorkspaceManifest {
    const data = object(value);
    if (data.clubId !== club || data.actorId !== actor || !Array.isArray(data.workspaces)) throw invalid();
    const workspaces: JobWorkspace[] = [];
    const seen = new Set<string>();
    for (const item of data.workspaces) {
        const row = object(item);
        // A newer server destination has no implementation here yet; never guess its tools or route.
        if (!workspaceKeys.includes(row.key as JobWorkspace['key'])) continue;
        const key = row.key as JobWorkspace['key'];
        if (seen.has(key) || !['time', 'work', 'people'].includes(String(row.layout)) || !['working', 'prototype'].includes(String(row.maturity)) || !Array.isArray(row.moduleScopes)) throw invalid();
        seen.add(key);
        const modules = strings(row.modules), moduleScopes = row.moduleScopes.map(decodeScope);
        if (new Set(moduleScopes.map(s => s.module)).size !== moduleScopes.length || modules.length !== moduleScopes.length || modules.some(m => !moduleScopes.some(s => s.module === m))) throw invalid();
        const canonical = key === 'office' ? `/clubs/${club}/office` : key === 'squads' ? `/my-squads?clubId=${club}` : key === 'projects' ? `/projects?club=${club}` : null;
        const path = name(row.path);
        if (path !== (canonical ?? `/clubs/${club}/work/${key}`) && !(key === 'matches' && path === '/referees/me' && row.maturity === 'working')) throw invalid();
        const clubWide = boolean(row.clubWide), squadIds = ids(row.squadIds);
        if (clubWide !== (moduleScopes.length > 0 && moduleScopes.every(s => s.globalRead))) throw invalid();
        // Empty canonical destinations may be independently authorized (for example a referee or squad relationship).
        if (!canonical && path !== '/referees/me' && !moduleScopes.some(s => s.globalRead || s.readSquadIds.length)) continue;
        workspaces.push({ key, title: name(row.title), layout: row.layout as JobWorkspace['layout'], maturity: row.maturity as JobWorkspace['maturity'], jobTitles: strings(row.jobTitles), modules, squadIds, clubWide, path, moduleScopes });
    }
    return { clubId: club, actorId: actor, clubName: name(data.clubName), workspaces };
}

export async function getJobWorkspaces(club: number, actor: number, session: AuthSessionId, signal: AbortSignal) {
    assertCurrentAuthSession(session);
    const config = { signal, _authSessionId: session } satisfies AuthSessionRequestConfig;
    const { data } = await apiClient.get<unknown>(`/clubs/${club}/job-workspaces`, config);
    assertCurrentAuthSession(session);
    return decodeJobWorkspaces(data, club, actor);
}
