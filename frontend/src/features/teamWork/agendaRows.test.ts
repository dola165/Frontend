import { expect, it } from 'vitest';
import { dayKey } from '../schedule/board/scheduleRange';
import { byDay, eventMatches, eventWords, rowsOf, wholeDays } from './agendaRows';
import type { WorkEvent } from './overviewApi';

const copy = (en: string) => en;
const at = (day: number, hours: number, minutes = 0) => new Date(2026, 9, day, hours, minutes).toISOString();
const event = (id: string, when: string, extra: Partial<WorkEvent> = {}): WorkEvent => ({
    id, kind: 'STATUS', at: when, task: { id: 1, key: 'GK-1', title: 'Agenda', status: 'IN_PROGRESS' }, parentId: null, status: 'IN_PROGRESS', previousStatus: 'PLANNED',
    by: { id: 1, name: 'Beqa' }, text: null, question: null, ...extra,
});

it('says what happened in plain words', () => {
    expect(eventWords(copy, event('1', at(20, 9), { text: 'Rows are in' }))).toEqual({ what: 'Started', detail: 'Rows are in' });
    expect(eventWords(copy, event('2', at(20, 9), { previousStatus: 'BLOCKED' })).what).toBe('Back in progress');
    expect(eventWords(copy, event('3', at(20, 9), { status: 'LIVE' })).what).toBe('Went live');
    expect(eventWords(copy, event('4', at(20, 9), { kind: 'ANSWERED', text: 'Yes', question: 'Bigger headings?' }))).toEqual({ what: 'Answered “Yes”', detail: 'Bigger headings?' });
});

it('keeps pages to whole days and starts the next page where the last whole day ends', () => {
    const page = { more: true, events: [event('1', at(23, 15)), event('2', at(23, 9)), event('3', at(21, 18)), event('4', at(21, 8))] };
    const cut = wholeDays(page);
    expect(cut.events.map(found => found.id)).toEqual(['1', '2']);
    expect(cut.next).toBe(new Date(2026, 9, 23).toISOString());
    expect(wholeDays({ ...page, more: false }).events).toHaveLength(4);
    // One day bigger than a page continues from its oldest event.
    const single = { more: true, events: [event('1', at(23, 15)), event('2', at(23, 9))] };
    expect(wholeDays(single)).toEqual({ events: single.events, next: at(23, 9) });
    expect(byDay(page.events).map(([key, events]) => [key, events.length])).toEqual([[dayKey(new Date(2026, 9, 23, 12)), 2], [dayKey(new Date(2026, 9, 21, 12)), 2]]);
});

it('folds three or more tasks one person added to one plan at once, and nothing else', () => {
    const added = (id: string, minute: number, extra: Partial<WorkEvent> = {}) => event(id, at(23, 10, minute), { kind: 'ADDED', ...extra });
    const rows = rowsOf([added('a', 30), added('b', 29), added('c', 28), event('s', at(23, 10, 20)), added('d', 10), added('e', 9)], () => 'October work');
    expect(rows.map(row => row.kind === 'added' ? row.events.map(found => found.id).join('') : row.event.id)).toEqual(['abc', 's', 'd', 'e']);
    const mixed = rowsOf([added('a', 30), added('b', 29, { by: { id: 2, name: 'Gio' } }), added('c', 28)], () => 'October work');
    expect(mixed.every(row => row.kind === 'event')).toBe(true);
});

it('filters by status, plan and person: their own events and their tasks', () => {
    const task = { item: { id: 1, people: [{ id: 3, name: 'Ilo' }] }, steps: [] } as never;
    const context = { nodes: new Map([[1, task]]), planOf: new Map(), planItems: new Map([[5, new Set([1])]]), team: [] };
    const started = event('1', at(23, 9), { by: { id: 2, name: 'Gio' } });
    expect(eventMatches(started, { plan: null, who: null, statuses: ['LIVE'] }, context)).toBe(false);
    expect(eventMatches(started, { plan: 5, who: null, statuses: [] }, context)).toBe(true);
    expect(eventMatches(started, { plan: 6, who: null, statuses: [] }, context)).toBe(false);
    expect(eventMatches(started, { plan: null, who: 2, statuses: [] }, context)).toBe(true);
    expect(eventMatches(started, { plan: null, who: 3, statuses: [] }, context)).toBe(true);
    expect(eventMatches(started, { plan: null, who: 4, statuses: [] }, context)).toBe(false);
});
