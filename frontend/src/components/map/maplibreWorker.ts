// MapLibre 6 runs its tile worker from a separate file that bundlers must ship themselves.
// Every map passes this address as react-map-gl's `workerUrl`, which sets it before the map is created.
export { default as maplibreWorkerUrl } from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
