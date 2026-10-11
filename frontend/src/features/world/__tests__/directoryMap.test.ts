import { describe, expect, it } from 'vitest';
import type { MapMarkerDto } from '../../../api/map';
import { isMapOpen } from '../directory/mapFold';
import { placePoints } from '../directory/mapPoints';
import { indexPlaces, NO_PLACES } from '../directory/places';
import { cityOf } from '../directory/useCityInView';
import type { Placement } from '../directory/types';

const marker = (entityType: MapMarkerDto['entityType'], entityId: number, over: Partial<MapMarkerDto> = {}) =>
    ({ entityType, entityId, latitude: 41.7, longitude: 44.8, title: `${entityType} ${entityId}`, cityName: 'Tbilisi', ...over }) as MapMarkerDto;
const count = { count: (n: number, noun: [string, string]) => `${n} ${n === 1 ? noun[0] : noun[1]}`, more: (name: string, others: number) => `${name} and ${others} more` };

describe('places', () => {
    it('finds clubs by club id, matches by schedule event id, and the rest by their own id', () => {
        const places = indexPlaces([marker('CLUB', 90, { clubId: 3 }), marker('MATCH', 500, { scheduleEventId: 77 }), marker('TRYOUT', 12), marker('STADIUM', 201)]);
        expect(places.club(3)?.name).toBe('CLUB 90');
        expect(places.club(90)).toBeUndefined();
        expect(places.match(77)?.name).toBe('MATCH 500');
        expect(places.trial(12)?.name).toBe('TRYOUT 12');
        expect(places.venue(201)).toBeDefined();
        expect(places.competition(12)).toBeUndefined();
        expect(NO_PLACES.club(3)).toBeUndefined();
    });
});

describe('pins', () => {
    const at = (over: Partial<Placement> = {}): Placement => ({ lat: 41.7, lng: 44.8, tone: 'club', label: 'Place', ...over });
    it('groups results at one place into one pin with a count, named after the place', () => {
        const jobs = [{ id: 'a', club: 1 }, { id: 'b', club: 1 }, { id: 'c', club: 2 }, { id: 'd', club: 0 }];
        const placed = placePoints(jobs, job => job.id, job => job.club ? at({ pin: `club:${job.club}`, label: `Club ${job.club}`, noun: ['role', 'roles'] }) : null, count);
        expect(placed.points.map(point => `${point.id}:${point.label}:${point.count}:${point.meta}`)).toEqual(['club:1:Club 1:2:2 roles', 'club:2:Club 2:1:1 role']);
        expect(placed.pinOf.get('b')).toBe('club:1');
        expect(placed.keysOf.get('club:1')).toEqual(['a', 'b']);
        expect(placed.keysOf.get('club:2')).toEqual(['c']);
        expect(placed.unplaced).toBe(1);
    });
    it('marks a pin holding several kinds of result as mixed and lists the kinds', () => {
        const placed = placePoints(['match', 'training', 'match2'], id => id, id => at({ tone: id === 'training' ? 'training' : 'match', label: id }), count);
        expect(placed.points).toHaveLength(1);
        expect(placed.points[0]).toMatchObject({ tone: 'mixed', tones: ['match', 'training'], count: 3 });
        const single = placePoints(['a', 'b'], id => id, () => at({ tone: 'match' }), count);
        expect(single.points[0].tone).toBe('match');
        expect(single.points[0].tones).toBeUndefined();
    });
    it('marks a pin approximate only when all its results are', () => {
        const placed = placePoints(['x', 'y'], id => id, id => at({ pin: 'club:1', approximate: id === 'x' ? 'club' : undefined, noun: ['match', 'matches'] }), count);
        expect(placed.points[0].approximate).toBeUndefined();
    });
    it('keeps a lone result as it is, and joins results on one spot into one pin that names them', () => {
        const alone = placePoints(['z'], id => id, () => at({ meta: 'Academy · Tbilisi', to: '/clubs/1' }), count);
        expect(alone.points[0]).toMatchObject({ meta: 'Academy · Tbilisi', to: '/clubs/1' });
        expect(alone.points[0].count).toBeUndefined();
        const shared = placePoints(['a', 'b'], id => id, id => at({ label: id === 'a' ? 'Riverside' : 'Vake', noun: ['club', 'clubs'] }), count);
        expect(shared.points).toHaveLength(1);
        expect(shared.points[0]).toMatchObject({ label: 'Riverside and 1 more', count: 2, meta: '2 clubs', to: undefined });
        expect(shared.pinOf.get('a')).toBe(shared.pinOf.get('b'));
    });
});

describe('the map fold', () => {
    it('follows the address, then an older link, then this browser, then the screen', () => {
        expect(isMapOpen({ param: 'closed', legacyView: 'map', remembered: 'open', phone: false })).toBe(false);
        expect(isMapOpen({ param: null, legacyView: 'split', remembered: 'closed', phone: true })).toBe(true);
        expect(isMapOpen({ param: null, legacyView: 'list', remembered: 'open', phone: false })).toBe(false);
        expect(isMapOpen({ param: null, legacyView: null, remembered: 'closed', phone: false })).toBe(false);
        expect(isMapOpen({ param: null, legacyView: null, remembered: null, phone: false })).toBe(true);
        expect(isMapOpen({ param: null, legacyView: null, remembered: null, phone: true })).toBe(false);
    });
});

describe('the city in view', () => {
    it('is the city most places in view belong to', () => {
        expect(cityOf(['Rustavi', 'Tbilisi', 'Rustavi', null, ''])).toBe('Rustavi');
        expect(cityOf([null, undefined])).toBeNull();
    });
});
