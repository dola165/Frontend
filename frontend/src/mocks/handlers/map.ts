import { http, HttpHandler, HttpResponse } from 'msw';
import { clubs, events } from '../data/store';
import { simulateLatency } from '../utils';
import { MOCK_TRYOUTS } from './tryouts';

const API = '*/api';

export const mapHandlers: HttpHandler[] = [

  // -- POST /map/location (returns { locationId }) --
  http.post(`${API}/map/location`, async () => {
    await simulateLatency();
    return HttpResponse.json({ locationId: Math.floor(Math.random() * 1000) + 100 });
  }),

  // -- GET /map/nearby (returns MapPageResult with MapMarkerDto items) --
  // Map v2 (Phase 4): 4 active entity types; CLUB_NEED removed. Shape mirrors
  // the real MapMarkerDto (incl. joinPolicy for the "open tryouts only" filter).
  // Club category filtering is real (mock clubs carry a category); gender/age/
  // level params are parsed but ignored — mock clubs have no squad metadata.
  http.get(`${API}/map/nearby`, async ({ request }) => {
    await simulateLatency();
    const url = new URL(request.url);
    const categories = url.searchParams.getAll('category');
    const clubMarkers = [...clubs().values()]
      .filter((c) => categories.length === 0 || categories.includes(c.category))
      .map((c) => ({
        entityId: c.id,
        entityType: 'CLUB' as const,
        title: c.name,
        subtitle: 'ACADEMY',
        clubName: c.name,
        clubId: c.id,
        latitude: c.city === 'Bristol' ? 51.4545 : c.city === 'Manchester' ? 53.4808 : 51.5074,
        longitude: c.city === 'Bristol' ? -2.5879 : c.city === 'Manchester' ? -2.2426 : -0.1278,
        distanceKm: 1.2,
        members: c.memberCount,
        followers: 0,
        verified: true,
        date: '',
        fee: '',
        addressText: c.city,
        ageGroup: '',
        status: 'VERIFIED',
        cityName: c.city,
        countryName: 'United Kingdom',
        eventSubtype: 'CLUB',
        scheduleEventId: null,
        logoUrl: c.logoUrl,
        joinPolicy: c.joinPolicy,
        category: c.category,
      }));

    const eventMarkers = [...events().values()]
      .filter((e) => e.locationLat != null && e.locationLng != null && e.visibility === 'PUBLIC')
      .map((e) => ({
        entityId: e.eventId + 1000,
        entityType: 'MATCH' as const,
        title: e.title,
        subtitle: `${e.eventType} - OPEN`,
        clubName: e.clubName ?? 'Local Club',
        clubId: e.clubId,
        latitude: e.locationLat!,
        longitude: e.locationLng!,
        distanceKm: 0.8,
        members: 0,
        followers: 0,
        verified: false,
        date: e.startsAt,
        fee: 'Free',
        addressText: e.locationName ?? null,
        ageGroup: '',
        status: 'OPEN',
        cityName: null,
        countryName: null,
        eventSubtype: e.eventType,
        scheduleEventId: e.eventId,
        logoUrl: null,
        joinPolicy: null,
      }));

    const tryoutMarkers = MOCK_TRYOUTS.map((t) => {
      const latitude = t.clubId === 1 ? 51.4545 : t.clubId === 2 ? 53.4808 : 51.5074;
      const longitude = t.clubId === 1 ? -2.5879 : t.clubId === 2 ? -2.2426 : -0.1278;
      return {
        entityId: t.id,
        entityType: 'TRYOUT' as const,
        title: t.title,
        subtitle: t.position,
        clubName: t.clubName,
        clubId: t.clubId,
        latitude,
        longitude,
        distanceKm: 2.4,
        members: 0,
        followers: 0,
        verified: false,
        date: t.date,
        fee: 'Free',
        addressText: t.location,
        ageGroup: t.ageGroup,
        status: t.status,
        cityName: null,
        countryName: null,
        eventSubtype: 'TRYOUT',
        scheduleEventId: null,
        logoUrl: null,
        joinPolicy: t.joinPolicy,
      };
    });

    return HttpResponse.json({
      content: [...clubMarkers, ...eventMarkers, ...tryoutMarkers],
      page: 0,
      size: 50,
      totalElements: clubMarkers.length + eventMarkers.length + tryoutMarkers.length,
    });
  }),

  // -- GET /map/geocode (place-name lookup for the fly-to search) --
  http.get(`${API}/map/geocode`, async ({ request }) => {
    await simulateLatency();
    const q = new URL(request.url).searchParams.get('q')?.trim().toLowerCase() ?? '';
    const places = [
      { name: 'Tbilisi', cityName: 'Tbilisi', countryName: 'Georgia', countryCode: 'GE', latitude: 41.7151, longitude: 44.8271, type: 'CITY' as const },
      { name: 'Kutaisi', cityName: 'Kutaisi', countryName: 'Georgia', countryCode: 'GE', latitude: 42.2679, longitude: 42.6946, type: 'CITY' as const },
      { name: 'Georgia', cityName: null, countryName: 'Georgia', countryCode: 'GE', latitude: 42.3154, longitude: 43.3569, type: 'COUNTRY' as const },
      { name: 'Bristol', cityName: 'Bristol', countryName: 'United Kingdom', countryCode: 'GB', latitude: 51.4545, longitude: -2.5879, type: 'CITY' as const },
      { name: 'Manchester', cityName: 'Manchester', countryName: 'United Kingdom', countryCode: 'GB', latitude: 53.4808, longitude: -2.2426, type: 'CITY' as const },
      { name: 'London', cityName: 'London', countryName: 'United Kingdom', countryCode: 'GB', latitude: 51.5074, longitude: -0.1278, type: 'CITY' as const },
    ];
    if (!q) return HttpResponse.json([]);
    return HttpResponse.json(places.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 5));
  }),
];
