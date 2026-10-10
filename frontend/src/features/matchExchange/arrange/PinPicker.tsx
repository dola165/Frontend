import { useRef, useState } from 'react';
import Map, { Marker, NavigationControl, type MapRef } from 'react-map-gl/maplibre';
import { MapPin } from 'lucide-react';
import { geocodePlace } from '../../../api/map';
import { MAP_STYLE_DEFAULT } from '../../../components/map/mapLayers';
import { Button, Chip } from '../../../design/primitives';
import 'maplibre-gl/dist/maplibre-gl.css';

const TBILISI = { latitude: 41.7151, longitude: 44.8271 };

/** Marks a ground that is not on GrassKickZ. It records where to meet; it reserves nothing. */
export default function PinPicker({ latitude, longitude, onChange }: { latitude: string; longitude: string; onChange: (latitude: string, longitude: string) => void }) {
    const map = useRef<MapRef>(null);
    const [query, setQuery] = useState('');
    const [places, setPlaces] = useState<{ name: string; latitude: number; longitude: number }[]>([]);
    const [notice, setNotice] = useState('');
    const pin = (lat: number, lng: number) => onChange(lat.toFixed(6), lng.toFixed(6));
    async function find() {
        try {
            const found = await geocodePlace(query, { type: 'CITY' });
            setPlaces(found);
            setNotice(found.length ? '' : 'No town found. Move the map or enter coordinates below.');
        } catch { setNotice('Place search is unavailable. You can still drop the pin on the map.'); }
    }
    return (
        <div className="gk-arrange__pin">
            <div className="gk-arrange__pin-search">
                <label className="gk-visually-hidden" htmlFor="arrange-pin-search">Find a town</label>
                <input id="arrange-pin-search" className="gk-input" value={query} placeholder="Find a town, then tap the ground" onChange={event => setQuery(event.target.value)}
                    onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void find(); } }} />
                <Button onClick={() => void find()} disabled={query.trim().length < 2}>Find</Button>
            </div>
            {notice && <p className="gk-field__hint" role="status">{notice}</p>}
            {places.length > 0 && <div className="gk-chips">{places.map(place => (
                <Chip key={`${place.name}:${place.latitude}`} onClick={() => { map.current?.flyTo({ center: [place.longitude, place.latitude], zoom: 13 }); setPlaces([]); }}>{place.name}</Chip>
            ))}</div>}
            <div className="gk-arrange__map">
                <Map ref={map} initialViewState={{ latitude: latitude ? Number(latitude) : TBILISI.latitude, longitude: longitude ? Number(longitude) : TBILISI.longitude, zoom: latitude ? 14 : 11 }}
                    mapStyle={MAP_STYLE_DEFAULT} onClick={event => pin(event.lngLat.lat, event.lngLat.lng)}
                    onError={() => setNotice('The map could not load. Enter the coordinates below instead.')}>
                    <NavigationControl showCompass={false} />
                    {latitude && longitude && <Marker latitude={Number(latitude)} longitude={Number(longitude)} anchor="bottom" draggable onDragEnd={event => pin(event.lngLat.lat, event.lngLat.lng)}>
                        <MapPin aria-label="Selected ground" size={34} className="gk-arrange__marker" />
                    </Marker>}
                </Map>
            </div>
            <details className="gk-arrange__coords">
                <summary>Enter coordinates instead</summary>
                <div className="gk-arrange__kickoff">
                    <input aria-label="Latitude" className="gk-input" type="number" min={-90} max={90} step="any" value={latitude} onChange={event => onChange(event.target.value, longitude)} />
                    <input aria-label="Longitude" className="gk-input" type="number" min={-180} max={180} step="any" value={longitude} onChange={event => onChange(latitude, event.target.value)} />
                </div>
            </details>
        </div>
    );
}
