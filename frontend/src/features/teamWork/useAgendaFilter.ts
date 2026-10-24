import { useSearchParams } from 'react-router-dom';
import { STATUSES, type WorkStatus } from './api';
import type { AgendaFilter } from './agendaRows';
import { whoOf } from './planPeople';

/** Day cards, or one line per task. */
export type AgendaLayout = 'day' | 'list';

/**
 * The agenda's filter as the link keeps it: `?in=` plan (or none), `?who=` person, `?status=` statuses; and how it
 * shows, by day or as a list (`?show=list`).
 */
export function useAgendaFilter() {
    const [params, setParams] = useSearchParams();
    const inParam = params.get('in') ?? params.get('project');
    const filter: AgendaFilter = {
        plan: inParam === 'none' ? 'none' : Number(inParam) || null,
        who: whoOf(params.get('who')),
        statuses: (params.get('status') ?? '').split(',').filter((value): value is WorkStatus => (STATUSES as readonly string[]).includes(value)),
    };
    const change = (next: Partial<AgendaFilter>) => setParams(previous => {
        const changed = new URLSearchParams(previous);
        const put = (key: string, value: string | null) => { if (value) changed.set(key, value); else changed.delete(key); };
        if ('plan' in next) { changed.delete('project'); put('in', next.plan == null ? null : String(next.plan)); }
        if ('who' in next) put('who', next.who == null ? null : String(next.who));
        if ('statuses' in next) put('status', next.statuses?.length ? next.statuses.join(',') : null);
        changed.delete('day');
        return changed;
    }, { replace: true });
    const open = (taskId: number, stepId: number | null) => setParams(previous => {
        const changed = new URLSearchParams(previous);
        changed.set('task', String(taskId));
        if (stepId == null) changed.delete('step'); else changed.set('step', String(stepId));
        return changed;
    }, { replace: true });
    const layout: AgendaLayout = params.get('show') === 'list' ? 'list' : 'day';
    const setLayout = (next: AgendaLayout) => setParams(previous => {
        const changed = new URLSearchParams(previous);
        if (next === 'list') changed.set('show', 'list'); else changed.delete('show');
        changed.delete('day');
        return changed;
    }, { replace: true });
    return { filter, change, open, layout, setLayout };
}
