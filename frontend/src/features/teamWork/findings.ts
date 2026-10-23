import { useCallback, useEffect, useState } from 'react';
import { fetchDetail, type Detail, type Person, type Plan, type PlanView } from './api';
import { mentioned } from './mentionWords';

/**
 * Findings live on two plans with these exact names, never shown as plans: "Add to plans" holds what was just
 * dropped, "Pending" what someone pushed on for a decision. A finding made a task leaves both. No migration needed.
 */
export const IDEAS = 'Add to plans';
export const WAITING = 'Pending';
export const isHidden = (plan: Plan) => plan.name === IDEAS || plan.name === WAITING;
export const isReservedName = (name: string) => [IDEAS, WAITING].some(reserved => reserved.toLowerCase() === name.trim().toLowerCase());

/** The history notes an idea collects, each with who and when (stored words; the screen says "waiting" for the old "pending"). Pushing to Waiting counts as acknowledging. */
export const NOTE = { seen: 'Seen', acknowledged: 'Acknowledged', pushed: 'Pushed to pending', madeTask: 'Made a task' } as const;

const authorsOf = (detail: Detail, messages: string[]) => {
    const found: Person[] = [];
    [...detail.updates].reverse().forEach(update => {
        if (update.author && update.message && messages.includes(update.message) && !found.some(person => person.id === update.author!.id)) found.push(update.author);
    });
    return found;
};
export const acknowledgedBy = (detail: Detail) => authorsOf(detail, [NOTE.acknowledged, NOTE.pushed]);
/** Who looked without acknowledging. */
export const seenOnlyBy = (detail: Detail) => { const acknowledged = acknowledgedBy(detail); return authorsOf(detail, [NOTE.seen]).filter(person => !acknowledged.some(other => other.id === person.id)); };
/** Who dropped it: the author of its first history line, or whoever uploaded its first file. */
export const droppedBy = (detail: Detail): Person | null => detail.updates.at(-1)?.author ?? detail.media.at(-1)?.uploadedBy ?? null;
export const pushedBy = (detail: Detail) => detail.updates.find(update => update.message === NOTE.pushed) ?? null;
export const taggedIn = (detail: Detail, team: Person[]) => mentioned(detail.comments.map(comment => comment.body), team);
const has = (people: Person[], me: number) => people.some(person => person.id === me);
/** Something I have not looked at yet that someone else dropped. */
export const isNewFor = (detail: Detail, me: number | null) => me != null && droppedBy(detail)?.id !== me
    && !has(acknowledgedBy(detail), me) && !has(seenOnlyBy(detail), me);

/** Each finding's files, comments and history, fetched side by side (a handful at a time). */
export function useFindingDetails(views: (PlanView | undefined)[]) {
    const [details, setDetails] = useState<Map<number, Detail>>(new Map());
    const key = views.flatMap(view => view?.tasks ?? []).map(node => `${node.item.id}:${node.item.version}`).join();
    useEffect(() => {
        const ids = [...new Set(key.split(',').filter(Boolean).map(entry => Number(entry.split(':')[0])))].slice(0, 80);
        const controller = new AbortController();
        Promise.all(ids.map(id => fetchDetail(id, controller.signal).then(detail => [id, detail] as const).catch(() => null)))
            .then(found => { if (!controller.signal.aborted) setDetails(new Map(found.filter((entry): entry is readonly [number, Detail] => entry !== null))); });
        return () => controller.abort();
    }, [key]);
    const put = useCallback((detail: Detail) => setDetails(current => new Map(current).set(detail.item.id, detail)), []);
    return { details: key ? details : new Map<number, Detail>(), put };
}
