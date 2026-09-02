// Pure config for the map point layers (no React).
// Basemap: OpenFreeMap positron in BOTH light and dark mode — the single
// reliable style URL (the old VersaTiles fiord dark style is dead/404; dark
// mode is a CSS "dusk" filter on the canvas, see index.css .map-dusk).
// TILTED keeps the keyed MapTiler style.
export const MAP_STYLE_DEFAULT = 'https://tiles.openfreemap.org/styles/positron';
// Google-Maps-inspired marker set: calm blue cluster/select accent, warm
// multi-hue data colors that stay distinguishable on the light basemap.
export const MAP_ENTITY_COLORS: Record<string, string> = {
  CLUB: '#15803d', TRYOUT: '#d97706', MATCH: '#e11d48', TOURNAMENT: '#4f46e5'
};
export const MAP_ACCENT = '#047857';
export const MAP_LOCATION_PIN_IMAGE = 'grasskickz-football-location-pin';
export const MAP_SELECTED_PIN_IMAGE = 'grasskickz-football-location-pin-selected';
export const MAP_CLUSTER_IMAGE = 'grasskickz-football-cluster';
export const MAP_PIN_ASSETS = [
  { id: MAP_LOCATION_PIN_IMAGE, url: '/map-pins/football-location-pin.png' },
  { id: MAP_SELECTED_PIN_IMAGE, url: '/map-pins/football-location-pin-selected.png' },
  { id: MAP_CLUSTER_IMAGE, url: '/map-pins/football-cluster.png' }
] as const;
export interface MapPointInput { key: string; entityType: string; latitude: number; longitude: number; title: string }
export const buildPointsFeatureCollection = (points: MapPointInput[]) => ({
  type: 'FeatureCollection' as const,
  features: points.map((p) => ({
    type: 'Feature' as const,
    id: undefined,
    properties: { key: p.key, entityType: p.entityType, title: p.title, icon: MAP_LOCATION_PIN_IMAGE },
    geometry: { type: 'Point' as const, coordinates: [p.longitude, p.latitude] }
  }))
});
export const MAP_POINTS_SOURCE_ID = 'map-points';
export const LAYER_CLUSTERS = 'points-clusters';
export const LAYER_CLUSTER_COUNT = 'points-cluster-count';
export const LAYER_POINT_HALO = 'points-halo';
export const LAYER_POINTS = 'points-circle';

// ── Vivid basemap paints (positron restyle) ──────────────────────────
// Stock positron is lifeless (grey water, white roads). This pure transform
// deep-clones a fetched positron style and recolors its paints. Matched
// against the REAL positron layer ids (fetched from
// tiles.openfreemap.org/styles/positron, source 'openmaptiles'):
//   water polygons : 'water'            (source-layer 'water')
//   waterway lines : 'waterway'         (source-layer 'waterway')
//   buildings      : 'building'         (source-layer 'building')
//   boundaries     : 'boundary_2' | 'boundary_3' | 'boundary_disputed'
//                                        (source-layer 'boundary')
//   motorway fills : 'highway_motorway_inner' | 'highway_motorway_subtle' |
//                    'tunnel_motorway_inner' | 'highway_motorway_bridge_inner'
//                    (source-layer 'transportation', class == 'motorway')
//   major roads    : 'highway_major_inner' | 'highway_major_subtle'
//                    (source-layer 'transportation'; ONE filter carries all of
//                    ['primary','secondary','tertiary','trunk'], so per-class
//                    colors need a match on ['get','class'])
//   minor roads    : 'highway_minor' (class in ['minor','service','track'])
//                    and 'highway_path' (class == 'path')
// Casings ('*_casing'), labels/symbols ('transportation_name', 'place', ...),
// landuse/park fills and everything else are left untouched.
type MapStyleLayer = {
    id: string;
    type?: string;
    paint?: Record<string, unknown>;
};
type MapStyleObject = {
    layers?: MapStyleLayer[];
    [key: string]: unknown;
};

const VIVID_COLORS = {
    water: '#b7dce8',
    waterway: '#8fc5d8',
    motorway: '#efc36d',
    primary: '#ffffff',
    secondary: '#f8fafc',
    tertiary: '#e5e7eb',
    minor: '#d7dce1',
    boundary: '#8b98a7',
    building: '#dfe5e8'
} as const;

// Scale a line-width that is either a constant or a zoom interpolate. Only the
// width outputs (every second entry from index 3) are scaled — zoom inputs stay.
const scaleLineWidth = (width: unknown, factor: number): unknown => {
    if (typeof width === 'number') return Math.round(width * factor * 100) / 100;
    if (Array.isArray(width) && width[0] === 'interpolate') {
        const next = [...width];
        for (let i = 3; i < next.length; i += 2) {
            if (typeof next[i] === 'number') {
                next[i] = Math.round((next[i] as number) * factor * 100) / 100;
            }
        }
        return next;
    }
    return width;
};

