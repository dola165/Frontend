/** One commit as baked into a build: full id, ISO date, author, title, and whether it is a merge. */
export interface Commit { id: string; date: string; author: string; title: string; merge: boolean }
/** A repository's branch and last commits at build time; `known` is false when it was built without git. */
export interface Repo { known: boolean; branch?: string | null; commits?: Commit[] }
export type RepoKey = 'backend' | 'web';

export const BRANCH = 'codex/real-backend-integration-20261017';
export const REPOS: Record<RepoKey, { slug: string; folder: string }> = {
    backend: { slug: 'dola165/GrassKickZ', folder: 'GrassKickZ' },
    web: { slug: 'dola165/Frontend', folder: 'Frontend (the app is in its frontend/ folder)' },
};

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

/**
 * The message for Claude or Codex on a colleague's computer: both repositories, the branch and the commits to reach;
 * keep any local work; fast-forward only; prove it with git log and git status; say whether it was already up to date
 * (the page can be wrong); summarise what changed; reinstall only when the lockfiles changed.
 */
export function updatePrompt(repos: Record<RepoKey, Repo>, live?: { release: number; backend: string; web: string }) {
    const target = (key: RepoKey) => {
        // A copy updates to the live release; the live site, or a page that cannot tell, to the newest commit it knows.
        if (live) return `at least commit ${short(live[key])} (release ${live.release}, what is live)`;
        const newest = repos[key].known ? repos[key].commits?.[0] : undefined;
        const merged = newest ? mergedBranch(newest) : null;
        const title = merged === null ? newest?.title : `merged: ${merged || 'a branch'}`;
        return newest ? `at least commit ${short(newest.id)} (“${title}”)` : 'the newest commit on the branch (the page could not tell which)';
    };
    return [
        'Please bring this computer up to date with the latest GrassKickZ code. Work carefully: never lose anyone’s work.',
        '',
        `Both repositories are on the branch ${BRANCH}:`,
        `- Backend: github.com/${REPOS.backend.slug} — reach ${target('backend')}.`,
        `- Frontend: github.com/${REPOS.web.slug} — reach ${target('web')}.`,
        '',
        'For each repository:',
        `1. Before anything else, check \`git status\` and \`git log origin/${BRANCH}..HEAD\` for uncommitted or unpushed work. Never discard it. If there is any, commit it, or stash it with a clear name (git stash push -u -m "before-update-<date>"), tell me exactly what you saved, and ask me before going on.`,
        `2. Switch to ${BRANCH} if needed, run \`git fetch origin\`, then \`git pull --ff-only\`. If a fast-forward is not possible, stop and tell me a merge is needed. Do not force, reset or rebase anything.`,
        '3. Confirm with `git log -1 --oneline` and `git status` that the computer is on that commit or past it (`git merge-base --is-ancestor <commit> HEAD` succeeds), and show me the output.',
        '4. Tell me plainly whether this computer was already up to date before you started, in case the page that wrote this message was wrong.',
        '5. Summarise in plain words what changed since the version this computer was on.',
        '6. Only if package-lock.json changed, run `npm ci` in the Frontend repository’s frontend/ folder. Only if build.gradle.kts, settings.gradle.kts, gradle.properties or the gradle/ folder changed, refresh Gradle in the backend (`./gradlew --refresh-dependencies build -x test`). Otherwise skip both.',
    ].join('\n');
}
