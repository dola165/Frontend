import { describe, expect, it } from 'vitest';
import { githubRepo, projectStanding, remoteUrl, scanFolder, type Folder, type FoundProject } from './computerScan';
import { BRANCH, type Commit } from './upToDate';
import { updateMessage } from './updateMessage';
import type { Release } from './whichVersion';

type Tree = { [name: string]: Tree | string };
/** A folder as the browser's picker hands it over, built from a plain object: a string is a file's text. */
const folder = (name: string, tree: Tree): Folder => ({
    kind: 'directory', name,
    async *values() { for (const [entry, value] of Object.entries(tree)) yield typeof value === 'string' ? { kind: 'file' as const, name: entry } : folder(entry, value); },
    async getDirectoryHandle(entry) { const value = tree[entry]; if (!value || typeof value === 'string') throw new DOMException(entry, 'NotFoundError'); return folder(entry, value); },
    async getFileHandle(entry) { const value = tree[entry]; if (typeof value !== 'string') throw new DOMException(entry, 'NotFoundError'); return { getFile: async () => ({ text: async () => value }) }; },
});
const id = (start: string) => start.padEnd(40, '0');
const talanti = { main: { java: { ge: { dola: { talanti: {} } } } } };
const migrations = (...names: string[]) => ({ resources: { db: { migration: Object.fromEntries(names.map(name => [name, ''])) } } });

const projects = folder('IdeaProjects', {
    GrassKickZ: {
        '.git': { config: '[core]\n\tbare = false\n[remote "origin"]\n\turl = https://ghp_secret@github.com/dola165/GrassKickZ.git\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n',
            HEAD: `ref: refs/heads/${BRANCH}\n`, refs: { heads: { codex: { 'real-backend-integration-20261017': `${id('b1')}\n` } } } },
        src: { main: { ...talanti.main, ...migrations('V114_1__approaches.sql', 'V207__team_chat.sql', 'README.md') } },
        node_modules: { nothing: {} },
    },
    AgentDola: {
        '.git': { config: '[remote "origin"]\n\turl = git@github.com:cotnetavkhelidzed-code/AgentDola.git\n', HEAD: 'ref: refs/heads/main\n', 'packed-refs': `# pack-refs\n${id('a9')} refs/heads/main\n` },
        src: { main: { ...talanti.main, ...migrations('V78__onboarding.sql', 'V12__clubs.sql') } },
        frontend: { src: { features: { dola: {} } } },
    },
    notes: { 'todo.txt': 'buy cones' },
    WebstormProjects: {
        Frontend: { '.git': 'gitdir: C:/Users/me/WebstormProjects/Frontend-main/.git/worktrees/Frontend\n', frontend: { src: { features: { dola: {} } } } },
        'web-copy': { src: { features: { dola: {} } } },
    },
});

describe('the GrassKickZ copies in a folder', () => {
    it('finds each copy, its kind, branch, commit and newest migration, without the remote\'s credentials', async () => {
        const found = await scanFolder(projects);
        expect(found).toEqual([
            { path: 'IdeaProjects/GrassKickZ', kind: 'BACKEND', remote: 'dola165/GrassKickZ', git: 'REPO', branch: BRANCH, head: id('b1'), schema: 207 },
            { path: 'IdeaProjects/AgentDola', kind: 'AGENT_DOLA', remote: 'cotnetavkhelidzed-code/AgentDola', git: 'REPO', branch: 'main', head: id('a9'), schema: 78 },
            { path: 'IdeaProjects/WebstormProjects/Frontend', kind: 'WEB', remote: null, git: 'WORKTREE', branch: null, head: null, schema: null },
            { path: 'IdeaProjects/WebstormProjects/web-copy', kind: 'WEB', remote: null, git: 'NONE', branch: null, head: null, schema: null },
        ]);
        expect(JSON.stringify(found)).not.toContain('ghp_secret');
    });

    it('a picked project folder is found as itself', async () => {
        const [only] = await scanFolder(folder('GrassKickZ', { src: { main: talanti.main } }));
        expect(only).toMatchObject({ path: 'GrassKickZ', kind: 'BACKEND', git: 'NONE' });
    });

    it('reads GitHub remotes in https and ssh form, origin first', () => {
        expect(githubRepo('https://user:token@github.com/dola165/Frontend.git')).toBe('dola165/Frontend');
        expect(githubRepo('git@github.com:dola165/GrassKickZ')).toBe('dola165/GrassKickZ');
        expect(githubRepo('https://gitlab.com/x/y.git')).toBeNull();
        expect(remoteUrl('[remote "fork"]\n\turl = a\n[remote "origin"]\n\turl = b\n')).toBe('b');
    });
});

