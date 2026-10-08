import { useEffect, useState } from 'react';
import { MapPin, Search, X } from 'lucide-react';
import { apiClient } from '../../api/axiosConfig';
import type { GeocodeResult } from '../../api/map';
import type { PlanDraft, PlanPlace } from './api';
import { locationRoles, type LocationRole, type PickTarget } from './mapPlanning';

export function PlanningMapTools({ draft, target, candidate, onPick, onSelect, onFocus, onUse, onCancel,stopCount=0,connections=true,onConnections }: {
  draft: PlanDraft; target: PickTarget | null; candidate: PlanPlace | null;
  onPick: (target: PickTarget) => void; onSelect: (place: PlanPlace) => void; onFocus: (place: PlanPlace) => void;
  onUse: (place: PlanPlace, target: PickTarget) => void; onCancel: () => void;
  stopCount?:number;connections?:boolean;onConnections?:(show:boolean)=>void;
}) {
  const [query, setQuery] = useState(''), [results, setResults] = useState<GeocodeResult[]>([]), [message, setMessage] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    if (query.trim().length < 3) return;
    const timer = setTimeout(() => {
      setMessage('Searching…');
      void apiClient.get<GeocodeResult[]>('/map/geocode', { params: { q: query.trim() }, signal: controller.signal }).then(response => {
        if (!controller.signal.aborted) { setResults(response.data.slice(0, 6)); setMessage(response.data.length ? '' : 'No city found. Click the map to choose any address or place.'); }
      }).catch(() => { if (!controller.signal.aborted) setMessage('Search is unavailable. You can still choose a place on the map.'); });
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);
  return <div className="mp-map-tools">
    <div className="mp-map-search"><Search size={16} /><input aria-label="Find a city on the planning map" placeholder="Find a city" value={query} maxLength={200} onChange={event => {setQuery(event.target.value);setResults([]);setMessage('');}} />{query && <button className="mp-icon" aria-label="Clear place search" onClick={() => {setQuery('');setResults([]);setMessage('');}}><X size={15}/></button>}</div>
    {!!results.length && <ul className="mp-location-results">{results.map((result, index) => <li key={index}><button onClick={() => { const place: PlanPlace = { key: crypto.randomUUID(), name: result.name, address: [result.cityName, result.countryName].filter(Boolean).join(', '), latitude: result.latitude, longitude: result.longitude, type: 'MANUAL', notes: '' }; setQuery(''); setResults([]); onFocus(place); onSelect(place); }}><MapPin size={15}/><span>{result.name}<small>{result.countryName}</small></span></button></li>)}</ul>}
    {message && <p className="mp-map-hint" role="status">{message}</p>}
    <div className="mp-map-shortcuts">{(Object.keys(locationRoles) as LocationRole[]).map(role => { const saved = draft.places.find(p => p.key === locationRoles[role].key); return <button key={role} onClick={() => saved ? onFocus(saved) : onPick(role)} title={saved ? 'Show on map' : 'Choose on map'}><span className={`mp-location-badge mp-location-badge--${role}`}>{locationRoles[role].marker}</span>{locationRoles[role].label}</button>; })}</div>
    {stopCount>1&&<button className="mp-stop-order" aria-pressed={connections} onClick={()=>onConnections?.(!connections)}><span className="mp-stop-order-line"/>{connections?'Stop connections shown':'Show stop connections'}<small>Direct links between stops · not a road route</small></button>}
    {target && !candidate && <div className="mp-map-hint" role="status"><MapPin size={16}/><span>Click anywhere on the map to choose {target && target in locationRoles ? locationRoles[target as LocationRole].label.toLowerCase() : 'a place'}.</span><button className="mp-icon" aria-label="Cancel choosing a place" onClick={onCancel}><X size={15}/></button></div>}
    {candidate && <MapPlaceChoice key={candidate.key+candidate.latitude+candidate.longitude} candidate={candidate} target={target} onUse={onUse} onCancel={onCancel}/>}
  </div>;
}

function MapPlaceChoice({candidate,target,onUse,onCancel}:{candidate:PlanPlace;target:PickTarget|null;onUse:(place:PlanPlace,target:PickTarget)=>void;onCancel:()=>void}) {
  const [name,setName]=useState(candidate.name),[address,setAddress]=useState(candidate.address);
  const use=(as:PickTarget)=>{if(name.trim())onUse({...candidate,name:name.trim().slice(0,160),address:address.slice(0,400)},as);};
  return <section className="mp-map-choice" aria-label="Selected map location"><div className="mp-between"><h3>{target && target in locationRoles ? `Choose ${locationRoles[target as LocationRole].label.toLowerCase()}` : 'Add this place to your plan'}</h3><button className="mp-icon" aria-label="Close selected location" onClick={onCancel}><X size={17}/></button></div><label className="mp-field"><span>Place name</span><input autoFocus required maxLength={160} value={name} onChange={event => setName(event.target.value)} placeholder="Name this place"/></label><label className="mp-field"><span>Address or entrance details</span><input maxLength={400} value={address} onChange={event => setAddress(event.target.value)} placeholder="Street, entrance or useful directions"/></label><div className="mp-actions">{target ? <button className="mp-primary" disabled={!name.trim()} onClick={() => use(target)}>{target && target in locationRoles ? `Use as ${locationRoles[target as LocationRole].label.toLowerCase()}` : target === 'activity' ? 'Use for this activity' : 'Save place'}</button> : <><button className="mp-primary" disabled={!name.trim()} onClick={() => use('place')}>Save place</button><button className="mp-secondary" disabled={!name.trim()} onClick={() => use('activity')}>Add to schedule</button><button className="mp-link" disabled={!name.trim()} onClick={() => use('destination')}>Destination</button><button className="mp-link" disabled={!name.trim()} onClick={() => use('meeting')}>Meeting place</button></>}</div></section>;
}
