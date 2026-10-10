// A small, offline MapLibre style for the sandbox. Real map tiles come from hosts the
// sandbox cannot reach, so markers and routes would sit on a blank canvas. This draws a
// stylised Georgia (sea, rivers, lakes, towns, parks, main roads and a street texture) from
// inline GeoJSON. Layer ids follow the real basemap's naming (water, park, road, boundary…)
// so the app's own light and dark recolouring applies to it. Sandbox only.

const feature = (geometry, properties = {}) => ({ type: 'Feature', properties, geometry });
const polygon = ring => ({ type: 'Polygon', coordinates: [[...ring, ring[0]]] });
const line = coordinates => ({ type: 'LineString', coordinates });
const collection = features => ({ type: 'FeatureCollection', features });
// [lat, lng] pairs read naturally next to the city data; GeoJSON wants [lng, lat].
const ll = points => points.map(([lat, lng]) => [lng, lat]);

/** A soft blob around a centre: towns, lakes and parks. */
function blob(lat, lng, rx, ry, seed = 1, steps = 28) {
  const ring = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const wobble = 1 + 0.12 * Math.sin(a * 3 + seed) + 0.07 * Math.cos(a * 5 + seed * 2);
    ring.push([lng + Math.cos(a) * rx * wobble, lat + Math.sin(a) * ry * wobble]);
  }
  return polygon(ring);
}

const sea = polygon(ll([[44.0, 36.0], [44.0, 40.4], [43.42, 40.0], [43.1, 40.6], [42.85, 41.05], [42.6, 41.35], [42.3, 41.55], [42.15, 41.64], [41.95, 41.74], [41.75, 41.73], [41.62, 41.6], [41.55, 41.55], [41.45, 41.5], [41.0, 41.2], [40.5, 41.0], [40.5, 36.0]]));
const border = line(ll([[43.42, 40.0], [43.55, 40.6], [43.3, 41.5], [43.2, 42.4], [42.95, 43.3], [42.75, 44.0], [42.6, 44.9], [42.55, 45.5], [42.2, 45.9], [41.9, 46.4], [41.55, 46.6], [41.2, 46.2], [41.25, 45.4], [41.13, 44.8], [41.2, 43.9], [41.3, 43.3], [41.5, 42.8], [41.55, 42.3], [41.5, 41.55]]));

const rivers = [
  // Mtkvari: from Borjomi through Gori, Mtskheta, Tbilisi and Rustavi.
  ll([[41.84, 43.38], [41.92, 43.6], [41.98, 43.85], [41.98, 44.11], [41.92, 44.35], [41.86, 44.6], [41.845, 44.715], [41.82, 44.745], [41.795, 44.77], [41.77, 44.78], [41.75, 44.79], [41.732, 44.8], [41.718, 44.803], [41.705, 44.807], [41.693, 44.815], [41.68, 44.83], [41.665, 44.85], [41.64, 44.88], [41.61, 44.92], [41.575, 44.97], [41.55, 45.0], [41.5, 45.1], [41.45, 45.3]]),
  // Aragvi into Mtskheta; Rioni to the sea; Alazani in Kakheti.
  ll([[42.15, 44.77], [42.05, 44.74], [41.95, 44.72], [41.85, 44.72]]),
  ll([[42.45, 42.95], [42.3, 42.72], [42.27, 42.7], [42.2, 42.45], [42.17, 42.1], [42.15, 41.67]]),
  ll([[42.2, 45.2], [42.05, 45.45], [41.95, 45.55], [41.8, 45.75], [41.6, 46.1]]),
];
const lakes = [
  blob(41.778, 44.84, 0.012, 0.016, 2),   // Tbilisi Sea
  blob(41.745, 44.739, 0.006, 0.0035, 3), // Lisi Lake
  blob(41.698, 44.752, 0.003, 0.002, 4),  // Turtle Lake
  blob(42.14, 44.77, 0.03, 0.045, 5),     // Zhinvali reservoir
];
const towns = [
  [41.735, 44.8, 0.085, 0.06], [41.55, 45.0, 0.03, 0.02], [42.27, 42.7, 0.035, 0.025], [41.63, 41.62, 0.04, 0.03],
  [41.92, 45.475, 0.018, 0.013], [41.843, 44.715, 0.012, 0.008], [42.51, 41.87, 0.025, 0.02], [41.98, 44.11, 0.02, 0.014],
].map(([lat, lng, rx, ry], i) => blob(lat, lng, rx, ry, i + 1));
const parks = [
  [41.709, 44.746, 0.008, 0.005], [41.69, 44.79, 0.012, 0.007], [41.758, 44.73, 0.014, 0.009], [41.725, 44.77, 0.006, 0.004],
  [41.8, 44.9, 0.03, 0.02], [41.68, 44.72, 0.025, 0.015], [41.9, 45.55, 0.05, 0.03], [42.25, 42.66, 0.015, 0.01],
].map(([lat, lng, rx, ry], i) => blob(lat, lng, rx, ry, i + 7));
const forests = [[42.05, 45.2, 0.25, 0.12], [41.75, 43.35, 0.3, 0.12], [42.45, 43.4, 0.35, 0.18], [41.85, 44.3, 0.15, 0.08]]
  .map(([lat, lng, rx, ry], i) => blob(lat, lng, rx, ry, i + 3, 36));

