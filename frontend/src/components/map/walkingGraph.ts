/** Local A* routing over OSM ways. Coordinates are always [longitude, latitude]. */
export type Coordinate = [number, number];
export interface OsmElement {
    type: 'node' | 'way'; id: number; lat?: number; lon?: number;
    nodes?: number[]; tags?: Record<string, string>;
}
export interface WalkingRoute {
    coordinates: Coordinate[];
    branches: Coordinate[][];
    distanceKm: number;
    minutes: number;
    startOffsetM: number;
    endOffsetM: number;
    steps: { name: string; distanceM: number }[];
}
type Edge = { to: number; distance: number; name: string };
export const distanceKm = (a: Coordinate, b: Coordinate) => {
    const rad = Math.PI / 180;
    const s = Math.sin((b[1] - a[1]) * rad / 2) ** 2
        + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin((b[0] - a[0]) * rad / 2) ** 2;
    return 12742 * Math.asin(Math.min(1, Math.sqrt(s)));
};
const forbidden = new Set(['no', 'private', 'customers', 'delivery', 'agricultural', 'forestry']);
const allowedFoot = new Set(['yes', 'designated', 'permissive', 'destination']);
export const isWalkable = (tags: Record<string, string> = {}) => {
    if (!tags.highway || forbidden.has(tags.foot) || tags.area === 'yes' || tags.construction || tags['foot:conditional'] || tags['access:conditional']) return false;
    if (/^(construction|proposed|raceway|motorway|motorway_link|trunk|trunk_link)$/.test(tags.highway)) return false;
    if (tags.motorroad === 'yes' && !allowedFoot.has(tags.foot)) return false;
    return !forbidden.has(tags.access) || allowedFoot.has(tags.foot);
};
class MinHeap {
    private items: { id: number; priority: number }[] = [];
    push(item: { id: number; priority: number }) {
        let i = this.items.push(item) - 1;
        while (i > 0) {
            const parent = (i - 1) >> 1;
            if (this.items[parent].priority <= item.priority) break;
            this.items[i] = this.items[parent]; i = parent;
        }
        this.items[i] = item;
    }
    pop() {
        const first = this.items[0]; const last = this.items.pop();
        if (this.items.length && last) {
            let i = 0;
            while (i * 2 + 1 < this.items.length) {
                let child = i * 2 + 1;
                if (child + 1 < this.items.length && this.items[child + 1].priority < this.items[child].priority) child++;
                if (last.priority <= this.items[child].priority) break;
                this.items[i] = this.items[child]; i = child;
            }
            this.items[i] = last;
        }
        return first;
    }
}

export function findWalkingRoute(elements: OsmElement[], origin: Coordinate, destination: Coordinate): WalkingRoute {
    const nodes = new Map<number, Coordinate>();
    const blocked = new Set<number>();
    const edges = new Map<number, Edge[]>();
    for (const element of elements) {
        if (element.type !== 'node' || !Number.isFinite(element.lat) || !Number.isFinite(element.lon)) continue;
        nodes.set(element.id, [element.lon!, element.lat!]);
        const tags = element.tags ?? {};
        if (forbidden.has(tags.foot) || (forbidden.has(tags.access) && !allowedFoot.has(tags.foot))
            || (['wall', 'fence', 'retaining_wall'].includes(tags.barrier) && !allowedFoot.has(tags.foot))) blocked.add(element.id);
    }
    const add = (from: number, to: number, name: string) => {
        if (!nodes.has(from) || !nodes.has(to) || blocked.has(from) || blocked.has(to)) return;
        const list = edges.get(from) ?? [];
        list.push({ to, distance: distanceKm(nodes.get(from)!, nodes.get(to)!), name }); edges.set(from, list);
    };
    for (const way of elements) {
        if (way.type !== 'way' || !way.nodes || !isWalkable(way.tags)) continue;
        const name = way.tags?.name || (way.tags?.highway === 'steps' ? 'Steps' : 'Unnamed path');
        for (let i = 1; i < way.nodes.length; i++) {
            if (way.tags?.['oneway:foot'] !== '-1') add(way.nodes[i - 1], way.nodes[i], name);
            if (way.tags?.['oneway:foot'] !== 'yes') add(way.nodes[i], way.nodes[i - 1], name);
        }
    }
    const connected = new Set([...edges.keys(), ...[...edges.values()].flatMap(list => list.map(edge => edge.to))]);
    const nearest = (point: Coordinate) => [...connected].reduce<{ id: number; offset: number } | null>((best, id) => {
        const offset = distanceKm(point, nodes.get(id)!);
        return !best || offset < best.offset ? { id, offset } : best;
    }, null);
    const start = nearest(origin); const end = nearest(destination);
    if (!start || !end || start.offset > .25 || end.offset > .25) throw new Error('No mapped walking path close to this pin. Choose a start on a nearby street.');
    if (start.id === end.id) throw new Error('These pins meet the same path point. Choose a start farther away.');
    const costs = new Map<number, number>([[start.id, 0]]);
    const parents = new Map<number, { from: number; edge: Edge }>();
    const closed = new Set<number>();
    const frontier = new MinHeap(); frontier.push({ id: start.id, priority: 0 });
    const branches: Coordinate[][] = [];
    let current;
    while ((current = frontier.pop())) {
        if (closed.has(current.id)) continue;
        if (current.id === end.id) break;
        closed.add(current.id);
        if (closed.size > 100000) throw new Error('This walking network is too large. Choose a closer start.');
        for (const edge of edges.get(current.id) ?? []) {
            const next = costs.get(current.id)! + edge.distance;
            if (next >= (costs.get(edge.to) ?? Infinity)) continue;
            costs.set(edge.to, next); parents.set(edge.to, { from: current.id, edge });
            frontier.push({ id: edge.to, priority: next + distanceKm(nodes.get(edge.to)!, nodes.get(end.id)!) });
            if (branches.length < 1500) branches.push([nodes.get(current.id)!, nodes.get(edge.to)!]);
        }
    }
    if (!costs.has(end.id)) throw new Error('No connected walking route found in this area. Try a different start or open directions.');
    const coordinates: Coordinate[] = [nodes.get(end.id)!];
    const path: Edge[] = [];
    let cursor = end.id;
    while (cursor !== start.id) {
        const parent = parents.get(cursor)!;
        path.unshift(parent.edge); coordinates.unshift(nodes.get(parent.from)!); cursor = parent.from;
    }
    const steps: WalkingRoute['steps'] = [];
    for (const edge of path) {
        if (steps.at(-1)?.name === edge.name) steps.at(-1)!.distanceM += edge.distance * 1000;
        else steps.push({ name: edge.name, distanceM: edge.distance * 1000 });
    }
    const distance = costs.get(end.id)!;
    return { coordinates, branches, distanceKm: distance, minutes: Math.max(1, Math.ceil(distance / 4.8 * 60)),
        startOffsetM: Math.round(start.offset * 1000), endOffsetM: Math.round(end.offset * 1000), steps };
}
