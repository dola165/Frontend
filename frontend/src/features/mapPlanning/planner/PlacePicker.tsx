import { useEffect, useId, useState } from 'react';
import { MapPin, Search, X } from 'lucide-react';
import { geocodePlace, type GeocodeResult } from '../../../api/map';
import { Button, Field } from '../../../design/primitives';
import type { PlanPlace } from '../api';
import { locationRoles, type LocationRole, type PickTarget } from '../mapPlanning';
import { targetLabel, type PlanMap } from './usePlanMap';

/** Cities and countries for jumping the map while choosing a place. */
function useAreas(text: string) {
    const [state, setState] = useState<{ text: string; items: GeocodeResult[]; error: boolean }>({ text: '', items: [], error: false });
    useEffect(() => {
        const q = text.trim();
        if (q.length < 3) return;
        let active = true;
        const timer = window.setTimeout(() => { void geocodePlace(q).then(items => { if (active) setState({ text: q, items: items.slice(0, 5), error: false }); }).catch(() => { if (active) setState({ text: q, items: [], error: true }); }); }, 300);
        return () => { active = false; window.clearTimeout(timer); };
    }, [text]);
    return state.text === text.trim() ? state : { text, items: [], error: false };
}

function Confirm({ candidate, target, onUse, onCancel }: { candidate: PlanPlace; target: PickTarget | null; onUse: (place: PlanPlace, as: PickTarget) => void; onCancel: () => void }) {
    const [name, setName] = useState(candidate.name), [address, setAddress] = useState(candidate.address);
    const nameId = useId(), addressId = useId();
    const place = { ...candidate, name: name.trim().slice(0, 160), address: address.slice(0, 400) };
    const named = Boolean(name.trim());
    return (
        <section className="gk-plan-pick" aria-label="Chosen place">
            <div className="gk-plan-pick__head">
                <h3>{target ? `Use as ${targetLabel(target)}` : 'Add this place to the plan'}</h3>
                <Button size="sm" variant="ghost" iconOnly aria-label="Cancel" onClick={onCancel}><X aria-hidden="true" /></Button>
            </div>
            <div className="gk-plan-grid">
                <Field label="Name" htmlFor={nameId}><input id={nameId} className="gk-input" autoFocus maxLength={160} value={name} placeholder="Name this place" onChange={event => setName(event.target.value)} /></Field>
                <Field label="Address or directions" htmlFor={addressId}><input id={addressId} className="gk-input" maxLength={400} value={address} placeholder="Street, entrance, gate" onChange={event => setAddress(event.target.value)} /></Field>
            </div>
            <div className="gk-row gk-plan-wrap">
                {target ? <Button variant="primary" size="sm" disabled={!named} onClick={() => onUse(place, target)}>{target in locationRoles ? `Use as ${locationRoles[target as LocationRole].label.toLowerCase()}` : 'Use this place'}</Button> : <>
                    <Button variant="primary" size="sm" disabled={!named} onClick={() => onUse(place, 'activity')}>Add as a stop</Button>
                    <Button size="sm" disabled={!named} onClick={() => onUse(place, 'meeting')}>Meeting point</Button>
                    <Button size="sm" disabled={!named} onClick={() => onUse(place, 'destination')}>Destination</Button>
                    <Button size="sm" variant="ghost" disabled={!named} onClick={() => onUse(place, 'place')}>Just save it</Button>
                </>}
            </div>
        </section>
    );
}

/**
 * Choosing a place for the plan: a hint while the map waits for a click, a search for a
 * city to jump to, and the chosen point to name before it joins the plan.
 */
export function PlacePicker({ planMap }: { planMap: PlanMap }) {
    const [query, setQuery] = useState('');
    const areas = useAreas(query);
    const searchId = useId();
    if (!planMap.pick && !planMap.candidate) return null;
    return (
        <div className="gk-plan-picker">
            {planMap.candidate ? <Confirm key={`${planMap.candidate.latitude},${planMap.candidate.longitude}`} candidate={planMap.candidate} target={planMap.pick} onUse={planMap.use} onCancel={planMap.cancel} /> : (
                <section className="gk-plan-pick" aria-label="Choose a place">
                    <div className="gk-plan-pick__head">
                        <h3><MapPin aria-hidden="true" />Click the map to choose {targetLabel(planMap.pick)}</h3>
                        <Button size="sm" variant="ghost" iconOnly aria-label="Stop choosing a place" onClick={planMap.cancel}><X aria-hidden="true" /></Button>
                    </div>
                    <span className="gk-search">
                        <Search aria-hidden="true" />
                        <input id={searchId} className="gk-input" type="search" aria-label="Find a city or town" placeholder="Or find a city or town" value={query} maxLength={120} onChange={event => setQuery(event.target.value)} />
                    </span>
                    {areas.items.length > 0 && (
                        <ul className="gk-plan-pick__results">
                            {areas.items.map(area => (
                                <li key={area.name}><button type="button" onClick={() => {
                                    setQuery('');
                                    const place: PlanPlace = { key: crypto.randomUUID(), name: area.cityName ?? area.name, address: [area.cityName, area.countryName].filter(Boolean).join(', '), latitude: area.latitude, longitude: area.longitude, type: 'MANUAL', notes: '' };
                                    planMap.focus(place, area.type === 'CITY' ? 12 : 7, true); planMap.propose(place);
                                }}><MapPin aria-hidden="true" /><span>{area.name}</span></button></li>
                            ))}
                        </ul>
                    )}
                    {areas.error && <p className="gk-faint">Search is unavailable. Click the map instead.</p>}
                </section>
            )}
        </div>
    );
}
