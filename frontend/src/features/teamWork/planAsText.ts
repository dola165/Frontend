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
        lines.push(`${indent}  # files: ${detail.media.map(media => `${media.kind.toLowerCase()} ${media.name ?? media.url.split('/').pop()}`).join(', ')}`);
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
