import type { Person, RoadmapView, WorkNode } from './api';

/** Who a list is filtered by: everyone (null), plans for the whole team, or one person's id. */
export type Who = null | 'team' | number;
export const whoOf = (value: string | null): Who => value === 'team' ? 'team' : Number(value) || null;

const idsOf = (people: Person[]) => new Set(people.flatMap(person => person.id == null ? [] : [person.id]));

/** Everyone on a piece or any of its parts. */
export const nodePeople = (node: WorkNode) => idsOf([...node.item.people, ...node.parts.flatMap(part => part.people)]);

/** Work for the whole team: nobody in particular is on it, or everybody is. */
const forWholeTeam = (ids: Set<number>, team: Person[]) => ids.size === 0 || [...idsOf(team)].every(id => ids.has(id));

/** Who started a plan: the author of its first "Started" or "Copied from" line, when the history still shows it. */
export function planCreator(view: RoadmapView): Person | null {
    const first = [...view.changes].reverse().find(change => change.message === 'Started' || change.message.startsWith('Copied from'));
    return first?.author ?? null;
}

/** Who is on a plan: the people on its pieces and parts, and whoever started it, in team order. */
export function planPeople(view: RoadmapView): Person[] {
    const ids = new Set<number>();
    view.pieces.forEach(node => nodePeople(node).forEach(id => ids.add(id)));
    const creator = planCreator(view);
    if (creator?.id != null) ids.add(creator.id);
    const known = view.team.filter(person => person.id != null && ids.has(person.id));
    if (creator?.id != null && !known.some(person => person.id === creator.id)) known.push(creator);
    return known;
}

/** "Started by Beqa · Beqa, Ilo": who started a plan and who is on it, in plain words. */
export function peopleLine(copy: (en: string, ka: string) => string, view: RoadmapView | undefined) {
    if (!view) return '';
    const creator = planCreator(view)?.name;
    const names = planPeople(view).map(person => person.name).filter(Boolean).join(', ');
    return [creator && copy(`Started by ${creator}`, `დაიწყო ${creator}`), names].filter(Boolean).join(' · ');
}

export const nodeMatches =(node: WorkNode, who: Who, team: Person[]) =>
    who === null || (who === 'team' ? forWholeTeam(nodePeople(node), team) : nodePeople(node).has(who));

export function planMatches(view: RoadmapView, who: Who) {
    if (who === null) return true;
    if (who === 'team') { const ids = new Set<number>(); view.pieces.forEach(node => nodePeople(node).forEach(id => ids.add(id))); return forWholeTeam(ids, view.team); }
    return planPeople(view).some(person => person.id === who);
}
