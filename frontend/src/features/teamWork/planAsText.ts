import type { Detail, PlanView, WorkEnd, WorkItem } from './api';

const STATUS: Record<WorkItem['status'], string> = { IN_PROGRESS: 'in progress', ON_HOLD: 'on hold', PLANNED: 'planned', FINISHED: 'finished' };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const oneLine = (text: string) => text.replace(/\s+/g, ' ').replace(/\|/g, '/').trim();

function end(value: WorkEnd) {
    if (value.kind === 'DATE' && value.date) return `ends ${value.date}`;
    if (value.kind === 'ABOUT' && value.amount && value.unit) return `ends ~${value.amount} ${value.unit.toLowerCase()}`;
    if (value.kind === 'POSSIBLY' && value.date) return `ends possibly ${MONTHS[Number(value.date.slice(5, 7)) - 1]} ${value.date.slice(0, 4)}`;
    return 'ends don\'t know';
}

function task(item: WorkItem, detail: Detail | undefined, hasParts: boolean, indent: string) {
    const tags = [STATUS[item.status], ...(item.small ? ['small'] : [])].join(', ');
    const fields = [
        item.title,
        item.startedOn && `started ${item.startedOn}`,
        end(item.end),
        // A percent that follows the steps stays theirs: writing it back would fix it by hand.
        !(item.percentFromSteps && hasParts) && `${item.percent}%`,
        item.description && `desc: ${oneLine(item.description)}`,
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
 * A plan in the "Paste from AI" format, with each task's percent, dates and people, its last three comments and
 * the names of its files as "#" lines the paste skips. Pasting it back matches every task by name and updates it.
 */
export function planAsText(view: PlanView, details: Map<number, Detail>) {
    const lines = [`plan: ${view.plan.name}`, '# Lines starting with # are notes: the last comments and files. Tasks match by name; nothing is deleted.'];
    for (const node of view.tasks) {
        lines.push(...task(node.item, details.get(node.item.id), node.steps.length > 0, ''));
        for (const step of node.steps) lines.push(...task(step, details.get(step.id), false, '  '));
    }
    return lines.join('\n');
}

/**
 * One task (or finding) as a brief for Claude or Codex: what it is, where it stands, its steps, the last comments
 * and its files, a link back, and how to answer so the reply pastes straight into Paste from AI.
 */
export function taskAsText(detail: Detail, link: string, plan?: string) {
    const item = detail.item;
    const lines = [
        `Team work ${item.parentId != null ? 'step' : 'task'}: ${item.title}`,
        `Where it stands: ${STATUS[item.status]}, ${item.percent}%${item.small ? ', a small fix' : ''}${plan ? `, in the plan "${plan}"` : ''}`,
        `Link: ${link}`,
    ];
    if (item.description) lines.push(`What it is for: ${oneLine(item.description)}`);
    if (item.step) lines.push(`Current step: ${oneLine(item.step)}`);
    if (detail.steps.length) lines.push('Steps:', ...detail.steps.map(step => `- [${STATUS[step.status]}] ${step.title} (${step.percent}%)`));
    if (detail.comments.length) lines.push('Comments:', ...detail.comments.slice(-10).map(comment => `- ${comment.author?.name ?? 'Someone'}, ${comment.createdAt.slice(0, 10)}: ${oneLine(comment.body)}`));
    if (detail.media.length) lines.push(`Files (open the link to see them): ${detail.media.map(media => `${media.kind === 'VIDEO' ? 'video' : 'picture'} ${media.url.split('/').pop()}`).join(', ')}`);
    lines.push('',
        'Please look into this in the GrassKickZ repositories (frontend github.com/dola165/Frontend, backend github.com/dola165/GrassKickZ, live line codex/real-backend-integration-20261017): fix it or say what is needed, on a branch of its own, without deploying.',
        'When you are done, end your answer with a block I can paste into Team work\'s Paste from AI to update this task, for example:',
        ...(plan ? [`plan: ${plan}`] : []),
        `- [in progress] ${item.title} | 60% | desc: what was done and what is left`,
        '  - [finished] A step you completed',
        'Mark a task or step [delete] only if it should go.');
    return lines.join('\n');
}
