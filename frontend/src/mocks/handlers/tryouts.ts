import { http, HttpHandler, HttpResponse } from 'msw';
import { simulateLatency, paginate } from '../utils';

const API = '*/api';

// Shared mock tryout catalog — used by GET /tryouts and the apply handler
// (join-policy enforcement). Exported so the map mock can render TRYOUT
// markers for the same demo records.
export interface MockTryout {
  id: number;
  title: string;
  clubId: number;
  clubName: string;
  position: string;
  ageGroup: string;
  date: string;
  location: string;
  status: string;
  applicantCount: number;
  joinPolicy: 'OPEN_TRIAL' | 'APPLICATION_REQUIRED' | 'INVITE_ONLY';
}

/** GET /tryouts payload — the browse DTO carries no joinPolicy field. */
const toBrowseItem = (t: MockTryout) => ({
  id: t.id,
  title: t.title,
  clubId: t.clubId,
  clubName: t.clubName,
  position: t.position,
  ageGroup: t.ageGroup,
  date: t.date,
  location: t.location,
  status: t.status,
  applicantCount: t.applicantCount,
});

export const MOCK_TRYOUTS: MockTryout[] = [
  {
    id: 1, title: 'U16 Open Trials', clubId: 1, clubName: 'Creekside FC',
    position: 'Forward', ageGroup: 'U16', date: '2026-06-14T10:00:00Z',
    location: 'Training Ground A', status: 'OPEN', applicantCount: 5,
    joinPolicy: 'OPEN_TRIAL',
  },
  {
    id: 2, title: 'Goalkeeper Assessment', clubId: 2, clubName: 'Metro United Academy',
    position: 'Goalkeeper', ageGroup: 'U18', date: '2026-06-20T09:00:00Z',
    location: 'Academy Pitch 2', status: 'OPEN', applicantCount: 3,
    joinPolicy: 'APPLICATION_REQUIRED',
  },
  {
    id: 3, title: 'Elite Intake — By Invitation', clubId: 3, clubName: 'Lakeside Athletic',
    position: 'Midfielder', ageGroup: 'U17', date: '2026-06-28T11:00:00Z',
    location: 'Lakeside Arena', status: 'OPEN', applicantCount: 0,
    joinPolicy: 'INVITE_ONLY',
  },
];

export const tryoutHandlers: HttpHandler[] = [

  // -- GET /tryouts (returns PageResult<TryoutBrowseItemDto>) --
  http.get(`${API}/tryouts`, async ({ request }) => {
    await simulateLatency();
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? 0);
    const size = Number(url.searchParams.get('size') ?? 20);

    return HttpResponse.json(paginate(
      MOCK_TRYOUTS.map(toBrowseItem),
      page,
      size
    ));
  }),

  // -- POST /tryouts/:id/apply (201; 409 when the club is invite-only) --
  http.post(`${API}/tryouts/:tryoutId/apply`, async ({ params }) => {
    await simulateLatency();
    const tryout = MOCK_TRYOUTS.find((t) => t.id === Number(params.tryoutId));

    if (tryout?.joinPolicy === 'INVITE_ONLY') {
      return HttpResponse.json(
        { error: 'This club only accepts invited players.' },
        { status: 409 }
      );
    }

    return HttpResponse.json({
      id: Math.floor(Math.random() * 1000) + 100,
      tryoutId: tryout?.id ?? 1,
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
