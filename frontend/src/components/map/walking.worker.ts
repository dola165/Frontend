import { findWalkingRoute, type Coordinate, type OsmElement } from './walkingGraph';
self.onmessage = (event: MessageEvent<{ elements: OsmElement[]; origin: Coordinate; destination: Coordinate }>) => {
    try { self.postMessage({ route: findWalkingRoute(event.data.elements, event.data.origin, event.data.destination) }); }
    catch (error) { self.postMessage({ error: error instanceof Error ? error.message : 'Walking route unavailable.' }); }
};
