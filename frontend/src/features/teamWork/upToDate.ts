/** One commit as baked into a build: full id, ISO date, author, title, and whether it is a merge. */
export interface Commit { id: string; date: string; author: string; title: string; merge: boolean }
/** A repository's branch and last commits at build time; `known` is false when it was built without git. */
export interface Repo { known: boolean; branch?: string | null; commits?: Commit[] }
export type RepoKey = 'backend' | 'web';

export const BRANCH = 'codex/real-backend-integration-20261017';
export const REPOS: Record<RepoKey, { slug: string }> = { backend: { slug: 'dola165/GrassKickZ' }, web: { slug: 'dola165/Frontend' } };

declare const __GIT_HISTORY__: Repo | undefined;
/** The web app's own history, baked into this bundle by vite.config.ts. */
export const webHistory = (): Repo => (typeof __GIT_HISTORY__ === 'object' && __GIT_HISTORY__ ? __GIT_HISTORY__ : { known: false });

export const short = (id: string) => id.slice(0, 7);

/** "Merge branch 'refs/heads/golive/x' into …" → "golive/x"; null for an ordinary commit. */
export function mergedBranch(commit: Commit) {
    const match = /^Merge (?:branch|remote-tracking branch) '(?:refs\/heads\/)?([^']+)'/.exec(commit.title) ?? /^Merge pull request #\d+ from \S+?\/(\S+)/.exec(commit.title);
    return commit.merge || match ? match?.[1] ?? '' : null;
}

/** A pasted or chosen id that is plausibly a commit: 7 to 40 hex characters. */
export const commitId = (value: string) => { const id = value.trim().toLowerCase(); return /^[0-9a-f]{7,40}$/.test(id) ? id : null; };

/**
 * What a computer on `mine` is missing: the commits newer than it, newest first. `found` is false when no version is
 * picked, or the picked one is not among the last commits (then everything listed is missing, and maybe more).
 */
export function missing(repo: Repo, mine: string | null): { commits: Commit[]; found: boolean; upToDate: boolean } {
    const commits = repo.commits ?? [];
    const id = mine ? commitId(mine) : null;
    const at = id ? commits.findIndex(commit => commit.id.startsWith(id)) : -1;
    if (at < 0) return { commits, found: false, upToDate: false };
    return { commits: commits.slice(0, at), found: true, upToDate: at === 0 };
}

/** Commits by local day, newest day first, keeping their order. */
export function byDay(commits: (Commit & { repo: RepoKey })[]) {
    const days = new Map<string, (Commit & { repo: RepoKey })[]>();
    for (const commit of [...commits].sort((a, b) => b.date.localeCompare(a.date))) {
        const at = new Date(commit.date);
        const key = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
        days.set(key, [...(days.get(key) ?? []), commit]);
    }
    return [...days.entries()];
}
