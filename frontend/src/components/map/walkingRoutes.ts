import { distanceKm, type Coordinate, type OsmElement, type WalkingRoute } from './walkingGraph';
import WalkingWorker from './walking.worker?worker&inline';
const networkCache = new Map<string, { expires: number; elements: OsmElement[] }>();
const aborted = () => new DOMException('Aborted', 'AbortError');
const checkAborted = (signal: AbortSignal) => { if (signal.aborted) throw aborted(); };

async function fetchNetwork(query: string, signal: AbortSignal) {
    checkAborted(signal);
    const request = new AbortController();
    let timedOut = false;
    const cancel = () => request.abort();
    signal.addEventListener('abort', cancel, { once: true });
    const timer = setTimeout(() => { timedOut = true; request.abort(); }, 25000);
    try {
        const response = await fetch(import.meta.env.VITE_OVERPASS_URL || 'https://overpass-api.de/api/interpreter', {
            method: 'POST', body: new URLSearchParams({ data: query }), signal: request.signal
        });
        if (!response.ok) throw new Error('The walking network is busy. Please try again shortly.');
        return await response.json() as { elements?: OsmElement[]; remark?: string };
    } catch (error) {
        checkAborted(signal);
        if (timedOut) throw new Error('The walking network took too long to respond. Please try again.');
        if (error instanceof TypeError) throw new Error('Could not reach the walking network. Check your connection and try again.');
        throw error;
    } finally {
        clearTimeout(timer);
        signal.removeEventListener('abort', cancel);
    }
}
/** A bounded, on-demand OSM request; no location request is made until the user chooses walking directions. */
export async function loadWalkingRoute(origin: Coordinate, destination: Coordinate, signal: AbortSignal): Promise<WalkingRoute> {
    checkAborted(signal);
    if (distanceKm(origin, destination) > 8) throw new Error('Walking discovery covers trips up to 8 km apart. Choose a closer start or open directions.');
    const padding = .008;
    const bounds = [Math.min(origin[1], destination[1]) - padding, Math.min(origin[0], destination[0]) - padding,
        Math.max(origin[1], destination[1]) + padding, Math.max(origin[0], destination[0]) + padding];
    const key = bounds.map(n => n.toFixed(4)).join(',');
    let elements = networkCache.get(key)?.expires && networkCache.get(key)!.expires > Date.now() ? networkCache.get(key)!.elements : null;
    if (!elements) {
        const query = `[out:json][timeout:20][maxsize:33554432];way[highway][highway!~"^(motorway|motorway_link|trunk|trunk_link|construction|proposed|raceway)$"](${key});(._;>;);out body;`;
        // Use AbortController rather than newer AbortSignal static helpers: the
        // installed Android System WebView can be older than the phone's OS.
        const data = await fetchNetwork(query, signal);
        if (data.remark || !data.elements?.length) throw new Error('Walking network unavailable here. Try another start or open directions.');
        if (data.elements.length > 150000) throw new Error('This area is too large for walking discovery. Pick a closer start.');
        elements = data.elements;
        if (networkCache.size >= 4) networkCache.delete(networkCache.keys().next().value!);
        networkCache.set(key, { elements, expires: Date.now() + 900000 });
    }
    checkAborted(signal);
    return new Promise((resolve, reject) => {
        // Bundle as a blob worker, like the map renderer, so it does not depend
        // on a worker-origin request being intercepted by WebViewAssetLoader.
        const worker = new WalkingWorker();
        const cleanup = () => { clearTimeout(timer); worker.terminate(); signal.removeEventListener('abort', abort); };
        const abort = () => { cleanup(); reject(aborted()); };
        const timer = setTimeout(() => { cleanup(); reject(new Error('Walking route calculation timed out. Choose a closer start and try again.')); }, 15000);
        signal.addEventListener('abort', abort, { once: true });
        worker.onmessage = (event: MessageEvent<{ route?: WalkingRoute; error?: string }>) => {
            cleanup(); if (event.data.route) resolve(event.data.route); else reject(new Error(event.data.error || 'Walking route could not be calculated.'));
        };
        worker.onerror = () => { cleanup(); reject(new Error('Walking route could not be calculated.')); };
        try { worker.postMessage({ elements, origin, destination }); }
        catch { cleanup(); reject(new Error('Walking route could not be started. Please try again.')); }
    });
}
