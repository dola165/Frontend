import { useId, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button, Chip, Field, Section } from '../../../design/primitives';
import { dateTime, type PlanDraft } from '../api';
import { draftStops, stopClock } from './itinerary';

const SUGGESTED = ['Match kit', 'Training kit', 'Boots and shin pads', 'Water bottle', 'Packed snack', 'Rain jacket', 'Warm layer', 'ID or passport', 'Medication', 'Pocket money'];

/** A message families can read in one go, drafted from the plan's own facts for the coach to edit. */
function draftMessage(draft: PlanDraft) {
    const stops = draftStops(draft).filter(stop => stop.kind === 'activity');
    const clock = (value: string | null) => stopClock(value, draft.timezone).time;
    const lines = [
        `${draft.title || 'Our journey'}: ${dateTime(draft.startsAt, draft.timezone)}.`,
        `We meet at ${draft.meetingPoint || 'the meeting point'} at ${clock(draft.startsAt)}${draft.collectionPoint ? ` and are back at ${draft.collectionPoint} by ${clock(draft.endsAt)}` : ''}.`,
        stops.length ? `The day: ${stops.map(stop => `${clock(stop.startsAt)} ${stop.title}`).join(', ')}.` : '',
        draft.bring?.length ? `Please bring: ${draft.bring.join(', ').toLowerCase()}.` : '',
        'Please reply in the app so we know who is coming.',
        draft.supervisionContact ? `On the day, call ${draft.supervisionContact}.` : '',
    ];
    return lines.filter(Boolean).join(' ');
}

/** What to bring, the message for families, and notes that stay with the staff. */
export function NotesTab({ draft, canEdit, change }: { draft: PlanDraft; canEdit: boolean; change: (patch: Partial<PlanDraft>) => void }) {
    const itemId = useId(), messageId = useId(), notesId = useId();
    const [item, setItem] = useState('');
    const bring = draft.bring ?? [];
    const add = (value: string) => { const text = value.trim(); if (text && !bring.some(entry => entry.toLowerCase() === text.toLowerCase()) && bring.length < 40) change({ bring: [...bring, text.slice(0, 80)] }); };
    return (
        <div className="gk-plan-body">
            <Section title="What to bring" hint="Shared with families">
                {bring.length > 0 && (
                    <ul className="gk-plan-bring" aria-label="To bring">
                        {bring.map(entry => (
                            <li key={entry}><span>{entry}</span>{canEdit && <button type="button" aria-label={`Remove ${entry}`} onClick={() => change({ bring: bring.filter(other => other !== entry) })}><X aria-hidden="true" /></button>}</li>
                        ))}
                    </ul>
                )}
                {canEdit && (
                    <>
                        <form className="gk-plan-inline" onSubmit={event => { event.preventDefault(); add(item); setItem(''); }}>
                            <label htmlFor={itemId} className="gk-visually-hidden">Add something to bring</label>
                            <input id={itemId} className="gk-input" maxLength={80} value={item} placeholder="Add something to bring" onChange={event => setItem(event.target.value)} />
                            <Button type="submit" disabled={!item.trim()}><Plus aria-hidden="true" />Add</Button>
                        </form>
                        <div className="gk-chips" role="group" aria-label="Common things to bring">
                            {SUGGESTED.filter(entry => !bring.includes(entry)).map(entry => <Chip key={entry} onClick={() => add(entry)}><Plus aria-hidden="true" />{entry}</Chip>)}
                        </div>
                    </>
                )}
            </Section>
            <Section title="Message to families" action={canEdit ? <Button size="sm" variant="ghost" onClick={() => change({ familyMessage: draftMessage(draft) })}>Write it from the plan</Button> : undefined}>
                <Field label="Message" htmlFor={messageId} hint="Families read this with the itinerary. Review it before you publish.">
                    <textarea id={messageId} className="gk-input" rows={6} maxLength={2000} disabled={!canEdit} value={draft.familyMessage} placeholder="What should players know before the day?" onChange={event => change({ familyMessage: event.target.value })} />
                </Field>
            </Section>
            <Section title="Staff notes">
                <Field label="Private planning notes" htmlFor={notesId} hint="Only planning staff see these. Never part of the family itinerary.">
                    <textarea id={notesId} className="gk-input" aria-label="Private planning notes" rows={4} maxLength={4000} disabled={!canEdit} value={draft.privateNotes} onChange={event => change({ privateNotes: event.target.value })} />
                </Field>
            </Section>
        </div>
    );
}
