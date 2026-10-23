import type { LucideIcon } from 'lucide-react';
import { Ban, Check, CircleHelp, Eye, Play, Plus, Reply, Rocket, Undo2 } from 'lucide-react';
import { dayKey } from '../schedule/board/scheduleRange';
import type { Person, Plan, WorkItem, WorkNode, WorkStatus } from './api';
import type { Timeline, WorkEvent } from './overviewApi';
import { nodeMatches, type Who } from './planPeople';

type Copy = (en: string, ka: string) => string;

/** Each status's colour, as the dots and the agenda's symbols show it (the same tones as team-work.css). */
export const statusTone: Record<WorkStatus, string> = {
    PLANNED: 'var(--gk-text-3)', IN_PROGRESS: 'var(--gk-info)', NEEDS_LOOK: 'var(--gk-warning)',
    ACCEPTED: 'color-mix(in srgb, var(--gk-accent) 55%, var(--gk-info))', LIVE: 'var(--gk-accent)', BLOCKED: 'var(--gk-danger)',
};

const MOVED: Record<WorkStatus, [LucideIcon, string, string]> = {
    PLANNED: [Undo2, 'Back to planned', 'ისევ დაგეგმილია'], IN_PROGRESS: [Play, 'Started', 'დაიწყო'], NEEDS_LOOK: [Eye, 'Needs your look', 'სანახავია'],
    ACCEPTED: [Check, 'Accepted', 'მიღებულია'], LIVE: [Rocket, 'Went live', 'ლაივზე გავიდა'], BLOCKED: [Ban, 'Blocked', 'დაიბლოკა'],
};

/** The symbol for what happened. */
export function eventIcon(event: WorkEvent): LucideIcon {
    if (event.kind === 'ADDED') return Plus;
    if (event.kind === 'ASKED') return CircleHelp;
    if (event.kind === 'ANSWERED') return Reply;
    return MOVED[event.status][0];
}

/** What happened, in a few words, and the line that says more: "Started — sign-up works", "Answered “Yes” — Bigger headings?". */
export function eventWords(copy: Copy, event: WorkEvent): { what: string; detail: string | null } {
    if (event.kind === 'ADDED') return { what: copy('Added', 'დაემატა'), detail: event.text };
    if (event.kind === 'ASKED') return { what: copy('Asked', 'იკითხა'), detail: event.text };
    if (event.kind === 'ANSWERED') return { what: copy(`Answered “${event.text ?? ''}”`, `უპასუხა „${event.text ?? ''}“`), detail: event.question };
    const [, en, ka] = MOVED[event.status];
    const back = event.status === 'IN_PROGRESS' && event.previousStatus != null && event.previousStatus !== 'PLANNED';
    return { what: back ? copy('Back in progress', 'ისევ მიმდინარეა') : copy(en, ka), detail: event.text };
}

/**
 * A page cut at a day's edge: when older events remain, the last (maybe partial) day is left for the next page,
 * which starts where that day ends. A single day bigger than a page continues from its oldest event.
 */
export function wholeDays(page: Timeline): { events: WorkEvent[]; next: string | null } {
    const last = page.events[page.events.length - 1];
    if (!page.more || !last) return { events: page.events, next: null };
    const lastDay = dayKey(new Date(last.at));
    const kept = page.events.filter(event => dayKey(new Date(event.at)) !== lastDay);
    if (!kept.length) return { events: page.events, next: last.at };
    const start = new Date(kept[kept.length - 1].at);
    start.setHours(0, 0, 0, 0);
    return { events: kept, next: start.toISOString() };
}

/** Events by day, newest day first, keeping their order. */
export function byDay(events: WorkEvent[]): [string, WorkEvent[]][] {
    const days = new Map<string, WorkEvent[]>();
    for (const event of events) { const key = dayKey(new Date(event.at)); days.set(key, [...days.get(key) ?? [], event]); }
    return [...days.entries()];
}

/** A row of the agenda: one event, or a run of tasks one person added to one plan at once (a paste). */
export type AgendaRow = { kind: 'event'; event: WorkEvent } | { kind: 'added'; key: string; events: WorkEvent[] };
const RUN_GAP = 15 * 60 * 1000;
export const RUN_MIN = 3;

export function rowsOf(events: WorkEvent[], planName: (event: WorkEvent) => string | undefined): AgendaRow[] {
    const rows: AgendaRow[] = [];
    let run: WorkEvent[] = [];
    const flush = () => {
        if (run.length >= RUN_MIN) rows.push({ kind: 'added', key: `run-${run[0].id}`, events: run });
        else run.forEach(event => rows.push({ kind: 'event', event }));
        run = [];
    };
    for (const event of events) {
        const previous = run[run.length - 1];
        const joins = previous && event.kind === 'ADDED' && event.by?.id === previous.by?.id && planName(event) === planName(previous)
            && Date.parse(previous.at) - Date.parse(event.at) <= RUN_GAP;
        if (!joins) flush();
        if (event.kind === 'ADDED') run.push(event);
        else rows.push({ kind: 'event', event });
    }
    flush();
    return rows;
}

/** Plan, person and status, as the toolbar sets them. A plan of `'none'` means tasks on no plan. */
export interface AgendaFilter { plan: number | 'none' | null; who: Who; statuses: WorkStatus[] }

/** The task an event belongs to: the event's own task, or the task a step is part of. */
export const taskIdOf = (event: WorkEvent) => event.parentId ?? event.task.id;

/**
 * Whether an event passes the filter. A person matches events they made and events on tasks they are on;
 * "whole team" matches tasks nobody in particular (or everybody) is on.
 */
export function eventMatches(event: WorkEvent, filter: AgendaFilter, context: { nodes: Map<number, WorkNode>; planOf: Map<number, Plan>; planItems: Map<number, Set<number>>; team: Person[] }) {
    const taskId = taskIdOf(event);
    if (filter.statuses.length && !filter.statuses.includes(event.status)) return false;
    if (filter.plan === 'none' && context.planOf.has(taskId)) return false;
    if (typeof filter.plan === 'number' && !context.planItems.get(filter.plan)?.has(taskId)) return false;
    if (filter.who === null) return true;
    if (typeof filter.who === 'number' && event.by?.id === filter.who) return true;
    const node = context.nodes.get(taskId);
    return node != null && nodeMatches(node, filter.who, context.team);
}

/** Every top-level task with its steps, by id. */
export function nodesOf(items: WorkItem[]): Map<number, WorkNode> {
    const nodes = new Map<number, WorkNode>();
    items.filter(item => item.parentId == null).forEach(item => nodes.set(item.id, { item, steps: [] }));
    items.filter(item => item.parentId != null).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).forEach(item => nodes.get(item.parentId!)?.steps.push(item));
    return nodes;
}
