import { distanceKm, type Coordinate, type OsmElement, type WalkingRoute } from './walkingGraph';
const networkCache = new Map<string, { expires: number; elements: OsmElement[] }>();
/** A bounded, on-demand OSM request; no location request is made until the user chooses walking directions. */
export async function loadWalkingRoute(origin: Coordinate, destination: Coordinate, signal: AbortSignal): Promise<WalkingRoute> {
    if (distanceKm(origin, destination) > 8) throw new Error('Walking discovery covers trips up to 8 km apart. Choose a closer start or open directions.');
    const padding = .008;
    const bounds = [Math.min(origin[1], destination[1]) - padding, Math.min(origin[0], destination[0]) - padding,
        Math.max(origin[1], destination[1]) + padding, Math.max(origin[0], destination[0]) + padding];
    const key = bounds.map(n => n.toFixed(4)).join(',');
    let elements = networkCache.get(key)?.expires && networkCache.get(key)!.expires > Date.now() ? networkCache.get(key)!.elements : null;
    if (!elements) {
        const query = `[out:json][timeout:20][maxsize:33554432];way[highway][highway!~"^(motorway|motorway_link|trunk|trunk_link|construction|proposed|raceway)$"](${key});(._;>;);out body;`;
        const response = await fetch(import.meta.env.VITE_OVERPASS_URL || 'https://overpass-api.de/api/interpreter', {
            method: 'POST', body: new URLSearchParams({ data: query }), signal: AbortSignal.any([signal, AbortSignal.timeout(25000)])
        });
        if (!response.ok) throw new Error('The walking network is busy. Please try again shortly.');
        const data = await response.json() as { elements?: OsmElement[]; remark?: string };
        if (data.remark || !data.elements?.length) throw new Error('Walking network unavailable here. Try another start or open directions.');
        if (data.elements.length > 150000) throw new Error('This area is too large for walking discovery. Pick a closer start.');
        elements = data.elements;
        if (networkCache.size >= 4) networkCache.delete(networkCache.keys().next().value!);
        networkCache.set(key, { elements, expires: Date.now() + 900000 });
    }
    signal.throwIfAborted();
    return new Promise((resolve, reject) => {
        const worker = new Worker(new URL('./walking.worker.ts', import.meta.url), { type: 'module' });
        const cleanup = () => { worker.terminate(); signal.removeEventListener('abort', abort); };
        const abort = () => { cleanup(); reject(new DOMException('Aborted', 'AbortError')); };
        signal.addEventListener('abort', abort, { once: true });
        worker.onmessage = (event: MessageEvent<{ route?: WalkingRoute; error?: string }>) => {
            cleanup(); if (event.data.route) resolve(event.data.route); else reject(new Error(event.data.error));
        };
        worker.onerror = () => { cleanup(); reject(new Error('Walking route could not be calculated.')); };
        worker.postMessage({ elements, origin, destination });
    });
}
