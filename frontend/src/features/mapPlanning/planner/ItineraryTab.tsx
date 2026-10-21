import { Fragment, useId, useState } from 'react';
import { ArrowDown, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button, EmptyNote, Field, FixtureRow, List, ListRow, Section, type FixtureTone } from '../../../design/primitives';
import type { Plan, PlanActivity, PlanContext, PlanDraft, PlanPlace } from '../api';
import { locationRoles, roleForPlace } from '../mapPlanning';
import { RolePlace, TimeField } from './fields';
import { KIND_LABEL, blankActivity, draftStops, durationLabel, kmLabel, legsOf, stopClock, type ItineraryStop } from './itinerary';
import { ActivityEditor, RoleEditor } from './StopEditor';
import type { PlanMap } from './usePlanMap';

const ZONES = ['Asia/Tbilisi', 'Europe/Istanbul', 'Europe/Berlin', 'Europe/Paris', 'Europe/London', 'Europe/Tallinn', 'UTC'];
const kindOf = (stop: ItineraryStop) => stop.activityKind ? `${KIND_LABEL[stop.activityKind]}${stop.activity?.eventId || stop.activity?.sessionId ? ' from the calendar' : ''}` : null;
const toneOf = (stop: ItineraryStop): FixtureTone => stop.activityKind === 'MATCH' ? 'match' : stop.activityKind === 'TRAINING' ? 'training' : stop.kind === 'activity' && stop.activityKind !== 'TRAVEL' ? 'event' : 'neutral';

function Basics({ draft, change, planMap, validation }: { draft: PlanDraft; change: (patch: Partial<PlanDraft>) => void; planMap: PlanMap; validation: { field: string; message: string } | null }) {
    const nameId = useId(), destinationId = useId(), zoneId = useId();
    const destinationKey = locationRoles.destination.key;
    return (
        <div className="gk-plan-fields">
            <Field label="Plan name" htmlFor={nameId} error={validation?.field === 'Plan name' ? validation.message : undefined}>
                <input id={nameId} className="gk-input" aria-label="Plan name" aria-invalid={validation?.field === 'Plan name'} required maxLength={160} value={draft.title}
                    placeholder="U16 Boys away at Telavi" onChange={event => change({ title: event.target.value })} />
            </Field>
            <Field label="Destination" htmlFor={destinationId}>
                <input id={destinationId} className="gk-input" aria-label="Destination" maxLength={400} value={draft.destination} placeholder="Ground, town or venue" onChange={event => change({ destination: event.target.value })} />
            </Field>
            <RolePlace label="Destination on the map" place={draft.places.find(place => place.key === destinationKey) ?? null}
                onClear={() => change({ places: draft.places.filter(place => place.key !== destinationKey) })} onPick={() => planMap.begin('destination')} onShow={planMap.focus} />
            <div className="gk-plan-grid">
                <TimeField label="Leaving" value={draft.startsAt} zone={draft.timezone} onChange={startsAt => change({ startsAt })} />
                <TimeField label="Expected return" value={draft.endsAt} zone={draft.timezone} onChange={endsAt => change({ endsAt })} />
            </div>
            <Field label="Time zone" htmlFor={zoneId} hint="Times are shown to families in this zone.">
                <select id={zoneId} className="gk-input" value={draft.timezone} onChange={event => change({ timezone: event.target.value })}>
                    {[...new Set([draft.timezone, ...ZONES])].map(zone => <option key={zone}>{zone}</option>)}
                </select>
            </Field>
        </div>
    );
}

/**
 * The itinerary: every stop in order on a fixture line with the planned gap and the
 * straight-line distance between stops, then the plan's details. A new plan starts with its
 * details. Click a stop to edit it.
 */
