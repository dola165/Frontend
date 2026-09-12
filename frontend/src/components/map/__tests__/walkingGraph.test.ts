import { describe, expect, it } from 'vitest';
import { findWalkingRoute, isWalkable, type OsmElement } from '../walkingGraph';
import { containsPoint, searchRank } from '../areaSearch';
const nodes: OsmElement[] = [
    { type: 'node', id: 1, lon: 44.8, lat: 41.7 },
    { type: 'node', id: 2, lon: 44.801, lat: 41.7 },
    { type: 'node', id: 3, lon: 44.802, lat: 41.7 },
    { type: 'node', id: 4, lon: 44.801, lat: 41.71 }
];
const way = (id: number, ns: number[], tags = {}): OsmElement => ({ type: 'way', id, nodes: ns, tags: { highway: 'footway', name: 'Park path', ...tags } });
describe('walking path search', () => {
    it('chooses the shortest connected route and records explored branches', () => {
        const route = findWalkingRoute([...nodes, way(10, [1, 4, 3]), way(11, [1, 2, 3])], [44.8, 41.7], [44.802, 41.7]);
        expect(route.coordinates).toEqual([[44.8, 41.7], [44.801, 41.7], [44.802, 41.7]]);
        expect(route.distanceKm).toBeGreaterThan(.16); expect(route.distanceKm).toBeLessThan(.18);
        expect(route.steps).toHaveLength(1); expect(route.branches.length).toBeGreaterThan(0);
    });
    it('takes a real detour instead of routing across private property', () => {
        const route = findWalkingRoute([...nodes, way(10, [1, 2, 3], { access: 'private' }), way(11, [1, 4, 3])], [44.8, 41.7], [44.802, 41.7]);
        expect(route.coordinates).toContainEqual([44.801, 41.71]); expect(route.distanceKm).toBeGreaterThan(2);
    });
    it('respects foot-specific one-way restrictions but ignores vehicle one-way restrictions', () => {
        const elements = [...nodes, way(10, [1, 2, 3], { 'oneway:foot': 'yes' })];
        expect(() => findWalkingRoute(elements, [44.802, 41.7], [44.8, 41.7])).toThrow('No connected');
        expect(findWalkingRoute([...nodes, way(10, [1, 2, 3], { oneway: 'yes' })], [44.802, 41.7], [44.8, 41.7]).coordinates).toHaveLength(3);
    });
    it('does not connect crossing roads unless they share an OSM node', () => {
        const elements = [...nodes, { type: 'node', id: 5, lon: 44.804, lat: 41.7 } as OsmElement, way(10, [1, 2]), way(11, [3, 5])];
        expect(() => findWalkingRoute(elements, [44.8, 41.7], [44.804, 41.7])).toThrow('No connected');
    });
    it('excludes barriers, restricted ways and unverified conditional access', () => {
        expect(isWalkable({ highway: 'motorway' })).toBe(false);
        expect(isWalkable({ highway: 'residential', foot: 'no' })).toBe(false);
        expect(isWalkable({ highway: 'footway', access: 'private', foot: 'yes' })).toBe(true);
        expect(isWalkable({ highway: 'path', 'foot:conditional': 'yes @ (sunrise-sunset)' })).toBe(false);
        const barred = nodes.map(n => n.id === 2 ? { ...n, tags: { barrier: 'wall' } } : n);
        expect(() => findWalkingRoute([...barred, way(10, [1, 2, 3])], [44.8, 41.7], [44.802, 41.7])).toThrow();
    });
    it('rejects a start too far from a mapped path instead of drawing a false connector', () => {
        expect(() => findWalkingRoute([...nodes, way(10, [1, 2, 3])], [44.75, 41.7], [44.802, 41.7])).toThrow('No mapped walking path');
    });
});
describe('neighborhood discovery', () => {
    it('includes both sides of the antimeridian without including the rest of the world', () => {
        const bounds = { west: 170, south: -20, east: -170, north: 20 };
        expect(containsPoint(bounds, 0, 179)).toBe(true); expect(containsPoint(bounds, 0, -179)).toBe(true);
        expect(containsPoint(bounds, 0, 0)).toBe(false); expect(containsPoint(bounds, 30, 179)).toBe(false);
    });
    it('ranks accent-insensitive exact names above prefixes and scattered tokens', () => {
        expect(searchRank('München Academy', 'Munchen Academy')).toBe(100);
        expect(searchRank('München Academy', 'Munchen')).toBe(80);
        expect(searchRank('FC Bayern München Academy', 'Munchen FC')).toBe(50);
    });
});
