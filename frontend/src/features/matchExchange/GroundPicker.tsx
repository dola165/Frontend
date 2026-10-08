import { useRef, useState } from 'react';
import Map, { Marker, NavigationControl, type MapRef } from 'react-map-gl/maplibre';
import { MapPin } from 'lucide-react';
import { geocodePlace, type GeocodeResult } from '../../api/map';
import { MAP_STYLE_DEFAULT } from '../../components/map/mapLayers';
import 'maplibre-gl/dist/maplibre-gl.css';

export default function GroundPicker({ latitude, longitude, onChange }: { latitude: string; longitude: string; onChange: (lat: string, lng: string) => void }) {
  const map = useRef<MapRef>(null);
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState<GeocodeResult[]>([]);
  const [notice, setNotice] = useState('');
  async function search() {
    try { const found = await geocodePlace(query, { type: 'CITY' }); setPlaces(found); setNotice(found.length ? '' : 'No city found. Move the map or enter coordinates below.'); }
    catch { setNotice('City search is unavailable. You can still place the pin on the map.'); }
  }
  return <div className="mx-wide">
    <div className="mx-ground-search"><label>Find a city<input aria-label="Find a city" value={query} onChange={e => setQuery(e.target.value)} placeholder="Tbilisi" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void search(); } }} /></label><button type="button" onClick={() => void search()} disabled={query.trim().length < 2}>Find</button></div>
    {notice && <p role="status">{notice}</p>}
    {places.length > 0 && <div className="mx-ground-results">{places.map((p, i) => <button type="button" key={i} onClick={() => { map.current?.flyTo({ center: [p.longitude, p.latitude], zoom: 13 }); setPlaces([]); }}>{p.name}</button>)}</div>}
    <p className="mx-muted">Select the exact ground on the map. This sets a meeting point; it does not reserve a pitch.</p>
    <div className="mx-ground-map"><Map ref={map} initialViewState={{ latitude: latitude ? Number(latitude) : 41.7151, longitude: longitude ? Number(longitude) : 44.8271, zoom: latitude ? 14 : 11 }} mapStyle={MAP_STYLE_DEFAULT} onClick={e => onChange(e.lngLat.lat.toFixed(6), e.lngLat.lng.toFixed(6))} onError={() => setNotice('Map tiles could not load. Use the ground address or coordinates below.')}><NavigationControl />{latitude && longitude && <Marker latitude={Number(latitude)} longitude={Number(longitude)} draggable onDragEnd={e => onChange(e.lngLat.lat.toFixed(6), e.lngLat.lng.toFixed(6))}><MapPin aria-label="Selected ground" size={32} color="var(--color-accent)" /></Marker>}</Map></div>
    <details><summary>Coordinates / keyboard alternative</summary><div className="mx-form"><label>Latitude<input aria-label="Latitude" type="number" min={-90} max={90} step="any" value={latitude} onChange={e => onChange(e.target.value, longitude)} /></label><label>Longitude<input aria-label="Longitude" type="number" min={-180} max={180} step="any" value={longitude} onChange={e => onChange(latitude, e.target.value)} /></label></div></details>
  </div>;
}
