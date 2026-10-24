import type { Detail, PlanView, WorkEnd, WorkItem, WorkStatus } from './api';

/** Each status as the paste format writes it. */
export const STATUS_WORDS: Record<WorkStatus, string> = { PLANNED: 'planned', IN_PROGRESS: 'in progress', NEEDS_LOOK: 'needs your look', ACCEPTED: 'accepted', LIVE: 'live', BLOCKED: 'blocked', CANCELLED: 'cancelled' };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const oneLine = (text: string) => text.replace(/\s+/g, ' ').replace(/\|/g, '/').trim();
const keys = (item: WorkItem, kind: WorkItem['links'][number]['kind']) => item.links.filter(link => link.kind === kind).map(link => link.task.key);

function end(value: WorkEnd) {
    if (value.kind === 'DATE' && value.date) return `ends ${value.date}`;
    if (value.kind === 'ABOUT' && value.amount && value.unit) return `ends ~${value.amount} ${value.unit.toLowerCase()}`;
    if (value.kind === 'POSSIBLY' && value.date) return `ends possibly ${MONTHS[Number(value.date.slice(5, 7)) - 1]} ${value.date.slice(0, 4)}`;
    return 'ends don\'t know';
}

function task(item: WorkItem, detail: Detail | undefined, hasSteps: boolean, indent: string) {
    const tags = [STATUS_WORDS[item.status], ...(item.priority ? [item.priority.toLowerCase()] : []), ...(item.small ? ['small'] : [])].join(', ');
    const fields = [
        `${item.key} ${item.title}`,
        item.startedOn && `started ${item.startedOn}`,
        end(item.end),
        // A percent that follows the steps stays theirs: writing it back would fix it by hand.
        item.percent != null && !(item.percentFromSteps && hasSteps) && `${item.percent}%`,
        item.description && `desc: ${oneLine(item.description)}`,
        item.doneMeans && `done: ${oneLine(item.doneMeans)}`,
        item.requestedBy?.name && `requested by ${item.requestedBy.name}`,
        keys(item, 'BLOCKED_BY').length > 0 && `blocked by ${keys(item, 'BLOCKED_BY').join(', ')}`,
        keys(item, 'RELATED').length > 0 && `related ${keys(item, 'RELATED').join(', ')}`,
        item.people.map(person => person.name).filter(Boolean).join(', '),
    ].filter(Boolean);
    const lines = [`${indent}- [${tags}] ${fields.join(' | ')}`];
    for (const comment of detail?.comments.slice(-3) ?? [])
        lines.push(`${indent}  # ${comment.author?.name ?? 'Someone'}, ${comment.createdAt.slice(0, 10)}: ${oneLine(comment.body)}`);
    if (detail?.media.length)
        lines.push(`${indent}  # files: ${detail.media.map(media => `${media.kind === 'VIDEO' ? 'video' : 'picture'} ${media.url.split('/').pop()}`).join(', ')}`);
    return lines;
}

/**
 * A plan in the "Paste from AI" format: each task with its key, percent, dates, people, done means and links, its
 * last three comments and the names of its files as "#" lines the paste skips. Pasting it back matches every task
 * by key (or name) and updates it.
 */
export function planAsText(view: PlanView, details: Map<number, Detail>) {
    const lines = [`plan: ${view.plan.name}`, '# Lines starting with # are notes: the last comments and files. Tasks match by key or name; nothing is deleted.'];
    for (const node of view.tasks) {
        lines.push(...task(node.item, details.get(node.item.id), node.steps.length > 0, ''));
        for (const step of node.steps) lines.push(...task(step, details.get(step.id), false, '  '));
    }
    return lines.join('\n');
}

const refLine = (ref: WorkItem['waitingOn'][number]) => `${ref.key} ${ref.title} (${STATUS_WORDS[ref.status]})`;

/**
 * One task as the brief for a worker: its key and what done means first, where it stands, links and open questions,
 * its steps, what was tested so far, the last comments and files, a link back, and how to report so the reply
 * pastes straight into Paste report.
 */
