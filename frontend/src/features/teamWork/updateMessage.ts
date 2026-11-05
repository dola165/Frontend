import type { FoundProject, ProjectStanding } from './computerScan';
import { BRANCH, REPOS, short } from './upToDate';

/** What the computer should reach: a release's two commits, or the newest commits the page knows. */
export interface Target { release: number | null; backend: string | null; web: string | null }
export type Checked = FoundProject & ProjectStanding;
/** Who the message speaks for: what they work on and the tasks they're on, so it can say what changed for them. */
export interface Who { name: string | null; responsibility: string | null; tasks: { key: string; title: string }[] }

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
        OTHER_PROJECT: `a different project${project.schema ? `, database migrations up to V${project.schema}` : ''}: leave it as it is`,
        UNKNOWN: 'not known from the browser',
    }[project.state];
    return `- ${project.path}: ${KIND[project.kind]}, ${where}; ${state}.`;
}

const reach = (commit: string | null) => commit ? `at commit ${short(commit)} or newer` : 'its newest commit';
const repositories = (target: Target) => [
    `- Backend: github.com/${REPOS.backend.slug}, ${reach(target.backend)}.`,
    `- Web app: github.com/${REPOS.web.slug} (the app is in its frontend/ folder), ${reach(target.web)}.`,
];

function introduction(who: Who | null | undefined) {
    if (!who) return [];
    const said = [
        who.name || who.responsibility ? `${who.name ? `I'm ${who.name}` : 'I'}${who.responsibility ? `${who.name ? ', and I' : ''} work on ${who.responsibility}` : ''}.` : '',
        who.tasks.length ? `My open tasks in Team work: ${who.tasks.map(task => `${task.key} ${task.title}`).join('; ')}.` : '',
    ].filter(Boolean);
    return said.length ? ['', said.join(' ')] : [];
}

/**
 * The message for Claude or Codex on a teammate's computer. It brings our copies up to date, backing up the person's own
 * work first and never discarding any, and says what changed for them. A different project stays untouched: moving work
 * out of one is a job of its own, with its own message. It asks nothing unless work would be lost.
 */
export function updateMessage(target: Target, found: { folder: string; projects: Checked[] } | null, who?: Who | null) {
    const mine = who?.responsibility ? `my area (${who.responsibility}) and my tasks` : who?.tasks.length ? 'my tasks' : 'what I work on';
    return [
        `Please bring the GrassKickZ code on this computer up to ${target.release ? `release ${target.release}` : 'the latest version'} without losing anything I made. Work it out yourself; ask me only if something would otherwise be lost.`,
        ...introduction(who),
        '',
        `The target, both on the branch ${BRANCH}:`,
        ...repositories(target),
        ...(found ? ['', found.projects.length
            ? `The Team work page looked in my folder "${found.folder}" and found (it read only folder names and git's text files, so check each again):`
            : `The Team work page looked in my folder "${found.folder}" and found no copy there.`, ...found.projects.map(foundLine)] : []),
        '',
        `1. Find my copies. Look in my home folder and the usual places (IdeaProjects, WebstormProjects, Projects, Desktop, Documents, Downloads) for folders whose git remote is ${REPOS.backend.slug} or ${REPOS.web.slug}, and for their git worktrees (\`git worktree list\`). Do not search system folders. If there's no copy of one of them, clone it into the folder that holds my other projects, on ${BRANCH}.`,
        `2. Look before you touch. In each copy run \`git fetch\` (do not pull yet). Note its branch, how far behind origin/${BRANCH} it is, and my own work: commits on no remote branch (\`git log HEAD --not --remotes --oneline\`), uncommitted and untracked files (\`git status --porcelain\`) and stashes (\`git stash list\`).`,
        `3. A copy with nothing of mine: switch to ${BRANCH} and run \`git pull --ff-only\`.`,
        `4. A copy with work of mine: back it up first, in GrassKickZ-backups/<today> in my home folder (\`git bundle create <backup>/<copy>.bundle --all\`, \`git diff HEAD > <backup>/<copy>-uncommitted.patch\`, and its untracked files, keeping their paths). Then commit it on a new branch my-work/<today>-<topic>, never on ${BRANCH} itself, and merge origin/${BRANCH} into that branch. Resolve conflicts so both intentions survive; where they truly contradict, keep the latest version in the file and save mine in the backup folder with a note. In no copy delete, reset, clean, rebase, force, or drop a stash.`,
        '5. A different project (the old cotnetavkhelidzed-code/AgentDola repository, or a copy from before release 1, whose database migrations stop far below ours): leave it exactly as it is and move nothing. Tell me it\'s there and, in a few lines, what\'s in it that our code lacks. Moving work over is a job of its own; the What changed page has a separate message for it.',
        '6. Check. In every copy you changed, the backend builds (`./gradlew check :classes :testClasses -x test -x validateOpenApiSpec`) and the web app builds (`npm ci` only if package-lock.json changed, then `npm run build` in frontend/). Restart dev servers that were running, so the What changed page sees the new version.',
        `7. Push nothing, merge nothing into ${BRANCH}, release nothing and delete nothing. Leave any new branches on this computer for me.`,
        '8. Tell me in plain words, briefly:',
        '    - each copy: where it was and where it is now, or that it was already up to date;',
        '    - nothing lost: each commit and changed file of mine, and where it is now;',
        `    - what changed for me: read the commits between my old version and the new one, and say in a few lines what touches ${mine};`,
        '    - anything I should look at, one line each.',
        '',
        'docs/AI_WORKER_GUIDE.md in the backend says how to run the whole app locally and how we work, if I ask you to go on.',
    ].join('\n');
}

