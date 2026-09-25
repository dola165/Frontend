import Map, { Marker, NavigationControl } from "react-map-gl/maplibre";
import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import { MAP_STYLE_DEFAULT } from "../../components/map/mapLayers";
import type { Match } from "./api";
import "maplibre-gl/dist/maplibre-gl.css";
export default function MatchMap({ matches }: { matches: Match[] }) {
  const points = matches.filter(
    (m) => m.location_lat != null && m.location_lng != null,
  );
  return (
    <div className="mx-map" aria-label="Match locations">
      {!points.length ? (
        <p className="mx-empty">
          No map locations in these results. City and meeting details are shown
          on each listing.
        </p>
      ) : (
        <Map
          initialViewState={{
            latitude: Number(points[0].location_lat),
            longitude: Number(points[0].location_lng),
            zoom: 9,
          }}
          mapStyle={MAP_STYLE_DEFAULT}
          style={{ width: "100%", height: "100%" }}
        >
          <NavigationControl />
          {points.map((m) => (
            <Marker
              key={m.event_id}
              latitude={Number(m.location_lat)}
              longitude={Number(m.location_lng)}
            >
              <Link
                className="mx-button mx-map-pin"
                aria-label={`${m.title}, ${m.city}`}
                title={`${m.title} · ${m.city}`}
                to={`/match-exchange/${m.event_id}`}
              >
                <MapPin size={20} />
              </Link>
            </Marker>
          ))}
        </Map>
      )}
    </div>
  );
}
