import type { FoundProject, ProjectStanding } from './computerScan';
import { BRANCH, REPOS, short } from './upToDate';

/** What the computer should reach: a release's two commits, or the newest commits the page knows. */
export interface Target { release: number | null; backend: string | null; web: string | null }
export type Checked = FoundProject & ProjectStanding;

const KIND: Record<FoundProject['kind'], string> = {
    BACKEND: 'backend', WEB: 'web app', AGENT_DOLA: 'the old AgentDola project', OLD_PROJECT: 'an old whole project (a backend with the web app inside)',
};

/** One found copy in the message's words; git on the computer checks it again. */
export function foundLine(project: Checked) {
    const where = project.git === 'WORKTREE' ? 'a git worktree' : project.git === 'NONE' ? 'files without git'
        : `${project.branch ?? 'a detached HEAD'}${project.head ? ` at ${short(project.head)}` : ''}`;
    const state = {
        CURRENT: `up to date${project.release ? ` (release ${project.release})` : ''}`,
        BEHIND: `${project.release ? `release ${project.release}, ` : ''}${project.behind} ${project.behind === 1 ? 'change' : 'changes'} behind`,
        OFF_LINE: 'has commits the latest version does not know: my own work, another branch, or older than the page can see',
        OTHER_PROJECT: `a different project${project.schema ? `, database migrations up to V${project.schema}` : ''}: port my work, do not update it`,
        UNKNOWN: 'not known from the browser',
    }[project.state];
    return `- ${project.path}: ${KIND[project.kind]}, ${where}; ${state}.`;
}

/**
 * The message for Claude or Codex on a teammate's computer. It finds every copy of the project (also old ones in
 * another repository), backs up the person's own work before touching anything, updates our copies without ever
 * discarding work, ports work from a different project onto today's code instead of updating it, checks the result
 * and reports what was found and where each piece of work is now. It asks nothing unless work would be lost.
 */
export function updateMessage(target: Target, found: { folder: string; projects: Checked[] } | null) {
    const reach = (commit: string | null) => commit ? `at least commit ${short(commit)}` : 'its newest commit';
    return [
        'Please bring the GrassKickZ code on this computer up to the latest version without losing anything I made. Work it out yourself; ask me only if something would otherwise be lost.',
        '',
        `The latest version${target.release ? ` is release ${target.release}` : ''}, both on the branch ${BRANCH}:`,
        `- Backend: github.com/${REPOS.backend.slug}, ${reach(target.backend)}.`,
        `- Web app: github.com/${REPOS.web.slug} (the app is in its frontend/ folder), ${reach(target.web)}.`,
        ...(found ? ['', found.projects.length
            ? `The Team work page looked in my folder "${found.folder}" and found (it read only folder names and git's text files, so check each again):`
            : `The Team work page looked in my folder "${found.folder}" and found no copy there.`, ...found.projects.map(foundLine)] : []),
        '',
        '1. Find every copy. Also look in my home folder and the usual places (IdeaProjects, WebstormProjects, Projects, Desktop, Documents, Downloads) for folders whose git remote is dola165/GrassKickZ, dola165/Frontend or cotnetavkhelidzed-code/AgentDola, for their git worktrees (`git worktree list`), and for copies without git that contain src/main/java/ge/dola/talanti or frontend/src/features. Do not search system folders.',
        `2. Understand each copy before touching it. Run \`git fetch\` (do not pull yet). Note its project, branch, the releases it contains (\`git merge-base --is-ancestor <release commit> HEAD\`), how far it is behind origin/${BRANCH}, and my own work: commits on no remote branch (\`git log HEAD --not --remotes --oneline\`), uncommitted and untracked files (\`git status --porcelain\`) and stashes (\`git stash list\`).`,
        '3. Back up first. Make the folder GrassKickZ-backups/<today> in my home folder. For each copy with any work of mine: `git bundle create <backup>/<copy>.bundle --all`, `git diff HEAD > <backup>/<copy>-uncommitted.patch`, and copy its untracked files there, keeping their paths. Zip a copy without git, leaving out node_modules, build and dist. In no copy delete, reset, clean, rebase, force, or drop a stash.',
        '4. Bring each copy forward:',
        `    a. Our project with nothing of mine: switch to ${BRANCH} and run \`git pull --ff-only\`.`,
        `    b. Our project with work of mine: commit it on a new branch my-work/<today>-<topic> (never on ${BRANCH} itself), then merge origin/${BRANCH} into that branch. Resolve conflicts so both intentions survive; where they truly contradict, keep the latest version in the file and save mine in the backup folder with a note.`,
        '    c. A different project (the old AgentDola repository, or a copy from before release 1, whose database migrations stop far below ours): leave it exactly as it is and port my work instead.',
        '        - Find what I made there: my commits and the files I changed since it started (compare with its first commit, or with the history it shares with GrassKickZ). Describe it as features in plain words.',
        `        - Rebuild each feature in our project, on a branch port/<feature> cut from origin/${BRANCH}, in a new git worktree. Use today's API (api-spec/openapi.yaml), services, screens and database; never copy old files over new ones. A database change takes the next free migration number.`,
        '        - Keep everything it could do. What cannot be rebuilt goes on a list with the reason.',
        '        - Agent Dola: the newest Dola work is the dola-on-baseline branch of dola165/GrassKickZ, unless my copy is newer. Rebuild its tools on today\'s services as the backend\'s docs/AGENT_DOLA.md describes.',
        '5. Check. In every copy you changed, the backend builds (`./gradlew check :classes :testClasses -x test`) and the tests for what changed pass. In the web app run `npm ci` only if package-lock.json changed, then `npm test -- <changed paths>`. Restart dev servers that were running, so the What changed page sees the new version.',
        `6. Push nothing, merge nothing into ${BRANCH}, release nothing and delete nothing. Leave the new branches on this computer for me.`,
        '7. Report in plain words:',
        '    - each copy: what it was (release, how far behind, my own work) and what you did;',
        '    - nothing lost: each commit and changed file of mine, and where it is now;',
        '    - for a port: each feature, rebuilt, changed or not possible, and why;',
        '    - whether this computer was already up to date before you started;',
        '    - anything I should look at, one line each.',
    ].join('\n');
}