export function ItineraryTab({ draft, plan, context, squad, busy, canEdit, planMap, change, validation, onCalendar }: {
    draft: PlanDraft; plan: Plan | null; context?: PlanContext; squad: number; busy: boolean; canEdit: boolean; planMap: PlanMap;
    change: (patch: Partial<PlanDraft>) => void; validation: { field: string; message: string } | null; onCalendar: (key: string) => void;
}) {
    const [open, setOpen] = useState<string | null>(null);
    const [newStop, setNewStop] = useState<PlanActivity | null>(null);
    // A place chosen on the map with "Add as a stop" opens a new stop with that place.
    const { seed, consumeSeed } = planMap;
    // One new stop per chosen place, made once so its key stays stable while it is edited.
    const [seeded, setSeeded] = useState<{ seed: PlanPlace; activity: PlanActivity } | null>(null);
    if (seed && seeded?.seed !== seed) setSeeded({ seed, activity: blankActivity(draft, seed) });
    const adding = newStop ?? (canEdit && seed && seeded?.seed === seed ? seeded.activity : null);
    const setAdding = (value: PlanActivity | null) => { setNewStop(value); if (seed) consumeSeed(); };
    const stops = draftStops(draft);
    const legs = legsOf(stops);
    const zone = draft.timezone;
    const used = new Set([...draft.activities.map(activity => activity.placeKey), ...Object.values(locationRoles).map(role => role.key)]);
    const spare = draft.places.filter(place => !used.has(place.key));
    const select = (stop: ItineraryStop) => {
        planMap.selectStop(stop.id);
        if (stop.place) planMap.focus(stop.place);
        if (canEdit) setOpen(current => current === stop.id ? null : stop.id);
    };
    const editorFor = (stop: ItineraryStop) => {
        const done = () => setOpen(null);
        if (stop.kind === 'meet') return <RoleEditor role="meeting" draft={draft} planMap={planMap} change={change} onDone={done} />;
        if (stop.kind === 'return') return <RoleEditor role="collection" draft={draft} planMap={planMap} change={change} onDone={done} />;
        if (stop.activity) return <ActivityEditor key={stop.activity.key} draft={draft} initial={stop.activity} isNew={false} context={context} squad={squad} plan={plan} busy={busy} planMap={planMap} change={change} onDone={done} onCalendar={onCalendar} />;
        return null;
    };
    return (
        <div className="gk-plan-body">
            {!plan && <Basics draft={draft} change={change} planMap={planMap} validation={validation} />}
            <Section title="Stops" hint={`${draft.activities.length} planned`}
                action={canEdit && !adding ? <Button size="sm" onClick={() => { setAdding(blankActivity(draft)); setOpen(null); }}><Plus aria-hidden="true" />Add stop</Button> : undefined}>
                {validation?.field === 'Schedule' && <div className="gk-notice gk-notice--danger" role="alert">{validation.message}</div>}
                <ol className="gk-plan-timeline" aria-label="Journey stops">
                    {stops.map((stop, index) => {
                        const clock = stopClock(stop.startsAt, zone);
                        const leg = legs[index];
                        const end = stop.endsAt ? stopClock(stop.endsAt, zone).time : null;
                        const where = stop.place?.name ?? (stop.note || (stop.activityKind === 'TRAVEL' ? null : 'Place to confirm'));
                        return (
                            <Fragment key={stop.id}>
                                <li className="gk-plan-stop" data-open={open === stop.id || undefined} data-current={planMap.selectedStop === stop.id || undefined}>
                                    <ul className="gk-list">
                                        <FixtureRow tone={toneOf(stop)} time={clock.time} day={clock.day} label={`${stop.title}, ${clock.time}`} onClick={() => select(stop)}
                                            title={stop.title}
                                            meta={<>{stop.place ? <MapPin className="gk-plan-pin" aria-hidden="true" /> : null}<span>{[kindOf(stop), where, end ? `until ${end}` : null].filter(Boolean).join(' · ')}</span></>}
                                            trail={canEdit ? <Button size="sm" variant="ghost" iconOnly aria-label={`Edit ${stop.title}`} onClick={() => select(stop)}><Pencil aria-hidden="true" /></Button> : undefined} />
                                    </ul>
                                    {open === stop.id && editorFor(stop)}
                                </li>
                                {leg && (leg.minutes != null || leg.km != null) && (
                                    <li className="gk-plan-leg" aria-label={`Then ${[leg.minutes != null ? durationLabel(leg.minutes) : null, leg.km != null ? `${kmLabel(leg.km)} away` : null].filter(Boolean).join(', ')}`}>
                                        <ArrowDown aria-hidden="true" />{[leg.minutes != null ? `${durationLabel(leg.minutes)} later` : null, leg.km != null ? `${kmLabel(leg.km)} apart` : null].filter(Boolean).join(' · ')}
                                    </li>
                                )}
                            </Fragment>
                        );
                    })}
                </ol>
                {adding && <ActivityEditor key={adding.key} draft={draft} initial={adding} isNew context={context} squad={squad} plan={plan} busy={busy} planMap={planMap} change={change} onDone={() => setAdding(null)} onCalendar={onCalendar} />}
                {!draft.activities.length && !adding && <EmptyNote title="No stops yet">Add the departure, the match or training, meals and anything in between. Meeting and return are already on the line.</EmptyNote>}
                <p className="gk-faint">Distances are straight lines between stops, not road routes. Times are your plan.</p>
            </Section>
            {plan && <Section title="Plan details"><Basics draft={draft} change={change} planMap={planMap} validation={validation} /></Section>}
            {spare.length > 0 && (
                <Section title="Saved places" hint="Not on the route yet">
                    <List label="Saved places" className="gk-plan-list">
                        {spare.map(place => (
                            <ListRow key={place.key} title={place.name} meta={place.address || 'Chosen on the map'}
                                lead={<span className="gk-plan-glyph"><MapPin aria-hidden="true" /></span>}
                                trail={<>
                                    <Button size="sm" variant="ghost" onClick={() => planMap.focus(place)}>Show</Button>
                                    {canEdit && <Button size="sm" onClick={() => { setAdding(blankActivity(draft, place)); setOpen(null); }}>Make it a stop</Button>}
                                    {canEdit && <Button size="sm" variant="ghost" iconOnly aria-label={`Remove ${place.name}`} onClick={() => {
                                        const role = roleForPlace(place.key);
                                        change({ places: draft.places.filter(item => item.key !== place.key), activities: draft.activities.map(item => item.placeKey === place.key ? { ...item, placeKey: null } : item), arrangements: draft.arrangements.map(item => item.placeKey === place.key ? { ...item, placeKey: null } : item), ...(role ? { [locationRoles[role].field]: '' } : {}) });
                                    }}><Trash2 aria-hidden="true" /></Button>}
                                </>} />
                        ))}
                    </List>
                </Section>
            )}
        </div>
    );
}
