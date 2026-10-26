import type { Commit } from './upToDate';
import type { Release } from './whichVersion';

/**
 * Which GrassKickZ projects sit in a folder on this computer, read in the browser through the folder picker (Chrome
 * and Edge). Only folder names and git's small text files are read (.git/config, HEAD, refs, packed-refs) plus the
 * names of the database migrations; nothing is uploaded. Git on the computer stays the judge: the update message
 * checks everything again there.
 */

/** The part of a browser folder handle this needs, so tests can hand in a plain object. */
export interface Folder {
    readonly kind: 'directory';
    readonly name: string;
    values(): AsyncIterable<Folder | { readonly kind: 'file'; readonly name: string }>;
    getDirectoryHandle(name: string): Promise<Folder>;
    getFileHandle(name: string): Promise<{ getFile(): Promise<{ text(): Promise<string> }> }>;
}

export type ProjectKind = 'BACKEND' | 'WEB' | 'AGENT_DOLA' | 'OLD_PROJECT';
export interface FoundProject {
    /** From the picked folder down, e.g. "IdeaProjects/GrassKickZ". */
    path: string;
    kind: ProjectKind;
    /** "owner/name" of the origin remote on GitHub, credentials never kept. */
    remote: string | null;
    git: 'REPO' | 'WORKTREE' | 'NONE';
    branch: string | null;
    head: string | null;
    /** The newest database migration number, for a backend. */
    schema: number | null;
}

/** Folders never worth opening: build output, dependencies, caches. Hidden folders are skipped too. */
const SKIP = new Set(['node_modules', 'build', 'dist', 'out', 'output', 'target', 'bin', 'obj', 'vendor', 'AppData', 'Library', 'Applications', 'Windows', 'Program Files', 'Program Files (x86)']);
const MAX_DEPTH = 3;
const MAX_FOLDERS = 400;

const dir = async (from: Folder, ...path: string[]) => {
    let at: Folder | null = from;
    for (const name of path) at = at ? await at.getDirectoryHandle(name).catch(() => null) : null;
    return at;
};
const text = async (from: Folder, ...path: string[]) => {
    const parent = await dir(from, ...path.slice(0, -1));
    if (!parent) return null;
    try { return await (await (await parent.getFileHandle(path.at(-1) as string)).getFile()).text(); } catch { return null; }
};

