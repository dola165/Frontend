import { useId, useState } from 'react';
import { CalendarPlus, Trash2 } from 'lucide-react';
import { Button, Chip, Field } from '../../../design/primitives';
import { dateTime, zonedIso, type Plan, type PlanActivity, type PlanContext, type PlanDraft, type PlanPlace } from '../api';
import { locationRoles } from '../mapPlanning';
import { PlacePhotoEditor } from '../PlacePhoto';
import { PlaceField, RolePlace, TimeField } from './fields';
import { KIND_LABEL } from './itinerary';
import type { PlanMap } from './usePlanMap';

const KINDS = Object.keys(KIND_LABEL) as PlanActivity['kind'][];
const iso = (value: string, zone: string) => /[Zz]|[+-]\d\d:\d\d$/.test(value) ? new Date(value).toISOString() : zonedIso(value.slice(0, 16), zone);

/**
 * Edits one stop of the journey: what happens, when, and where. A match or training can
 * come straight from the squad's calendar, bringing its times and ground with it.
 */
export function ActivityEditor({ draft, initial, isNew, context, squad, plan, busy, planMap, change, onDone, onCalendar }: {
    draft: PlanDraft; initial: PlanActivity; isNew: boolean; context?: PlanContext; squad: number; plan: Plan | null; busy: boolean;
    planMap: PlanMap; change: (patch: Partial<PlanDraft>) => void; onDone: () => void; onCalendar: (key: string) => void;
}) {
    const [value, setValue] = useState(initial);
    const [error, setError] = useState('');
    const titleId = useId(), notesId = useId(), sourceId = useId();
    const events = context?.events.filter(event => event.challenger_squad_id === squad || event.target_squad_id === squad) ?? [];
    const sessions = context?.sessions.filter(session => session.squad_id === squad) ?? [];
    const sources = value.kind === 'MATCH' ? events : value.kind === 'TRAINING' ? sessions : [];
    const zone = draft.timezone;
    const linkTo = (raw: string) => {
        const item = sources.find(entry => entry.id === Number(raw));
        if (!item) { setValue({ ...value, eventId: null, sessionId: null }); return; }
        const tz = context?.settings.timezone || zone;
        let placeKey = value.placeKey;
        if ('location_lat' in item && typeof item.location_lat === 'number' && typeof item.location_lng === 'number') {
            const ground: PlanPlace = { key: `calendar:${item.id}`, name: item.location_name || item.title, address: item.location_name || '', latitude: item.location_lat, longitude: item.location_lng, type: 'MANUAL', notes: '' };
            change({ places: draft.places.some(place => place.key === ground.key) ? draft.places.map(place => place.key === ground.key ? ground : place) : [...draft.places, ground] });
            placeKey = ground.key;
        }
        setValue({ ...value, title: item.title, eventId: value.kind === 'MATCH' ? item.id : null, sessionId: value.kind === 'TRAINING' ? item.id : null, startsAt: iso(item.starts_at, tz), endsAt: iso(item.ends_at, tz), placeKey });
    };
    const save = () => {
        if (!value.title.trim()) { setError('Give this stop a name.'); return; }
        if (Date.parse(value.endsAt) <= Date.parse(value.startsAt)) { setError('The end must be after the start.'); return; }
        if (Date.parse(value.startsAt) < Date.parse(draft.startsAt) || Date.parse(value.endsAt) > Date.parse(draft.endsAt)) { setError('This stop is outside the journey’s times. Change the times, or the meeting and return times.'); return; }
        change({ activities: draft.activities.some(item => item.key === value.key) ? draft.activities.map(item => item.key === value.key ? value : item) : [...draft.activities, value] });
        onDone();
    };
    const place = draft.places.find(item => item.key === value.placeKey);
    return (
        <div className="gk-plan-editor" role="group" aria-label={isNew ? 'New stop' : `Edit ${initial.title}`}>
            <div className="gk-field">
                <span className="gk-field__label">What happens</span>
                <div className="gk-chips" role="group" aria-label="Kind of stop">
                    {KINDS.map(kind => <Chip key={kind} pressed={value.kind === kind} onClick={() => setValue({ ...value, kind, eventId: null, sessionId: null })}>{KIND_LABEL[kind]}</Chip>)}
                </div>
            </div>
            {(value.kind === 'MATCH' || value.kind === 'TRAINING') && (
                <Field label={value.kind === 'MATCH' ? 'From the calendar: a match' : 'From the calendar: a training session'} htmlFor={sourceId}
                    hint={sources.length ? 'Brings its name, times and ground.' : `No ${value.kind === 'MATCH' ? 'matches' : 'training sessions'} on this squad’s calendar. Add the stop yourself.`}>
                    <select id={sourceId} className="gk-input" value={value.eventId ?? value.sessionId ?? ''} disabled={!sources.length} onChange={event => linkTo(event.target.value)}>
                        <option value="">Not linked</option>
                        {sources.map(item => <option key={item.id} value={item.id}>{item.title} · {dateTime(iso(item.starts_at, context?.settings.timezone || zone), zone)}</option>)}
                    </select>
                </Field>
            )}
            <Field label="Stop name" htmlFor={titleId}>
                <input id={titleId} className="gk-input" aria-label="Stop name" maxLength={160} value={value.title} placeholder="Team bus leaves, lunch, warm-up…" onChange={event => setValue({ ...value, title: event.target.value })} />
            </Field>
            <div className="gk-plan-grid">
                <TimeField label="Starts" value={value.startsAt} zone={zone} onChange={startsAt => setValue({ ...value, startsAt })} />
                <TimeField label="Ends" value={value.endsAt} zone={zone} onChange={endsAt => setValue({ ...value, endsAt })} />
            </div>
            <PlaceField label="Place" places={draft.places} value={value.placeKey ?? null} onChange={placeKey => setValue({ ...value, placeKey })}
                onPick={() => planMap.begin('activity', saved => setValue(current => ({ ...current, placeKey: saved.key })))} onShow={planMap.focus} />
            {place && <PlacePhotoEditor url={place.photoUrl} name={place.name} onChange={url => change({ places: draft.places.map(item => item.key === place.key ? { ...item, photoUrl: url } : item) })} />}
            <Field label="Staff notes" htmlFor={notesId} hint="Planning staff only. Not shared with families.">
                <textarea id={notesId} className="gk-input" rows={2} maxLength={2000} value={value.notes} onChange={event => setValue({ ...value, notes: event.target.value })} />
            </Field>
            {error && <div className="gk-notice gk-notice--danger" role="alert">{error}</div>}
            <div className="gk-plan-editor__actions">
                <Button variant="primary" size="sm" onClick={save}>{isNew ? 'Add stop' : 'Done'}</Button>
                <Button size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
                {plan && !isNew && !value.eventId && !value.sessionId && (value.kind === 'MATCH' || value.kind === 'TRAINING') && (
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => onCalendar(value.key)}><CalendarPlus aria-hidden="true" />Add to club calendar</Button>
                )}
                {!isNew && <Button size="sm" variant="danger" className="gk-plan-editor__remove" onClick={() => { change({ activities: draft.activities.filter(item => item.key !== value.key) }); onDone(); }}><Trash2 aria-hidden="true" />Remove</Button>}
            </div>
        </div>
    );
}

