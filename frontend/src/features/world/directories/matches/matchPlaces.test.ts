import { describe, expect, it } from 'vitest';
import type { Match } from '../../../matchExchange/api';
import type { HistoryMatch } from '../../../matchHistory/api';
import type { Places } from '../../directory/places';
import { fixturePlace, listingPlace } from './matchPlaces';

const clubPin = { lat: 41.7151, lng: 44.8271, name: 'Club', city: 'Tbilisi', clubId: 1, logoUrl: null };
const places = { club: () => clubPin, venue: () => undefined, trial: () => undefined, competition: () => undefined, match: () => clubPin } as unknown as Places;
const listing = { event_id: 5, club_id: 1, title: 'U12 friendly', timezone: 'Asia/Tbilisi', starts_at_iso: '2026-11-14T08:00:00Z', location_name: 'Tbilisi', location_lat: null, location_lng: null } as unknown as Match;

describe('a children’s match for someone outside it', () => {
    it('counts at its city, never at its club, with its day alone', () => {
        const pin = listingPlace({ ...listing, place_hidden: true, area_lat: 41.7, area_lng: 44.8 }, places)!;
        expect(pin).toMatchObject({ lat: 41.7, lng: 44.8, approximate: 'area' });
        expect(pin.meta).not.toMatch(/\d\d:\d\d/);
    });

    it('has no pin at all without its city’s point', () => {
        expect(listingPlace({ ...listing, place_hidden: true }, places)).toBeNull();
    });

    it('an adult match with no ground of its own still counts at its club', () => {
        expect(listingPlace(listing, places)).toMatchObject({ lat: clubPin.lat, approximate: 'club' });
        expect(listingPlace(listing, places)!.meta).toMatch(/\d\d:\d\d/);
    });

    it('a fixture says its day and marks its pin as the city', () => {
        const fixture = { source: 'MATCH_EXCHANGE', sourceId: 5, homeClubId: 1, awayClubId: 2, homeClubName: 'A', awayClubName: 'B', startsAt: '2026-11-14T12:00:00', timezone: null, timeHidden: true, detailPath: '/matches/5' } as unknown as HistoryMatch;
        const pin = fixturePlace(fixture, places)!;
        expect(pin.approximate).toBe('area');
        expect(pin.meta).not.toMatch(/\d\d:\d\d/);
    });
});