describe('where a found copy stands', () => {
    const commit = (start: string, merge = false): Commit => ({ id: id(start), date: '2026-10-26T10:00:00+04:00', author: 'Dola', title: start, merge });
    const commits = [commit('c3'), commit('c2', true), commit('c1'), commit('c0')];
    const release = (number: number, backend: string): Release => ({ number, date: '2026-10-26', backend: id(backend), web: id('f0'), summary: null, tasks: [] });
    const releases = [release(6, 'c3'), release(5, 'c1')];
    const backend = (head: string | null, kind: FoundProject['kind'] = 'BACKEND'): FoundProject => ({ path: 'GrassKickZ', kind, remote: null, git: 'REPO', branch: BRANCH, head, schema: null });

    it('up to date, or behind by the changes newer than it (merges left out) with the release it has', () => {
        expect(projectStanding(backend(id('c3')), commits, releases)).toEqual({ state: 'CURRENT', release: 6, behind: 0 });
        expect(projectStanding(backend(id('c1')), commits, releases)).toEqual({ state: 'BEHIND', release: 5, behind: 1 });
        expect(projectStanding(backend(id('c0')), commits, releases)).toEqual({ state: 'BEHIND', release: null, behind: 2 });
    });

    it('a commit the list does not know, another project, or no commit at all', () => {
        expect(projectStanding(backend(id('dd')), commits, releases).state).toBe('OFF_LINE');
        expect(projectStanding(backend(id('c3'), 'AGENT_DOLA'), commits, releases).state).toBe('OTHER_PROJECT');
        expect(projectStanding(backend(null), commits, releases).state).toBe('UNKNOWN');
        expect(projectStanding(backend(id('c3')), [], releases).state).toBe('UNKNOWN');
    });
});

describe('the update message', () => {
    const target = { release: 6, backend: id('290a98d1'), web: id('8fde6f27') };
    const found = { folder: 'IdeaProjects', projects: [
        { path: 'IdeaProjects/GrassKickZ', kind: 'BACKEND' as const, remote: 'dola165/GrassKickZ', git: 'REPO' as const, branch: BRANCH, head: id('b1'), schema: 207, state: 'BEHIND' as const, release: 4, behind: 12 },
        { path: 'IdeaProjects/AgentDola', kind: 'AGENT_DOLA' as const, remote: 'cotnetavkhelidzed-code/AgentDola', git: 'REPO' as const, branch: 'main', head: id('a9'), schema: 78, state: 'OTHER_PROJECT' as const, release: null, behind: 0 },
    ] };

    it('names the release to reach and what the page found', () => {
        const message = updateMessage(target, found);
        expect(message).toContain(`The latest version is release 6, both on the branch ${BRANCH}:`);
        expect(message).toContain('github.com/dola165/GrassKickZ, at least commit 290a98d.');
        expect(message).toContain('github.com/dola165/Frontend (the app is in its frontend/ folder), at least commit 8fde6f2.');
        expect(message).toContain(`- IdeaProjects/GrassKickZ: backend, ${BRANCH} at b100000; release 4, 12 changes behind.`);
        expect(message).toContain('- IdeaProjects/AgentDola: the old AgentDola project, main at a900000; a different project, database migrations up to V78: port my work, do not update it.');
    });

    it('backs up first, never discards work, ports a different project instead of updating it, and pushes nothing', () => {
        const message = updateMessage(target, null);
        expect(message).not.toContain('The Team work page looked');
        expect(message).toContain('cotnetavkhelidzed-code/AgentDola');
        expect(message).toMatch(/3\. Back up first\..*git bundle create.*In no copy delete, reset, clean, rebase, force, or drop a stash\./);
        expect(message).toContain(`never on ${BRANCH} itself`);
        expect(message).toContain('leave it exactly as it is and port my work instead');
        expect(message).toContain('the dola-on-baseline branch of dola165/GrassKickZ');
        expect(message).toContain(`Push nothing, merge nothing into ${BRANCH}, release nothing and delete nothing.`);
        expect(message).toContain('nothing lost: each commit and changed file of mine, and where it is now');
    });

    it('without a known release, aims at the newest commits', () => {
        expect(updateMessage({ release: null, backend: null, web: id('8fde6f27') }, null)).toContain('github.com/dola165/GrassKickZ, its newest commit.');
    });
});
