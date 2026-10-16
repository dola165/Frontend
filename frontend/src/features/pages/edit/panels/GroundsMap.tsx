import { useRef } from 'react';
import Map, { Marker, NavigationControl, type MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapPin } from 'lucide-react';
import type { MapBounds } from '../../../../components/map/areaSearch';
import { useAppTheme, useBasemapStyle } from '../../../world/map/canvas/useMapTheme';
import type { Pitch } from '../../api';

/**
 * The map inside "Where do you play?": it opens with the town and its nearest pitches in view, the pitches as pins (a tap
 * adds one), the chosen ones lit, and a tap on empty ground drops a pin for a place that is not listed. Only the owner's
 * own panning reports the area, so the list keeps offering the nearest grounds until they move the map. It is drawn in
 * the app's own map style (World's), and the places named by the owner show as their own pins. Loaded only when the
 * panel opens.
 */
export default function GroundsMap({ center, pitches, chosen, dropped, places, onPick, onDrop, onBounds }: {
  center: { lat: number; lng: number }; pitches: Pitch[]; chosen: Set<string>; dropped: { lat: number; lng: number } | null; places: { lat: number; lng: number; name: string }[];
  onPick: (pitch: Pitch) => void; onDrop: (lat: number, lng: number) => void; onBounds: (bounds: MapBounds) => void;
}) {
  const theme = useAppTheme();
  const style = useBasemapStyle(theme);
  const map = useRef<MapRef>(null);
  const report = () => { const box = map.current?.getBounds(); if (box) onBounds({ west: box.getWest(), south: box.getSouth(), east: box.getEast(), north: box.getNorth() }); };
  // The town and the five nearest pitches, all in view from the first second.
  const near = [...pitches].sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 5);
  const lats = [center.lat, ...near.map(pitch => pitch.latitude)], lngs = [center.lng, ...near.map(pitch => pitch.longitude)];
  const view = near.length
    ? { bounds: [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]] as [[number, number], [number, number]], fitBoundsOptions: { padding: 48, maxZoom: 15 } }
    : { latitude: center.lat, longitude: center.lng, zoom: 12 };
  if (!style) return <div className="gk-grounds-map" aria-busy="true" />;
  return (
    <div className="gk-grounds-map">
      <Map ref={map} initialViewState={view} mapStyle={style}
        onMoveEnd={event => { if (event.originalEvent) report(); }} onClick={event => onDrop(event.lngLat.lat, event.lngLat.lng)} attributionControl={false}>
        <NavigationControl showCompass={false} />
        {pitches.map(pitch => (
          <Marker key={pitch.id} latitude={pitch.latitude} longitude={pitch.longitude} anchor="center" onClick={event => { event.originalEvent.stopPropagation(); onPick(pitch); }}>
            <button type="button" className="gk-grounds-pin" data-chosen={chosen.has(pitch.id) || undefined} aria-label={pitch.name} title={pitch.name}><MapPin aria-hidden="true" /></button>
          </Marker>
        ))}
        {places.map(place => <Marker key={`${place.name}-${place.lat}`} latitude={place.lat} longitude={place.lng} anchor="center"><span className="gk-grounds-pin" data-chosen title={place.name} aria-label={place.name}><MapPin aria-hidden="true" /></span></Marker>)}
        {dropped && <Marker latitude={dropped.lat} longitude={dropped.lng} anchor="center"><span className="gk-grounds-pin gk-grounds-pin--dropped" aria-hidden="true"><MapPin /></span></Marker>}
      </Map>
    </div>
  );
}
