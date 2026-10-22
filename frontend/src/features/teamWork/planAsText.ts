import type { Detail, RoadmapView, WorkEnd, WorkItem } from './api';

const STATUS: Record<WorkItem['status'], string> = { IN_PROGRESS: 'in progress', ON_HOLD: 'on hold', PLANNED: 'planned', FINISHED: 'finished' };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const oneLine = (text: string) => text.replace(/\s+/g, ' ').replace(/\|/g, '/').trim();

function end(value: WorkEnd) {
    if (value.kind === 'DATE' && value.date) return `ends ${value.date}`;
    if (value.kind === 'ABOUT' && value.amount && value.unit) return `ends ~${value.amount} ${value.unit.toLowerCase()}`;
    if (value.kind === 'POSSIBLY' && value.date) return `ends possibly ${MONTHS[Number(value.date.slice(5, 7)) - 1]} ${value.date.slice(0, 4)}`;
    return 'ends don\'t know';
}

function piece(item: WorkItem, detail: Detail | undefined, hasParts: boolean, indent: string) {
    const tags = [STATUS[item.status], ...(item.small ? ['small'] : [])].join(', ');
    const fields = [
        item.title,
        item.startedOn && `started ${item.startedOn}`,
        end(item.end),
        // A percent that follows the parts stays theirs: writing it back would fix it by hand.
        !(item.percentFromParts && hasParts) && `${item.percent}%`,
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
 * A plan in the "Paste from AI" format, with each piece's percent, dates and people, its last three comments and
 * the names of its files as "#" lines the paste skips. Pasting it back matches every piece by name and updates it.
 */
export function planAsText(view: RoadmapView, details: Map<number, Detail>) {
    const lines = [`plan: ${view.roadmap.name}`, '# Lines starting with # are notes: the last comments and files. Pieces match by name; nothing is deleted.'];
    for (const node of view.pieces) {
        lines.push(...piece(node.item, details.get(node.item.id), node.parts.length > 0, ''));
        for (const part of node.parts) lines.push(...piece(part, details.get(part.id), false, '  '));
    }
    return lines.join('\n');
}
