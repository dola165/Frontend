import { useRef } from 'react';
import Map, { Marker, NavigationControl, type MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapPin } from 'lucide-react';
import type { MapBounds } from '../../../../components/map/areaSearch';
import { MAP_STYLE_DARK, MAP_STYLE_DEFAULT } from '../../../../components/map/mapLayers';
import { useAppTheme } from '../../../world/map/canvas/useMapTheme';
import type { Pitch } from '../../api';

/**
 * The map inside "Where do you play?": centred on the town, the pitches nearby as pins (a tap adds one), the chosen
 * ones lit, and a tap on empty ground drops a pin for a place that is not listed. Loaded only when the panel opens.
 */
export default function GroundsMap({ center, pitches, chosen, dropped, onPick, onDrop, onBounds }: {
  center: { lat: number; lng: number }; pitches: Pitch[]; chosen: Set<string>; dropped: { lat: number; lng: number } | null;
  onPick: (pitch: Pitch) => void; onDrop: (lat: number, lng: number) => void; onBounds: (bounds: MapBounds) => void;
}) {
  const theme = useAppTheme();
  const map = useRef<MapRef>(null);
  const report = () => { const box = map.current?.getBounds(); if (box) onBounds({ west: box.getWest(), south: box.getSouth(), east: box.getEast(), north: box.getNorth() }); };
  return (
    <div className="gk-grounds-map">
      <Map ref={map} initialViewState={{ latitude: center.lat, longitude: center.lng, zoom: 12 }} mapStyle={theme === 'dark' ? MAP_STYLE_DARK : MAP_STYLE_DEFAULT}
        onLoad={report} onMoveEnd={report} onClick={event => onDrop(event.lngLat.lat, event.lngLat.lng)} attributionControl={false}>
        <NavigationControl showCompass={false} />
        {pitches.map(pitch => (
          <Marker key={pitch.id} latitude={pitch.latitude} longitude={pitch.longitude} anchor="center" onClick={event => { event.originalEvent.stopPropagation(); onPick(pitch); }}>
            <button type="button" className="gk-grounds-pin" data-chosen={chosen.has(pitch.id) || undefined} aria-label={pitch.name} title={pitch.name}><MapPin aria-hidden="true" /></button>
          </Marker>
        ))}
        {dropped && <Marker latitude={dropped.lat} longitude={dropped.lng} anchor="center"><span className="gk-grounds-pin gk-grounds-pin--dropped" aria-hidden="true"><MapPin /></span></Marker>}
      </Map>
    </div>
  );
}
