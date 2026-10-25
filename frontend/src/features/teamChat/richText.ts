import type { ChatPerson, ChatTaskRef } from './api';

/** A message's text in pieces: plain words, links, Team work task keys and mentions. */
export type Part =
    | { kind: 'text'; text: string }
    | { kind: 'url'; text: string; href: string; internal: string | null }
    | { kind: 'task'; text: string; task: ChatTaskRef }
    | { kind: 'mention'; text: string; person: ChatPerson };

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The same rule as the server's: "@Name", longest name first, any letter case, never inside an e-mail address. */
export function mentionPattern(people: ChatPerson[]) {
    const names = people.flatMap(person => person.name?.trim() ? [person.name.trim()] : []).sort((a, b) => b.length - a.length).map(escape);
    return names.length ? `(?<![\\p{L}\\p{N}_.])@(${names.join('|')})(?![\\p{L}\\p{N}_])` : null;
}

const URL_PATTERN = 'https?:\\/\\/[^\\s<>"\']+';
const TASK_PATTERN = '\\bGK-\\d{1,9}\\b';

/** A link's own end: trailing punctuation and unbalanced closing brackets belong to the sentence. */
function trimUrl(candidate: string) {
    let url = candidate.replace(/[.,!?;:]+$/, '');
    for (const [open, close] of [['(', ')'], ['[', ']']]) {
        while (url.endsWith(close) && url.split(close).length > url.split(open).length) url = url.slice(0, -1);
    }
    return url;
}

/**
 * Splits text into parts. Only people the server counted as mentioned are shown as mentions, and only tasks the
 * server found are links, so what is highlighted is exactly what notified someone.
 */
export function parts(text: string, mentioned: ChatPerson[], tasks: ChatTaskRef[], origin = window.location.origin): Part[] {
    const mention = mentionPattern(mentioned);
    const pattern = new RegExp([URL_PATTERN, TASK_PATTERN, mention].filter(Boolean).map(source => `(${source})`).join('|'), 'giu');
    const out: Part[] = [];
    const push = (value: string) => {
        if (!value) return;
        const last = out.at(-1);
        if (last?.kind === 'text') last.text += value; else out.push({ kind: 'text', text: value });
    };
    let end = 0;
    for (const match of text.matchAll(pattern)) {
        const start = match.index;
        push(text.slice(end, start));
        const found = match[0];
        end = start + found.length;
        if (match[1]) {
            const url = trimUrl(found);
            let parsed: URL | null = null;
            try { parsed = new URL(url); } catch { /* Not a link after all. */ }
            if (parsed && (parsed.protocol === 'http:' || parsed.protocol === 'https:')) {
                out.push({
                    kind: 'url', text: url, href: parsed.href,
                    internal: parsed.origin === origin && !parsed.pathname.startsWith('//') ? `${parsed.pathname}${parsed.search}${parsed.hash}` : null,
                });
                push(found.slice(url.length));
            } else push(found);
        } else if (match[2]) {
            const task = tasks.find(candidate => candidate.key.toUpperCase() === found.toUpperCase());
            if (task) out.push({ kind: 'task', text: found, task }); else push(found);
        } else {
            const name = (match[4] ?? '').toLowerCase();
            const person = mentioned.find(candidate => candidate.name?.trim().toLowerCase() === name);
            if (person) out.push({ kind: 'mention', text: found, person }); else push(found);
        }
    }
    push(text.slice(end));
    return out;
}

/** Where a task opens in Team work: the task, or a step inside its task. */
export const taskPath = (task: ChatTaskRef) => task.parentId ? `/team-work?task=${task.parentId}&step=${task.id}` : `/team-work?task=${task.id}`;
