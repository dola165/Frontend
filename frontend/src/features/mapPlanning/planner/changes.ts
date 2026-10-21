import { dateTime, type FamilyItinerary, type PlanDraft } from '../api';
import { draftItinerary } from '../journeyModel';

/**
 * What families would see differently if the draft were published now, compared with the
 * version they have. Private staff edits (notes, costs) are not family changes.
 */
export function familyChanges(published: FamilyItinerary | undefined, draft: PlanDraft): string[] {
    if (!published) return [];
    const next = draftItinerary(draft);
    const zone = draft.timezone;
    const changes: string[] = [];
    const field = (label: string, before: string | undefined, after: string | undefined) => { if ((before ?? '') !== (after ?? '')) changes.push(after ? `${label}: ${after}` : `${label} removed`); };
    field('Name', published.title, next.title);
    if (published.startsAt !== next.startsAt) changes.push(`Meeting time: ${dateTime(next.startsAt, zone)}`);
    if (published.endsAt !== next.endsAt) changes.push(`Return time: ${dateTime(next.endsAt, zone)}`);
    field('Meeting point', published.meetingPoint, next.meetingPoint);
    field('Collection point', published.collectionPoint, next.collectionPoint);
    field('Supervision contact', published.supervisionContact, next.supervisionContact);
    if ((published.message ?? '') !== (next.message ?? '')) changes.push('Message to families edited');
    const key = (a: FamilyItinerary['activities'][number]) => `${a.title}|${a.startsAt}|${a.endsAt}|${a.place?.name ?? ''}`;
    const before = new Map(published.activities.map(a => [key(a), a])), after = new Map(next.activities.map(a => [key(a), a]));
    const titlesBefore = new Map(published.activities.map(a => [a.title, a]));
    for (const [id, a] of after) {
        if (before.has(id)) continue;
        const old = titlesBefore.get(a.title);
        if (!old) changes.push(`New stop: ${a.title}`);
        else if (old.startsAt !== a.startsAt) changes.push(`${a.title} moved to ${dateTime(a.startsAt, zone)}`);
        else changes.push(`${a.title} changed`);
    }
    for (const a of published.activities) if (!next.activities.some(b => b.title === a.title)) changes.push(`Stop removed: ${a.title}`);
    if (JSON.stringify(published.bring ?? []) !== JSON.stringify(next.bring ?? [])) changes.push('What to bring updated');
    return changes;
}

/** The checks a coach should see before publishing; each one is a fact about the draft. */
export function publishChecks(draft: PlanDraft) {
    return [
        { ok: Boolean(draft.title.trim()), label: 'The plan has a name' },
        { ok: Boolean(draft.meetingPoint.trim()), label: 'Families know where to meet' },
        { ok: Boolean(draft.collectionPoint.trim()), label: 'Families know where to collect' },
        { ok: Boolean(draft.supervisionContact.trim()), label: 'There is a contact for the day' },
        { ok: draft.participants.length > 0, label: 'Players are chosen' },
        { ok: draft.activities.length > 0, label: 'The day has stops' },
    ];
}
