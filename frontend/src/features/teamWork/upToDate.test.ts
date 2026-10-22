import { describe, expect, it } from 'vitest';
import { BRANCH, byDay, mergedBranch, missing, updatePrompt, webHistory, type Commit, type Repo } from './upToDate';

const commit = (id: string, title: string, date: string, merge = false): Commit => ({ id: id.padEnd(40, '0'), date, author: 'Dola', title, merge });
const backend: Repo = { known: true, branch: BRANCH, commits: [
    commit('148b8c6d', 'Format the media files (spotless)', '2026-10-22T19:38:58+04:00'),
    commit('02896b0e', 'Merge branch \'refs/heads/golive/teamwork-5\' into codex/real-backend-integration-20261017', '2026-10-22T19:30:00+04:00', true),
    commit('9f8c21b8', 'Team work: only the team\'s own six accounts', '2026-10-21T19:15:26+04:00'),
] };
const web: Repo = { known: true, branch: BRANCH, commits: [commit('119093d6', 'Team panel follows the list', '2026-10-22T18:00:00+04:00')] };

describe('changes you are missing', () => {
    it('lists only what is newer than the picked version, by full or short id', () => {
        expect(missing(backend, '9f8c21b').commits.map(found => found.title)).toEqual(['Format the media files (spotless)', expect.stringMatching(/^Merge branch/)]);
        expect(missing(backend, '9F8C21B80000000000000000000000000000000').found).toBe(true);
        expect(missing(backend, '148b8c6d')).toEqual({ commits: [], found: true, upToDate: true });
    });

    it('treats no version, a bad id or one older than the list as missing everything shown', () => {
        expect(missing(backend, null)).toMatchObject({ found: false, upToDate: false });
        expect(missing(backend, 'not-a-commit').commits).toHaveLength(3);
        expect(missing(backend, 'abcdef1')).toMatchObject({ found: false });
        expect(missing({ known: false }, '148b8c6').commits).toEqual([]);
    });

    it('names merges by their branch and groups changes by day, newest first', () => {
        expect(mergedBranch(backend.commits![1])).toBe('golive/teamwork-5');
        expect(mergedBranch(backend.commits![0])).toBeNull();
        const days = byDay([...backend.commits!.map(found => ({ ...found, repo: 'backend' as const })), { ...web.commits![0], repo: 'web' as const }]);
        expect(days.map(([key, list]) => [key, list.length])).toEqual([['2026-10-22', 3], ['2026-10-21', 1]]);
    });

    it('says "not known" when the bundle has no git history (tests and Docker builds)', () => {
        expect(webHistory()).toEqual({ known: false });
    });
});

describe('the update prompt', () => {
    const prompt = updatePrompt({ backend, web });

    it('names both repositories, the branch and the commits to reach', () => {
        expect(prompt).toContain(`branch ${BRANCH}`);
        expect(prompt).toContain('github.com/dola165/GrassKickZ — reach at least commit 148b8c6');
        expect(prompt).toContain('github.com/dola165/Frontend — reach at least commit 119093d');
    });

    it('keeps local work, fast-forwards only, proves the result and asks whether it was already up to date', () => {
        expect(prompt).toMatch(/uncommitted or unpushed work\. Never discard it/);
        expect(prompt).toContain('git stash push -u -m "before-update-<date>"');
        expect(prompt).toContain('ask me before going on');
        expect(prompt).toContain('git pull --ff-only');
        expect(prompt).toMatch(/tell me a merge is needed\. Do not force, reset or rebase/);
        expect(prompt).toContain('`git log -1 --oneline` and `git status`');
        expect(prompt).toContain('whether this computer was already up to date before you started');
        expect(prompt).toContain('Summarise in plain words what changed');
        expect(prompt).toMatch(/Only if package-lock\.json changed, run `npm ci`/);
        expect(prompt).toMatch(/Only if build\.gradle\.kts.*refresh Gradle/);
    });

    it('still works when a build did not know its history', () => {
        expect(updatePrompt({ backend: { known: false }, web })).toContain('GrassKickZ — reach the newest commit on the branch');
    });
});
