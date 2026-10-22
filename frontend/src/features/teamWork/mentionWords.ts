import type { Person } from './api';

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** "@Gio" in a comment: the team's names, longest first so "@Gio Beridze" wins over "@Gio". One capture group, the name. */
export function mentionPattern(team: Person[]) {
    const names = team.flatMap(person => person.name ? [person.name] : []).sort((a, b) => b.length - a.length).map(escape);
    return names.length ? new RegExp(`@(${names.join('|')})`, 'g') : null;
}

/** Everyone tagged in these texts, once each, in team order. */
export function mentioned(texts: string[], team: Person[]): Person[] {
    const pattern = mentionPattern(team);
    if (!pattern) return [];
    const names = new Set(texts.flatMap(text => [...text.matchAll(pattern)].map(match => match[1])));
    return team.filter(person => person.name != null && names.has(person.name));
}
