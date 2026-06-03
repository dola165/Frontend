import { http, HttpHandler, HttpResponse } from 'msw';
import { simulateLatency, paginate } from '../utils';

const API = '*/api';

export const tryoutHandlers: HttpHandler[] = [

  // -- GET /tryouts (returns PageResult<TryoutBrowseItemDto>) --
  http.get(`${API}/tryouts`, async ({ request }) => {
    await simulateLatency();
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? 0);
    const size = Number(url.searchParams.get('size') ?? 20);

    return HttpResponse.json(paginate([
      {
        id: 1, title: 'U16 Open Trials', clubId: 1, clubName: 'Creekside FC',
        position: 'Forward', ageGroup: 'U16', date: '2026-06-14T10:00:00Z',
        location: 'Training Ground A', status: 'OPEN', applicantCount: 5,
      },
      {
        id: 2, title: 'Goalkeeper Assessment', clubId: 2, clubName: 'Metro United Academy',
        position: 'Goalkeeper', ageGroup: 'U18', date: '2026-06-20T09:00:00Z',
        location: 'Academy Pitch 2', status: 'OPEN', applicantCount: 3,
      },
    ], page, size));
  }),

  // -- POST /tryouts/:id/apply (returns 201) --
  http.post(`${API}/tryouts/:tryoutId/apply`, async () => {
    await simulateLatency();
    return HttpResponse.json({
      id: Math.floor(Math.random() * 1000) + 100,
      tryoutId: 1,
      status: 'PENDING',
      appliedAt: new Date().toISOString(),
    }, { status: 201 });
  }),
];

// -- Admin tryouts (separate URL prefix) --
export const tryoutAdminHandlers: HttpHandler[] = [

  http.get(`${API}/admin/tryouts/clubs/:clubId/applications`, async () => {
    await simulateLatency();
    return HttpResponse.json([
      {
        id: 1, userId: 4, fullName: 'Emma Thompson', username: 'emma.t',
        avatarUrl: null, role: 'FAN', status: 'PENDING',
        message: 'I would love to try out for the U16 squad.',
        appliedAt: new Date().toISOString(),
      },
    ]);
  }),

  http.put(`${API}/admin/tryouts/clubs/:clubId/applications/:applicationId/status`, async () => {
    await simulateLatency();
    return HttpResponse.json({ message: 'Status updated successfully' });
  }),
];
