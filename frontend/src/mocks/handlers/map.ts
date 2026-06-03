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

  // -- GET /map/nearby (returns List<MapMarkerDto>) --
  http.get(`${API}/map/nearby`, async () => {
    await simulateLatency();
    const clubMarkers = [...clubs().values()].map((c) => ({
      id: c.id,
      name: c.name,
      type: 'CLUB' as const,
      latitude: c.city === 'Bristol' ? 51.4545 : c.city === 'Manchester' ? 53.4808 : 51.5074,
      longitude: c.city === 'Bristol' ? -2.5879 : c.city === 'Manchester' ? -2.2426 : -0.1278,
      addressText: c.city,
      logoUrl: c.logoUrl,
      memberCount: c.memberCount,
    }));

    const eventMarkers = [...events().values()]
      .filter((e) => e.locationLat != null && e.locationLng != null && e.visibility === 'PUBLIC')
      .map((e) => ({
        id: e.eventId + 1000,
        name: e.title,
        type: 'EVENT' as const,
        latitude: e.locationLat!,
        longitude: e.locationLng!,
        addressText: e.locationName ?? null,
        logoUrl: null,
        memberCount: 0,
      }));

    return HttpResponse.json([...clubMarkers, ...eventMarkers]);
  }),
];