/** The meeting or the return: when, where people gather, and the pinned place. */
export function RoleEditor({ role, draft, planMap, change, onDone }: { role: 'meeting' | 'collection'; draft: PlanDraft; planMap: PlanMap; change: (patch: Partial<PlanDraft>) => void; onDone: () => void }) {
    const pointId = useId();
    const meet = role === 'meeting';
    const field = meet ? 'meetingPoint' : 'collectionPoint';
    const key = locationRoles[role].key;
    const others = draft.places.filter(place => place.key !== key);
    const meetingPlace = draft.places.find(place => place.key === locationRoles.meeting.key);
    return (
        <div className="gk-plan-editor" role="group" aria-label={meet ? 'Edit the meeting' : 'Edit the return'}>
            <TimeField label={meet ? 'Leaving' : 'Expected return'} value={meet ? draft.startsAt : draft.endsAt} zone={draft.timezone} onChange={iso => change(meet ? { startsAt: iso } : { endsAt: iso })} hint={meet ? 'When the team meets. Every stop fits between leaving and return.' : undefined} />
            <Field label={meet ? 'Meeting point' : 'Collection point'} htmlFor={pointId} hint="Shared with families. Add the gate or the entrance.">
                <input id={pointId} className="gk-input" aria-label={meet ? 'Meeting point' : 'Collection point'} maxLength={400} value={draft[field]} placeholder="Academy entrance, Gate 2" onChange={event => change({ [field]: event.target.value })} />
            </Field>
            <RolePlace label="On the map" place={draft.places.find(place => place.key === key) ?? null}
                onClear={() => change({ places: draft.places.filter(place => place.key !== key) })} onPick={() => planMap.begin(role)} onShow={planMap.focus} />
            {!meet && meetingPlace && !draft.places.some(place => place.key === key) && (
                <Button size="sm" onClick={() => change({ places: [...others, { ...meetingPlace, key }], collectionPoint: draft.collectionPoint || draft.meetingPoint })}>Same as the meeting point</Button>
            )}
            <div className="gk-plan-editor__actions"><Button variant="primary" size="sm" onClick={onDone}>Done</Button></div>
        </div>
    );
}
