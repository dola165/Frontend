import { useId, useState } from 'react';
import { MapPin, X } from 'lucide-react';
import { Button, Field } from '../../../design/primitives';
import { localInput, zonedIso, type PlanPlace } from '../api';

/** A date and time in the plan's own time zone. A clock-change gap or an incomplete value is refused, never moved. */
export function TimeField({ label, value, zone, onChange, hint }: { label: string; value: string; zone: string; onChange: (iso: string) => void; hint?: string }) {
    const id = useId();
    const [error, setError] = useState('');
    return (
        <Field label={label} htmlFor={id} error={error || undefined} hint={hint ?? zone}>
            <input id={id} className="gk-input" type="datetime-local" aria-label={label} aria-invalid={Boolean(error)} data-plan-time
                value={Number.isFinite(Date.parse(value)) ? localInput(value, zone) : ''}
                onChange={event => { try { onChange(zonedIso(event.target.value, zone)); setError(''); } catch (cause) { setError((cause as Error).message); } }} />
        </Field>
    );
}

/** A place for a stop: one of the plan's saved places, or a new one chosen on the map. */
export function PlaceField({ label, places, value, onChange, onPick, onShow, disabled }: {
    label: string; places: PlanPlace[]; value: string | null; onChange: (key: string | null) => void; onPick: () => void; onShow?: (place: PlanPlace) => void; disabled?: boolean;
}) {
    const id = useId();
    const chosen = places.find(place => place.key === value);
    return (
        <div className="gk-field">
            <label className="gk-field__label" htmlFor={id}>{label}</label>
            <div className="gk-plan-place-field">
                <select id={id} className="gk-input" value={value ?? ''} disabled={disabled} onChange={event => onChange(event.target.value || null)}>
                    <option value="">No place yet</option>
                    {places.map(place => <option key={place.key} value={place.key}>{place.name}</option>)}
                </select>
                <Button onClick={onPick} disabled={disabled}><MapPin aria-hidden="true" />Choose on the map</Button>
            </div>
            {chosen && (
                <span className="gk-field__hint gk-plan-place-chosen">
                    {chosen.address || 'Chosen on the map'}
                    {onShow && <button type="button" className="gk-plan-link" onClick={() => onShow(chosen)}>Show on map</button>}
                    {!disabled && <button type="button" className="gk-plan-link" aria-label={`Clear ${label.toLowerCase()}`} onClick={() => onChange(null)}><X aria-hidden="true" /></button>}
                </span>
            )}
        </div>
    );
}

/** The one map place for the meeting, destination or collection: shown, changed on the map, or removed. */
export function RolePlace({ label, place, onPick, onShow, onClear, disabled }: {
    label: string; place: PlanPlace | null; onPick: () => void; onShow?: (place: PlanPlace) => void; onClear: () => void; disabled?: boolean;
}) {
    return (
        <div className="gk-field" role="group" aria-label={label}>
            <span className="gk-field__label">{label}</span>
            {place ? (
                <div className="gk-plan-role-place">
                    <MapPin className="gk-plan-pin" aria-hidden="true" />
                    <span className="gk-plan-role-place__text"><strong>{place.name}</strong><span className="gk-faint">{place.address || 'Chosen on the map'}</span></span>
                    {onShow && <Button size="sm" variant="ghost" onClick={() => onShow(place)}>Show</Button>}
                    {!disabled && <Button size="sm" variant="ghost" onClick={onPick}>Change</Button>}
                    {!disabled && <Button size="sm" variant="ghost" iconOnly aria-label={`Remove ${label.toLowerCase()}`} onClick={onClear}><X aria-hidden="true" /></Button>}
                </div>
            ) : <div><Button onClick={onPick} disabled={disabled}><MapPin aria-hidden="true" />Choose on the map</Button></div>}
        </div>
    );
}
