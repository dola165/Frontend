import { http, HttpHandler, HttpResponse } from 'msw';
import { clubs, events } from '../data/store';
import { simulateLatency } from '../utils';

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
  http.get(`${API}/map/nearby`, async () => {
    await simulateLatency();
    const clubMarkers = [...clubs().values()].map((c) => ({
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

    return HttpResponse.json({
      content: [...clubMarkers, ...eventMarkers],
      page: 0,
      size: 50,
      totalElements: clubMarkers.length + eventMarkers.length,
    });
  }),
];