const motorways = [
  ll([[41.7, 44.84], [41.76, 44.77], [41.845, 44.72], [41.93, 44.45], [41.98, 44.11], [41.99, 43.6], [42.1, 43.05], [42.27, 42.7], [42.18, 42.35], [42.0, 41.95], [41.8, 41.78], [41.63, 41.63]]),
  ll([[41.7, 44.84], [41.66, 44.9], [41.6, 44.96], [41.55, 45.0]]),
  ll([[41.71, 44.86], [41.73, 45.05], [41.73, 45.33], [41.78, 45.45], [41.92, 45.475]]),
  ll([[42.27, 42.7], [42.4, 42.2], [42.51, 41.87]]),
];
const primaries = [
  ll([[41.693, 44.801], [41.701, 44.792], [41.71, 44.776], [41.712, 44.76], [41.709, 44.745]]),
  ll([[41.7, 44.8], [41.718, 44.785], [41.728, 44.77], [41.738, 44.752], [41.748, 44.735]]),
  ll([[41.71, 44.8], [41.73, 44.79], [41.75, 44.785], [41.765, 44.775], [41.785, 44.77], [41.8, 44.81], [41.81, 44.83]]),
  ll([[41.695, 44.81], [41.69, 44.83], [41.688, 44.85], [41.68, 44.87]]),
  ll([[41.715, 44.81], [41.73, 44.83], [41.75, 44.85], [41.77, 44.86]]),
  ll([[41.74, 44.78], [41.75, 44.77], [41.763, 44.771]]),
];

// A deterministic street texture inside Tbilisi so close zooms read as a city.
function streets() {
  const out = [];
  let s = 7;
  const rand = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  for (let i = 0; i < 70; i++) {
    const lat = 41.68 + rand() * 0.11, lng = 44.72 + rand() * 0.15;
    const angle = (rand() < 0.5 ? 0.35 : 1.95) + (rand() - 0.5) * 0.3, length = 0.006 + rand() * 0.016;
    out.push([[lng, lat], [lng + Math.cos(angle) * length, lat + Math.sin(angle) * length * 0.75]]);
  }
  return out;
}

export function sandboxMapStyle(origin) {
  const width = (base, top) => ['interpolate', ['exponential', 1.6], ['zoom'], 6, base, 16, top];
  return {
    version: 8,
    name: 'GrassKickZ sandbox',
    glyphs: `${origin}/sandbox-map/glyphs/{fontstack}/{range}.pbf`,
    sources: {
      sea: { type: 'geojson', data: collection([feature(sea)]) },
      lakes: { type: 'geojson', data: collection(lakes.map(g => feature(g))) },
      rivers: { type: 'geojson', data: collection(rivers.map(c => feature(line(c)))) },
      towns: { type: 'geojson', data: collection(towns.map(g => feature(g))) },
      parks: { type: 'geojson', data: collection(parks.map(g => feature(g))) },
      forests: { type: 'geojson', data: collection(forests.map(g => feature(g))) },
      motorways: { type: 'geojson', data: collection(motorways.map(c => feature(line(c)))) },
      primaries: { type: 'geojson', data: collection(primaries.map(c => feature(line(c)))) },
      streets: { type: 'geojson', data: collection(streets().map(c => feature(line(c)))) },
      border: { type: 'geojson', data: collection([feature(border)]) },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#ece6dc' } },
      { id: 'landcover-wood', type: 'fill', source: 'forests', paint: { 'fill-color': '#d4dcc8', 'fill-opacity': 0.8 } },
      { id: 'landuse-residential', type: 'fill', source: 'towns', paint: { 'fill-color': '#e2dbd0' } },
      { id: 'park', type: 'fill', source: 'parks', paint: { 'fill-color': '#cddabd' } },
      { id: 'water', type: 'fill', source: 'sea', paint: { 'fill-color': '#a8c3cc' } },
      { id: 'water-lakes', type: 'fill', source: 'lakes', paint: { 'fill-color': '#a8c3cc' } },
      { id: 'waterway', type: 'line', source: 'rivers', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#a8c3cc', 'line-width': width(1, 14) } },
      { id: 'road-minor', type: 'line', source: 'streets', minzoom: 11, layout: { 'line-cap': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': width(0.5, 6), 'line-opacity': 0.85 } },
      { id: 'road-primary', type: 'line', source: 'primaries', minzoom: 9, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': width(0.8, 9) } },
      { id: 'road-motorway', type: 'line', source: 'motorways', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#f3d9a6', 'line-width': width(1, 12) } },
      { id: 'boundary-country', type: 'line', source: 'border', paint: { 'line-color': '#b5a99a', 'line-width': 1.2, 'line-dasharray': [3, 2] } },
    ],
  };
}