export function taskAsText(detail: Detail, link: string, plan?: string) {
    const item = detail.item;
    const where = [
        STATUS_WORDS[item.status],
        item.percent != null && `${item.percent}%`,
        item.priority && `priority ${item.priority.toLowerCase()}`,
        item.small && 'a small fix',
        item.requestedBy?.name && `requested by ${item.requestedBy.name}`,
        plan && `in the plan "${plan}"`,
    ].filter(Boolean).join(', ');
    const lines = [
        `Team work ${item.parentId != null ? 'step' : 'task'} ${item.key}: ${item.title}`,
        `Done means: ${item.doneMeans ? oneLine(item.doneMeans) : 'not written yet; say what you take it to mean'}`,
        `Where it stands: ${where}`,
        `Link: ${link}`,
    ];
    const blockedBy = item.links.filter(l => l.kind === 'BLOCKED_BY'), blocks = item.links.filter(l => l.kind === 'BLOCKS'), related = item.links.filter(l => l.kind === 'RELATED');
    if (blockedBy.length) lines.push(`Blocked by: ${blockedBy.map(l => refLine(l.task) + (item.waitingOn.some(ref => ref.id === l.task.id) ? ', still waiting on it' : '')).join('; ')}`);
    if (blocks.length) lines.push(`Blocks: ${blocks.map(l => refLine(l.task)).join('; ')}`);
    if (related.length) lines.push(`Related: ${related.map(l => refLine(l.task)).join('; ')}`);
    const open = detail.questions.filter(question => question.answer == null);
    if (open.length) lines.push('Open questions for Beqa (not answered yet):', ...open.map(question => `- ${oneLine(question.text)}${question.options.length ? ` (${question.options.join(' / ')})` : ''}`));
    const answered = detail.questions.filter(question => question.answer != null);
    if (answered.length) lines.push('Answered:', ...answered.map(question => `- ${oneLine(question.text)} → ${oneLine(question.answer!)}`));
    if (item.description) lines.push(`What it is for: ${oneLine(item.description)}`);
    if (item.step) lines.push(`Current step: ${oneLine(item.step)}`);
    if (detail.steps.length) lines.push('Steps:', ...detail.steps.map(step => `- [${STATUS_WORDS[step.status]}] ${step.key} ${step.title}${step.percent != null ? ` (${step.percent}%)` : ''}`));
    if (item.tested) lines.push(`Tested so far: ${oneLine(item.tested)}`);
    if (item.branch || item.prUrl) lines.push(`Branch: ${[item.branch, item.prUrl].filter(Boolean).join(' · ')}`);
    if (item.commits) lines.push(`Commits so far: ${oneLine(item.commits)}`);
    if (detail.comments.length) lines.push('Comments:', ...detail.comments.slice(-10).map(comment => `- ${comment.author?.name ?? 'Someone'}, ${comment.createdAt.slice(0, 10)}: ${oneLine(comment.body)}`));
    if (detail.media.length) lines.push(`Files (open the link to see them): ${detail.media.map(media => `${media.kind === 'VIDEO' ? 'video' : 'picture'} ${media.url.split('/').pop()}`).join(', ')}`);
    lines.push('',
        'Please do this in the GrassKickZ repositories (frontend github.com/dola165/Frontend, backend github.com/dola165/GrassKickZ, live line codex/real-backend-integration-20261017), on a branch of its own, without deploying.',
        `Put the key ${item.key} in every commit message, so the commits link to the task.`,
        'When you are done, end your answer with a report I can paste into Team work\'s Paste report, one marker per line:',
        `report: ${item.key}`,
        'status: needs your look',
        'branch: the branch you worked on',
        'commits: the ids and titles',
        'summary: one line for the history',
        'tested: what passed; what you did not run, and why',
        'question: anything you need from Beqa | option | option');
    return lines.join('\n');
}