const setLineColor = (layer: MapStyleLayer, color: unknown) => {
    if (layer.type === 'line' && layer.paint) layer.paint['line-color'] = color;
};

const widenMainRoad = (layer: MapStyleLayer, factor = 1.3) => {
    if (layer.type === 'line' && layer.paint && layer.paint['line-width'] !== undefined) {
        layer.paint['line-width'] = scaleLineWidth(layer.paint['line-width'], factor);
    }
};

export const withVividPaints = <T extends MapStyleObject>(style: T): T => {
    const vivid = JSON.parse(JSON.stringify(style)) as T;
    if (!Array.isArray(vivid.layers)) return vivid;
    for (const layer of vivid.layers) {
        switch (layer.id) {
            case 'water':
                if (layer.type === 'fill' && layer.paint) {
                    layer.paint['fill-color'] = VIVID_COLORS.water;
                    layer.paint['fill-opacity'] = 1;
                }
                break;
            case 'waterway':
                setLineColor(layer, VIVID_COLORS.waterway);
                break;
            case 'building':
                if (layer.type === 'fill' && layer.paint) {
                    layer.paint['fill-color'] = VIVID_COLORS.building;
                    layer.paint['fill-opacity'] = 0.7;
                }
                break;
            case 'boundary_2':
            case 'boundary_3':
            case 'boundary_disputed':
                setLineColor(layer, VIVID_COLORS.boundary);
                break;
            case 'highway_motorway_inner':
            case 'highway_motorway_subtle':
            case 'tunnel_motorway_inner':
            case 'highway_motorway_bridge_inner':
                setLineColor(layer, VIVID_COLORS.motorway);
                widenMainRoad(layer);
                break;
            case 'highway_major_inner':
            case 'highway_major_subtle':
                // One layer carries primary+secondary+tertiary+trunk — color by class.
                setLineColor(layer, [
                    'match', ['get', 'class'],
                    'trunk', VIVID_COLORS.motorway,
                    'primary', VIVID_COLORS.primary,
                    'secondary', VIVID_COLORS.secondary,
                    'tertiary', VIVID_COLORS.tertiary,
                    VIVID_COLORS.tertiary
                ]);
                widenMainRoad(layer);
                break;
            case 'highway_minor':
            case 'highway_path':
                setLineColor(layer, VIVID_COLORS.minor);
                break;
            default:
                break; // casings, labels/symbols, landuse, ... untouched
        }
    }
    return vivid;
};

// A real dark basemap, derived from the same reliable OpenFreeMap style.
// Repainting the style keeps our custom football pin images untouched; a CSS
// invert/filter would also recolour the pins and make labels hard to read.
export const withDarkPaints = <T extends MapStyleObject>(style: T): T => {
    const dark = JSON.parse(JSON.stringify(style)) as T;
    if (!Array.isArray(dark.layers)) return dark;

    for (const layer of dark.layers) {
        const paint = layer.paint;
        if (!paint) continue;
        const id = layer.id.toLocaleLowerCase();

        if (layer.type === 'background') {
            paint['background-color'] = '#11171d';
            continue;
        }

        if (layer.type === 'fill') {
            paint['fill-color'] = id.includes('water')
                ? '#173c4b'
                : id.includes('building')
                    ? '#2b3239'
                    : /(park|grass|wood|forest|landcover)/.test(id)
                        ? '#182a24'
                        : '#181e24';
            if (paint['fill-outline-color'] !== undefined) paint['fill-outline-color'] = '#343d46';
            continue;
        }

        if (layer.type === 'line') {
            paint['line-color'] = id.includes('water')
                ? '#2d6275'
                : id.includes('boundary')
                    ? '#66727f'
                    : /(motorway|trunk)/.test(id)
                        ? '#8d7543'
                        : /(highway|road|street|transport)/.test(id)
                            ? '#48515a'
                            : '#36414a';
            continue;
        }

        if (layer.type === 'symbol') {
            if (paint['text-color'] !== undefined) paint['text-color'] = '#dbe2e8';
            if (paint['text-halo-color'] !== undefined) paint['text-halo-color'] = '#11171d';
            if (paint['text-halo-width'] !== undefined) paint['text-halo-width'] = 1.25;
            continue;
        }

        if (layer.type === 'fill-extrusion') {
            paint['fill-extrusion-color'] = '#2b3239';
            continue;
        }

        if (layer.type === 'raster') {
            paint['raster-brightness-max'] = 0.55;
            paint['raster-saturation'] = -0.35;
        }
    }

    return dark;
};
