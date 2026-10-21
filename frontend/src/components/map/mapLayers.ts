import { visualColors } from '../../styles/visualColors';
// Basemap styles (no React). OpenFreeMap positron is the shared foundation; the app
// recolours it for the light and dark themes. The explicit dark URL is a fallback.
// A build may point every map at its own style: the offline sandbox serves a local one
// because tile hosts are unreachable there. Production builds leave it unset.
const styleOverride = import.meta.env.VITE_MAP_STYLE_URL as string | undefined;
export const MAP_STYLE_OVERRIDDEN = Boolean(styleOverride);
const styleUrl = (url: string) => styleOverride ? new URL(styleOverride, typeof window === 'undefined' ? 'http://localhost' : window.location.origin).href : url;
export const MAP_STYLE_DEFAULT = styleUrl('https://tiles.openfreemap.org/styles/positron');
export const MAP_STYLE_DARK = styleUrl('https://tiles.openfreemap.org/styles/dark');
/** Unsaturated Browns inspiration: warm mineral ground, sage vegetation, deep estuary water. */
export const withHeritagePaints = <T extends MapStyleObject>(style: T, { includeTerrain = true } = {}): T => {
    const result = structuredClone(style);
    for (const layer of result.layers ?? []) {
        const paint = layer.paint ?? (layer.paint = {});
        const id = layer.id.toLowerCase();
        if (layer.type === 'background') paint['background-color'] = visualColors.mapLayersPaint107;
        if (layer.type === 'fill') {
            paint['fill-color'] = /water/.test(id) ? visualColors.mapLayersPaint108
                : /building/.test(id) ? visualColors.mapLayersPaint109
                : /ice|glacier/.test(id) ? visualColors.mapLayersPaint110
                : /wood|forest/.test(id) ? visualColors.mapLayersPaint111
                : /park|grass|garden|pitch|landcover/.test(id) ? visualColors.mapLayersPaint112
                : /sand/.test(id) ? visualColors.mapLayersPaint113
                : /residential/.test(id) ? visualColors.mapLayersPaint114 : visualColors.mapLayersPaint115;
            // Positron hides woods below z10, despite generalized woods being available.
            if (/wood|forest/.test(id)) layer.minzoom = 0;
            if (/water|park|grass|wood|forest/.test(id)) paint['fill-opacity'] = 1;
            if (/building/.test(id)) { paint['fill-opacity'] = .65; paint['fill-outline-color'] = visualColors.mapLayersPaint116; }
        }
        if (layer.type === 'line') {
            paint['line-color'] = /water/.test(id) ? visualColors.mapLayersPaint108 : /boundary/.test(id) ? visualColors.mapLayersPaint117
                : /casing/.test(id) ? visualColors.mapLayersPaint118 : /motorway|trunk/.test(id) ? visualColors.mapLayersPaint119
                : /path|track/.test(id) ? visualColors.mapLayersPaint120 : /rail/.test(id) ? visualColors.mapLayersPaint121 : visualColors.paper;
        }
        if (layer.type === 'symbol') {
            if (paint['text-color'] !== undefined) paint['text-color'] = /water/.test(id) ? visualColors.mapLayersPaint122 : /park/.test(id) ? visualColors.mapLayersPaint123 : visualColors.mapLayersPaint124;
            if (paint['text-halo-color'] !== undefined) paint['text-halo-color'] = /water/.test(id) ? visualColors.mapLayersPaint108 : visualColors.mapLayersPaint125;
            if (paint['text-halo-width'] !== undefined) paint['text-halo-width'] = 1.3;
        }
    }
    // Phones keep the same streets, labels and palette without fetching and
    // rendering a second tile set solely for decorative elevation shading.
    if (!includeTerrain) return result;

    // Real DEM elevation provides continuous regional relief even where vector
    // landcover is sparse. A shared source keeps the two terrain layers economical.
    result.sources = { ...(result.sources as Record<string, unknown> ?? {}), 'atlas-elevation': {
        type: 'raster-dem', tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
        encoding: 'terrarium', tileSize: 256, maxzoom: 12,
        attribution: '<a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md">Terrain: Mapzen / USGS / GMTED2010 / SRTM</a>'
    } };
    const layers = result.layers ?? [];
    const terrain: MapStyleLayer[] = [
        { id: 'atlas-elevation-colors', type: 'color-relief', source: 'atlas-elevation', paint: {
            'color-relief-color': ['interpolate', ['linear'], ['elevation'],
                -500, visualColors.mapLayersPaint126, 0, visualColors.mapLayersPaint127, 350, visualColors.mapLayersPaint128, 800, visualColors.mapLayersPaint129,
                1400, visualColors.mapLayersPaint130, 2200, visualColors.mapLayersPaint131, 3200, visualColors.mapLayersPaint132, 4300, visualColors.mapLayersPaint133, 6500, visualColors.paper],
            'color-relief-opacity': ['interpolate', ['linear'], ['zoom'], 0, .65, 7, .62, 10, .34, 13, .12, 16, .06]
        } },
        { id: 'atlas-hillshade', type: 'hillshade', source: 'atlas-elevation', paint: {
            'hillshade-shadow-color': visualColors.mapLayersPaint134, 'hillshade-highlight-color': visualColors.paper,
            'hillshade-accent-color': visualColors.mapLayersPaint135, 'hillshade-illumination-anchor': 'map',
            'hillshade-exaggeration': ['interpolate', ['linear'], ['zoom'], 0, .5, 6, .7, 10, .55, 14, .24]
        } }
    ];
    // Under water/parks/roads: relief never tints lakes, labels or streets.
    layers.splice(Math.max(0, layers.findIndex(layer => layer.type !== 'background')), 0, ...terrain);
    result.layers = layers;
    return result;
};
type MapStyleLayer = {
    id: string;
    type?: string;
    minzoom?: number;
    source?: string;
    paint?: Record<string, unknown>;
};
type MapStyleObject = {
    layers?: MapStyleLayer[];
    sources?: Record<string, unknown>;
    [key: string]: unknown;
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
            paint['background-color'] = visualColors.mapLayersPaint144;
            continue;
        }

        if (layer.type === 'fill') {
            paint['fill-color'] = id.includes('water')
                ? visualColors.mapLayersPaint145
                : id.includes('building')
                    ? visualColors.mapLayersPaint146
                    : /(park|grass|wood|forest|landcover)/.test(id)
                        ? visualColors.mapLayersPaint147
                        : visualColors.mapLayersPaint148;
            if (paint['fill-outline-color'] !== undefined) paint['fill-outline-color'] = visualColors.mapLayersPaint149;
            continue;
        }

        if (layer.type === 'line') {
            paint['line-color'] = id.includes('water')
                ? visualColors.mapLayersPaint150
                : id.includes('boundary')
                    ? visualColors.mapLayersPaint151
                    : /(motorway|trunk)/.test(id)
                        ? visualColors.mapLayersPaint152
                        : /(highway|road|street|transport)/.test(id)
                            ? visualColors.mapLayersPaint153
                            : visualColors.mapLayersPaint154;
            continue;
        }

        if (layer.type === 'symbol') {
            if (paint['text-color'] !== undefined) paint['text-color'] = visualColors.mapLayersPaint155;
            if (paint['text-halo-color'] !== undefined) paint['text-halo-color'] = visualColors.mapLayersPaint144;
            if (paint['text-halo-width'] !== undefined) paint['text-halo-width'] = 1.25;
            continue;
        }

        if (layer.type === 'fill-extrusion') {
            paint['fill-extrusion-color'] = visualColors.mapLayersPaint146;
            continue;
        }

        if (layer.type === 'raster') {
            paint['raster-brightness-max'] = 0.55;
            paint['raster-saturation'] = -0.35;
        }
    }

    return dark;
};