/** "https://token@github.com/Owner/Repo.git" or "git@github.com:Owner/Repo.git" → "Owner/Repo"; anything else → null. */
export function githubRepo(url: string) {
    const match = /github\.com[:/]+([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i.exec(url.trim());
    return match ? `${match[1]}/${match[2]}` : null;
}

/** The origin remote's URL in a .git/config, or the first remote's when there is no origin. */
export function remoteUrl(config: string) {
    const remotes = [...config.matchAll(/\[remote "([^"]+)"\]([^[]*)/g)].map(([, name, body]) => ({ name, url: /^\s*url\s*=\s*(.+)$/m.exec(body)?.[1]?.trim() ?? null }));
    return (remotes.find(remote => remote.name === 'origin') ?? remotes[0])?.url ?? null;
}

/** The branch and commit HEAD points at: a loose ref, then packed-refs; a detached HEAD is the commit itself. */
async function headOf(git: Folder) {
    const head = (await text(git, 'HEAD'))?.trim() ?? '';
    const ref = /^ref:\s*(refs\/heads\/(.+))$/.exec(head);
    if (!ref) return { branch: null, head: /^[0-9a-f]{40}$/.test(head) ? head : null };
    const loose = (await text(git, ...ref[1].split('/')))?.trim();
    const packed = (await text(git, 'packed-refs'))?.split('\n').find(line => line.endsWith(` ${ref[1]}`))?.split(' ')[0];
    const id = loose || packed || null;
    return { branch: ref[2], head: id && /^[0-9a-f]{40}$/.test(id) ? id : null };
}

async function newestMigration(project: Folder) {
    const migrations = await dir(project, 'src', 'main', 'resources', 'db', 'migration');
    if (!migrations) return null;
    let newest: number | null = null;
    for await (const entry of migrations.values()) {
        const number = /^V(\d+)/.exec(entry.name)?.[1];
        if (number) newest = Math.max(newest ?? 0, Number(number));
    }
    return newest;
}

/** What one folder is, or null when it is not a GrassKickZ project. */
export async function inspect(folder: Folder, path: string): Promise<FoundProject | null> {
    const gitFolder = await dir(folder, '.git');
    const git: FoundProject['git'] = gitFolder ? 'REPO' : await text(folder, '.git') !== null ? 'WORKTREE' : 'NONE';
    const repo = gitFolder ? text(gitFolder, 'config').then(config => config ? githubRepo(remoteUrl(config) ?? '') : null) : Promise.resolve(null);
    // A backend has the talanti Java package; a web app has the Dola feature folder, at its root or under frontend/.
    const [remote, backend, web, nestedWeb] = await Promise.all([repo, dir(folder, 'src', 'main', 'java', 'ge', 'dola', 'talanti'),
        dir(folder, 'src', 'features', 'dola'), dir(folder, 'frontend', 'src', 'features', 'dola')]);
    const name = remote?.split('/')[1]?.toLowerCase();
    const kind: ProjectKind | null = name === 'agentdola' ? 'AGENT_DOLA'
        : backend && nestedWeb && name !== 'grasskickz' ? 'OLD_PROJECT'
        : name === 'grasskickz' || backend ? 'BACKEND'
        : name === 'frontend' || nestedWeb || web ? 'WEB'
        : null;
    if (!kind) return null;
    const at = gitFolder ? await headOf(gitFolder) : { branch: null, head: null };
    return { path, kind, remote, git, ...at, schema: kind === 'WEB' ? null : await newestMigration(folder) };
}

/**
 * Every GrassKickZ project in a folder and up to three levels below it, without opening a project's own subfolders.
 * A picked project folder is found as itself.
 */
export async function scanFolder(root: Folder): Promise<FoundProject[]> {
    const found: FoundProject[] = [];
    const queue: { folder: Folder; path: string; depth: number }[] = [{ folder: root, path: root.name, depth: 0 }];
    for (let opened = 0; queue.length && opened < MAX_FOLDERS; opened += 1) {
        const { folder, path, depth } = queue.shift() as (typeof queue)[number];
        const project = await inspect(folder, path).catch(() => null);
        if (project) { found.push(project); continue; }
        if (depth >= MAX_DEPTH) continue;
        try {
            for await (const entry of folder.values()) {
                if (entry.kind === 'directory' && !entry.name.startsWith('.') && !SKIP.has(entry.name)) queue.push({ folder: entry, path: `${path}/${entry.name}`, depth: depth + 1 });
            }
        } catch { /* a folder the browser may not open is skipped */ }
    }
    return found;
}

/** The browser's folder picker, where it exists (Chrome and Edge on a computer). */
type Picker = (options?: { mode?: 'read'; id?: string }) => Promise<Folder>;
export const canScan = () => typeof window !== 'undefined' && typeof (window as unknown as { showDirectoryPicker?: Picker }).showDirectoryPicker === 'function';
export const pickFolder = () => (window as unknown as { showDirectoryPicker: Picker }).showDirectoryPicker({ mode: 'read', id: 'gk-projects' });

export type ProjectState = 'CURRENT' | 'BEHIND' | 'OFF_LINE' | 'OTHER_PROJECT' | 'UNKNOWN';
export interface ProjectStanding { state: ProjectState; release: number | null; behind: number }

/**
 * Where a found project stands against the newest commits this page knows for its repository (newest first, as the
 * build listed them): up to date, a number of changes behind (and the newest release at or below it), commits the
 * list does not know (own work, another branch, or older than the list), or another project altogether.
 */
export function projectStanding(project: FoundProject, commits: Commit[], releases: Release[]): ProjectStanding {
    if (project.kind === 'AGENT_DOLA' || project.kind === 'OLD_PROJECT') return { state: 'OTHER_PROJECT', release: null, behind: 0 };
    if (!project.head || commits.length === 0) return { state: 'UNKNOWN', release: null, behind: 0 };
    const side = project.kind === 'BACKEND' ? 'backend' : 'web';
    const at = commits.findIndex(commit => commit.id === project.head);
    if (at < 0) return { state: 'OFF_LINE', release: releases.find(release => release[side] === project.head)?.number ?? null, behind: 0 };
    const listed = (release: Release) => commits.findIndex(commit => commit.id === release[side]);
    const release = releases.filter(r => listed(r) >= at).sort((a, b) => b.number - a.number)[0]?.number ?? null;
    const behind = commits.slice(0, at).filter(commit => !commit.merge).length;
    return { state: behind === 0 ? 'CURRENT' : 'BEHIND', release, behind };
}
