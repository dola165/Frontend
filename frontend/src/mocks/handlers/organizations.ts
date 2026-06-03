import { http, HttpHandler, HttpResponse } from 'msw';
import { clubs } from '../data/store';
import { simulateLatency } from '../utils';

const API = '*/api';

export const organizationHandlers: HttpHandler[] = [

  // -- GET /organizations/mine --
  http.get(`${API}/organizations/mine`, async () => {
    await simulateLatency();
    return HttpResponse.json([
      {
        id: 1,
        slug: 'grassroots-org',
        displayName: 'Grassroots Org',
        description: 'A local grassroots organization.',
        membershipRole: 'OWNER',
        kinds: ['SPORTS_ORG'],
        primaryKind: 'SPORTS_ORG',
        clubBacked: false,
        canCreateTournament: true,
      },
    ]);
  }),

  // -- POST /organizations (returns 201 with MyOrganizationDto) --
  http.post(`${API}/organizations`, async () => {
    await simulateLatency();
    return HttpResponse.json({
      id: 2, slug: 'new-org', displayName: 'New Organization',
      description: null, membershipRole: 'OWNER', kinds: ['SPORTS_ORG'],
      primaryKind: 'SPORTS_ORG', clubBacked: false, canCreateTournament: true,
    }, { status: 201 });
  }),

  // -- GET /organizations/:orgId/tournament-host-clubs --
  http.get(`${API}/organizations/:orgId/tournament-host-clubs`, async () => {
    await simulateLatency();
    const allClubs = [...clubs().values()];
    return HttpResponse.json(allClubs.map((c) => ({
      clubId: c.id,
      clubName: c.name,
      organizationId: 1,
      organizationName: 'Grassroots Org',
      accessType: c.id === 1 ? 'OWN_ORGANIZATION' as const : 'ORGANIZER_FOR' as const,
    })));
  }),
];
