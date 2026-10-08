import type { StyleSpecification } from "maplibre-gl";
import { getHeritageStyle } from "../../components/map/heritageStyle";
import { MAP_STYLE_DEFAULT } from "../../components/map/mapLayers";
import { useEffect, useState } from "react";
import Map, { Marker, NavigationControl, useMap } from "react-map-gl/maplibre";
import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Venue } from "./api";
import { fromPrice, money } from "./utils";
import { venueMapLink } from './venueMapLink';

function FitVenues({ venues }: { venues: Venue[] }) {
  const { current: map } = useMap();
  useEffect(() => {
    if (!map || !venues.length) return;
    const points = venues.filter(
      (venue) => venue.latitude != null && venue.longitude != null,
    );
    if (!points.length) return;
    const lngs = points.map((venue) => venue.longitude!),
      lats = points.map((venue) => venue.latitude!);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 65, maxZoom: 13, duration: 400 },
    );
  }, [map, venues]);
  return null;
}

export function VenueMap({
  venues,
  selectedId,
  onSelect,
  onPick,
}: {
  venues: Venue[];
  selectedId?: number;
  onSelect?: (id: number) => void;
  onPick?: (lat: number, lng: number) => void;
}) {
  const [style, setStyle] = useState<StyleSpecification>();
  useEffect(() => { let active = true; void getHeritageStyle().then(value => { if (active) setStyle(value); }).catch(() => {}); return () => { active = false; }; }, []);
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <div className="venue-empty">
        <MapPin size={28} />
        <h3>Map unavailable</h3>
        <p>Stadium addresses and availability are still listed here.</p>
        <button className="venue-button" onClick={() => setFailed(false)}>
          Retry map
        </button>
      </div>
    );
  return (
    <div
      className="venue-map"
      aria-label={
        onPick ? "Click map to place stadium location" : "Stadium locations"
      }
    >
      <Map
        initialViewState={{
          latitude: venues[0]?.latitude ?? 41.7151,
          longitude: venues[0]?.longitude ?? 44.8271,
          zoom: 11,
        }}
        mapStyle={style ?? MAP_STYLE_DEFAULT}
        style={{ width: "100%", height: "100%" }}
        onError={() => setFailed(true)}
        onClick={(event) =>
          onPick?.(
            Number(event.lngLat.lat.toFixed(6)),
            Number(event.lngLat.lng.toFixed(6)),
          )
        }
        cursor={onPick ? "crosshair" : undefined}
      >
        <FitVenues venues={venues} />
        <NavigationControl position="bottom-right" />
        {venues
          .filter((venue) => venue.latitude != null && venue.longitude != null)
          .map((venue) => (
            <Marker
              key={venue.id}
              latitude={venue.latitude!}
              longitude={venue.longitude!}
              anchor="bottom"
            >
              {onPick ? (
                <span className="venue-map-pin">
                  <MapPin size={22} />
                </span>
              ) : !onSelect ? (
                <Link className="venue-map-pin" to={venueMapLink(venue.id)} aria-label={`Open ${venue.displayName} in GrassKickZ Map`}>
                  <MapPin size={14} />{fromPrice(venue) != null ? money(fromPrice(venue)!, venue.currency) : venue.displayName}
                </Link>
              ) : (
                <button
                  className={`venue-map-pin ${selectedId === venue.id ? "is-selected" : ""}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect?.(venue.id);
                  }}
                  aria-label={`Show ${venue.displayName}`}
                >
                  <MapPin size={14} />
                  {fromPrice(venue) != null
                    ? money(fromPrice(venue)!, venue.currency)
                    : venue.displayName}
                </button>
              )}
            </Marker>
          ))}
      </Map>
      {selectedId && venues.find((venue) => venue.id === selectedId) && (
        <Link className="venue-map-selection" to={`/stadiums/${selectedId}`}>
          <strong>
            {venues.find((venue) => venue.id === selectedId)?.displayName}
          </strong>
          <span>View stadium & availability →</span>
        </Link>
      )}
      {!venues.some((venue) => venue.latitude != null) && (
        <div className="venue-map-note">
          Stadiums with a saved location appear on this map.
        </div>
      )}
    </div>
  );
}