/**
 * Moving work out of a different project onto today's code. It's a project in itself, so the message only looks and
 * reports first, and rebuilds only what the person then chooses.
 */
export function moveWorkMessage(target: Target, found: Checked[]) {
    return [
        'I have work in a project that isn\'t GrassKickZ\'s main code. Please help me move it onto today\'s code without losing anything. It\'s a big job, so do it in two parts and stop after the first.',
        ...(found.length ? ['', 'Where it is:', ...found.map(project => `- ${project.path}`)] : []),
        '',
        `Today's code, both on the branch ${BRANCH}:`,
        ...repositories(target),
        'If this computer has no copy, clone them. docs/AI_WORKER_GUIDE.md in the backend says how to run the whole app and how we work; read it first.',
        '',
        'Part 1: look, and change nothing anywhere.',
        `1. Find the project${found.length ? ' above, and any other like it' : ''}: folders whose git remote is cotnetavkhelidzed-code/AgentDola, or copies from before release 1, whose database migrations stop far below ours. Do not search system folders.`,
        '2. Find what I made there: my commits and the files I changed since it started (compare with its first commit, or with the history it shares with GrassKickZ), and anything uncommitted. Describe it as features in plain words.',
        '3. Start with what exists only there, in no branch of ours: that\'s what could be lost, and the rest is a choice, not a rescue. Then compare each feature with today\'s code: already there, there but different, or missing. Read before you judge. Agent Dola today is in the backend\'s src/main/java/ge/dola/talanti/agentdola/ (guide: docs/AGENT_DOLA.md) and the web app\'s frontend/src/features/teamWork/TeamWorkDola*; the newest Dola work is also on the dola-on-baseline branch of dola165/GrassKickZ.',
        '4. Stop and show me the list: each feature, where it stands, how big moving it is, and what you\'d move first. End with the missing ones as lines I can paste into a Team work plan, one per feature: `- [planned] A short name | desc: what it does`.',
        '',
        'Part 2: only when I say which features.',
        `- Back up first, in GrassKickZ-backups/<today> in my home folder (\`git bundle create <backup>/<copy>.bundle --all\`, and uncommitted work as a patch). Leave the old project exactly as it is.`,
        `- Rebuild each feature on a branch port/<feature> cut from origin/${BRANCH}, in a new git worktree. Use today's API (api-spec/openapi.yaml), services, screens and database; never copy old files over new ones. A database change takes the next free migration number.`,
        '- Keep everything the feature could do. What can\'t be rebuilt goes on a list with the reason. Run it and test it as the guide says.',
        `- Merge nothing into ${BRANCH}, release nothing and delete nothing. Push the port/ branches only when I say.`,
        '- Report each feature in plain words: rebuilt, changed or not possible, and why.',
    ].join('\n');
}
