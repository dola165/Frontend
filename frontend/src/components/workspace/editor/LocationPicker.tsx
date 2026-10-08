import { useEffect, useRef, useState } from 'react';
import Map, { Marker, NavigationControl, type MapRef } from 'react-map-gl/maplibre';
import { MapPin } from 'lucide-react';
import type { StyleSpecification } from 'maplibre-gl';
import { geocodePlace, type GeocodeResult } from '../../../api/map';
import { getHeritageStyle } from '../../map/heritageStyle';
import 'maplibre-gl/dist/maplibre-gl.css';
import './editor-fields.css';

export function LocationPicker({ latitude, longitude, onChange }: { latitude: string; longitude: string; onChange: (lat: string, lng: string) => void }) {
  const map = useRef<MapRef>(null), request = useRef(0);
  const [query, setQuery] = useState(''), [places, setPlaces] = useState<GeocodeResult[]>([]), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
  const [style,setStyle]=useState<StyleSpecification>();
  useEffect(()=>{let active=true;void getHeritageStyle('light',{includeTerrain:false}).then(value=>{if(active)setStyle(value);}).catch(()=>{if(active)setNotice('Map could not load. You can enter coordinates below.');});return()=>{active=false;};},[]);
  const valid = latitude.trim() !== '' && longitude.trim() !== '' && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude)) && Math.abs(Number(latitude)) <= 90 && Math.abs(Number(longitude)) <= 180;
  useEffect(() => () => { request.current++; }, []);
  async function search() {
    const attempt = ++request.current; setBusy(true);
    try { const found = await geocodePlace(query, { type: 'CITY' }); if (attempt !== request.current) return; setPlaces(found); setNotice(found.length ? '' : 'No matching city. You can still move the map and place the entrance pin.'); }
    catch { if (attempt === request.current) setNotice('City search is unavailable. Move the map or use the coordinates below.'); }
    finally { if (attempt === request.current) setBusy(false); }
  }
  return <div className="editor-location">
    <p>Find the city, then click or drag the pin to the entrance visitors should use. This pin helps with directions; it does not change your address or reserve a venue.</p>
    <div className="editor-location-search"><label>Find a city<input value={query} placeholder="e.g. Tbilisi" onChange={e => { request.current++; setBusy(false); setPlaces([]); setQuery(e.target.value); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (query.trim().length >= 2) void search(); } }}/></label><button type="button" disabled={busy || query.trim().length < 2} onClick={() => void search()}>{busy ? 'Searching…' : 'Find city'}</button></div>
    {notice && <p role="status">{notice}</p>}
    {places.length > 0 && <div className="editor-location-results">{places.map((p, i) => <button type="button" key={i} onClick={() => { map.current?.flyTo({ center: [p.longitude, p.latitude], zoom: 13 }); setPlaces([]); }}>{p.name}</button>)}</div>}
    <div className="editor-location-map"><Map ref={map} initialViewState={{ latitude: valid ? Number(latitude) : 41.7151, longitude: valid ? Number(longitude) : 44.8271, zoom: valid ? 16 : 11 }} mapStyle={style} dragRotate={false} touchPitch={false} onClick={e => onChange(e.lngLat.lat.toFixed(6), e.lngLat.lng.toFixed(6))} onError={() => setNotice('Map could not load. Keep the street address, or enter coordinates below.')}><NavigationControl showCompass={false}/>{valid && <Marker latitude={Number(latitude)} longitude={Number(longitude)} draggable onDragEnd={e => onChange(e.lngLat.lat.toFixed(6), e.lngLat.lng.toFixed(6))}><MapPin size={30} aria-label="Visitor entrance" color="var(--color-accent)"/></Marker>}</Map></div>
    <div className="editor-location-status"><span>{valid ? 'Entrance pin set' : 'No entrance pin set yet'}</span>{(latitude || longitude) && <button type="button" onClick={() => onChange('', '')}>Remove pin</button>}</div>
    <details><summary>Enter coordinates manually</summary><p>Optional keyboard alternative. Enter both values, or leave both empty.</p><div className="editor-field-grid"><label>Latitude<input type="number" min={-90} max={90} step="any" value={latitude} required={longitude !== ''} onChange={e => onChange(e.target.value, longitude)}/></label><label>Longitude<input type="number" min={-180} max={180} step="any" value={longitude} required={latitude !== ''} onChange={e => onChange(latitude, e.target.value)}/></label></div></details>
  </div>;
}
