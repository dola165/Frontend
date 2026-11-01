export interface ModuleScope {
    module: string;
    globalRead: boolean;
    globalWrite: boolean;
    readSquadIds: number[];
    writeSquadIds: number[];
}

export const workspaceKeys = ['office', 'squads', 'projects', 'registration', 'money', 'kit', 'travel', 'media', 'player-file', 'safeguarding', 'scouting', 'facilities', 'matches', 'shared'] as const;
export type WorkspaceKey = typeof workspaceKeys[number];
export interface JobWorkspace {
    key: WorkspaceKey;
    title: string;
    layout: 'time' | 'work' | 'people';
    maturity: 'working' | 'prototype';
    jobTitles: string[];
    modules: string[];
    squadIds: number[];
    clubWide: boolean;
    path: string;
    moduleScopes: ModuleScope[];
}
export interface JobWorkspaceManifest {
    clubId: number;
    clubName: string;
    actorId: number;
    workspaces: JobWorkspace[];
}
