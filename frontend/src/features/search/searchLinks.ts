import type { ResultRef, SearchHit, SearchOpen } from './api';

/** The page a result opens: the task (and its step), the idea, the plan, the person's Now note, or the chat at the message. */
export const pathOf = (open: SearchOpen) => {
    if (open.message != null) return `/team-work/chat?message=${open.message}`;
    if (open.view && open.step != null) return `/team-work?view=${open.view}&step=${open.step}`;
    if (open.plan != null) return `/team-work?plan=${open.plan}`;
    if (open.who != null) return `/team-work?who=${open.who}`;
    if (open.task != null) return `/team-work?task=${open.task}${open.step != null ? `&step=${open.step}` : ''}`;
    return '/team-work';
};

export const refOf = (hit: SearchHit): ResultRef => ({ kind: hit.kind, id: hit.id });

/** What a Team work address has open, as a result: what someone opened after "Not what I was looking for". */
export const openedIn = (params: URLSearchParams): ResultRef | null => {
    const number = (key: string) => { const value = Number(params.get(key)); return Number.isInteger(value) && value > 0 ? value : null; };
    const step = number('step') ?? number('open'), task = number('task'), plan = number('plan') ?? number('roadmap'), who = number('who');
    const view = params.get('view');
    if (step && view === 'ideas') return { kind: 'IDEA', id: step };
    if (step && view === 'waiting') return { kind: 'WAITING', id: step };
    if (step) return { kind: task ? 'STEP' : 'TASK', id: step };
    if (task) return { kind: 'TASK', id: task };
    if (plan) return { kind: 'PLAN', id: plan };
    if (who) return { kind: 'NOW', id: who };
    return null;
};
