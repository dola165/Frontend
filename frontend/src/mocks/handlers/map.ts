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
    const requestedTypes = url.searchParams.getAll('type');
    const positions = url.searchParams.getAll('positions').map((position) => position.toUpperCase());
    const demoCoordinates = [
      { latitude: 41.7151, longitude: 44.8271 },
      { latitude: 41.7412, longitude: 44.7689 },
      { latitude: 41.6936, longitude: 44.8015 },
      { latitude: 41.7284, longitude: 44.8456 },
    ];
    const clubNeeds: Record<number, string[]> = {
      1: ['FORWARD', 'STRIKER', 'WINGER'],
      2: ['GOALKEEPER', 'CENTRAL_MIDFIELDER', 'ATTACKING_MIDFIELDER'],
      3: ['CENTER_BACK', 'FULLBACK', 'DEFENSIVE_MIDFIELDER'],
      4: ['FORWARD', 'GOALKEEPER', 'FULLBACK'],
    };
    const clubMarkers = [...clubs().values()]
      .filter((c) => categories.length === 0 || categories.includes(c.category))
      .filter((c) => positions.length === 0 || positions.some((position) => clubNeeds[c.id]?.includes(position)))
      .map((c, index) => ({
        entityId: c.id,
        entityType: 'CLUB' as const,
        title: c.name,
        subtitle: c.category.replaceAll('_', ' '),
        clubName: c.name,
        clubId: c.id,
        latitude: demoCoordinates[index % demoCoordinates.length].latitude,
        longitude: demoCoordinates[index % demoCoordinates.length].longitude,
        distanceKm: 1.2 + index * 2.1,
        members: c.memberCount,
        followers: 0,
        verified: true,
        date: '',
        fee: '',
        addressText: `Training centre, Tbilisi`,
        ageGroup: '',
        status: 'VERIFIED',
        cityName: 'Tbilisi',
        countryName: 'Georgia',
        eventSubtype: 'CLUB',
        scheduleEventId: null,
        logoUrl: c.logoUrl,
        joinPolicy: c.joinPolicy,
        category: c.category,
      }));

    const eventMarkers = [...events().values()]
      .filter((e) => e.locationLat != null && e.locationLng != null && e.visibility === 'PUBLIC')
      .map((e, index) => ({
        entityId: e.eventId + 1000,
        entityType: 'MATCH' as const,
        title: e.title,
        subtitle: `${e.eventType} - OPEN`,
        clubName: e.clubName ?? 'Local Club',
        clubId: e.clubId,
        latitude: 41.705 + index * 0.018,
        longitude: 44.79 + index * 0.025,
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

    const tryoutMarkers = MOCK_TRYOUTS
      .filter((t) => {
        if (positions.length === 0) return true;
        const normalized = t.position.toUpperCase();
        return positions.some((position) => normalized.includes(position.replaceAll('_', ' '))
          || (position === 'FORWARD' && normalized.includes('FORWARD'))
          || (position === 'GOALKEEPER' && normalized.includes('GOALKEEPER')));
      })
      .map((t, index) => {
      const coordinates = demoCoordinates[(t.clubId - 1) % demoCoordinates.length];
      const latitude = coordinates.latitude + 0.008 + index * 0.003;
      const longitude = coordinates.longitude + 0.006 + index * 0.003;
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
        cityName: 'Tbilisi',
        countryName: 'Georgia',
        eventSubtype: 'TRYOUT',
        scheduleEventId: null,
        logoUrl: null,
        joinPolicy: t.joinPolicy,
      };
    });

    const tournamentMarkers = [{
      entityId: 9001,
      entityType: 'TOURNAMENT' as const,
      title: 'Tbilisi Youth Cup',
      subtitle: 'Regional tournament',
      clubName: 'Tbilisi Football Community',
      clubId: 1,
      latitude: 41.7268,
      longitude: 44.8052,
      distanceKm: 2.8,
      members: 0,
      followers: 0,
      verified: true,
      date: '2026-09-12T09:00:00',
      fee: 'Free',
      addressText: 'Tbilisi Sports Complex',
      ageGroup: 'U16',
      status: 'OPEN',
      cityName: 'Tbilisi',
      countryName: 'Georgia',
      eventSubtype: 'TOURNAMENT',
      scheduleEventId: null,
      logoUrl: null,
      joinPolicy: null,
    }];

    const allMarkers = [...clubMarkers, ...eventMarkers, ...tryoutMarkers, ...tournamentMarkers];
    const visibleMarkers = requestedTypes.length === 0
      ? allMarkers
      : allMarkers.filter((marker) => requestedTypes.includes(marker.entityType));

    return HttpResponse.json({
      content: visibleMarkers,
      page: 0,
      size: 50,
      totalElements: visibleMarkers.length,
    });
  }),

  // -- GET /map/geocode (place-name lookup for the fly-to search) --
  http.get(`${API}/map/geocode`, async ({ request }) => {
    await simulateLatency();
    const url = new URL(request.url);
    const q = url.searchParams.get('q')?.trim().toLowerCase() ?? '';
    const countryCode = url.searchParams.get('countryCode')?.trim().toUpperCase() ?? '';
    const requestedType = url.searchParams.get('type')?.trim().toUpperCase() ?? '';
    const places = [
      { name: 'Tbilisi', cityName: 'Tbilisi', countryName: 'Georgia', countryCode: 'GE', latitude: 41.7151, longitude: 44.8271, type: 'CITY' as const },
      { name: 'Kutaisi', cityName: 'Kutaisi', countryName: 'Georgia', countryCode: 'GE', latitude: 42.2679, longitude: 42.6946, type: 'CITY' as const },
      { name: 'Georgia', cityName: null, countryName: 'Georgia', countryCode: 'GE', latitude: 42.3154, longitude: 43.3569, type: 'COUNTRY' as const },
      { name: 'Bristol', cityName: 'Bristol', countryName: 'United Kingdom', countryCode: 'GB', latitude: 51.4545, longitude: -2.5879, type: 'CITY' as const },
      { name: 'Manchester', cityName: 'Manchester', countryName: 'United Kingdom', countryCode: 'GB', latitude: 53.4808, longitude: -2.2426, type: 'CITY' as const },
      { name: 'London', cityName: 'London', countryName: 'United Kingdom', countryCode: 'GB', latitude: 51.5074, longitude: -0.1278, type: 'CITY' as const },
      { name: 'Berlin', cityName: 'Berlin', countryName: 'Germany', countryCode: 'DE', latitude: 52.52, longitude: 13.405, type: 'CITY' as const },
      { name: 'Bernau bei Berlin', cityName: 'Bernau bei Berlin', countryName: 'Germany', countryCode: 'DE', latitude: 52.6798, longitude: 13.5871, type: 'CITY' as const },
      { name: 'Bergisch Gladbach', cityName: 'Bergisch Gladbach', countryName: 'Germany', countryCode: 'DE', latitude: 50.9923, longitude: 7.1286, type: 'CITY' as const },
      { name: 'Germany', cityName: null, countryName: 'Germany', countryCode: 'DE', latitude: 51.1657, longitude: 10.4515, type: 'COUNTRY' as const },
    ];
    if (!q) return HttpResponse.json([]);
    return HttpResponse.json(places
      .filter((place) => place.name.toLowerCase().includes(q))
      .filter((place) => !countryCode || place.countryCode === countryCode)
      .filter((place) => !requestedType || place.type === requestedType)
      .slice(0, 8));
  }),
];
