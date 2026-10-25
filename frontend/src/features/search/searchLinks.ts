import type { ResultRef, SearchHit, SearchOpen } from './api';

/** The address parameter that holds the search box's words while it is open (?search=), for back, refresh and sharing. */
export const SEARCH_PARAM = 'search';

/**
 * The page a result opens: the task (and its step), the idea, the plan, the person's Now note, the chat at the message
 * (its chat named first, the way notifications link, so it opens the right one of several team chats), or the Kept
 * files shelf.
 */
export const pathOf = (open: SearchOpen) => {
    if (open.message != null) return `/team-work/chat?${open.conversation != null ? `chat=${open.conversation}&` : ''}message=${open.message}`;
    if (open.view === 'kept') return '/team-work/chat?view=kept';
    if (open.view && open.step != null) return `/team-work?view=${open.view}&step=${open.step}`;
    if (open.plan != null) return `/team-work?plan=${open.plan}`;
    if (open.who != null) return `/team-work?who=${open.who}`;
    if (open.task != null) return `/team-work?task=${open.task}${open.step != null ? `&step=${open.step}` : ''}`;
    return '/team-work';
};

export const refOf = (hit: SearchHit): ResultRef => ({ kind: hit.kind, id: hit.id });

/** An address's parameters without the search box's words: typing them opens nothing. */
export const withoutSearch = (params: URLSearchParams) => {
    const rest = new URLSearchParams(params);
    rest.delete(SEARCH_PARAM);
    return rest;
};

/**
 * What an address has open, as a result: what someone opened after "Not what I was looking for". On Team work a task, a
 * step, an idea, a waiting item, a plan or a Now note; in the team chats a message (a link, a notification, a result).
 */
export const openedIn = (path: string, params: URLSearchParams): ResultRef | null => {
    const number = (key: string) => { const value = Number(params.get(key)); return Number.isInteger(value) && value > 0 ? value : null; };
    if (path.startsWith('/team-work/chat')) {
        const message = number('message');
        return message ? { kind: 'MESSAGE', id: message } : null;
    }
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
