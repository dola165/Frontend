import { http, HttpHandler, HttpResponse } from 'msw';
import { simulateLatency, paginate } from '../utils';

const API = '*/api';

const sampleDetail = (id: number) => ({
  id,
  name: 'Summer Cup 2026',
  description: 'Annual summer tournament. 8-a-side, group stage + knockout.',
  rules: 'Standard FIFA rules. Rolling substitutions.',
  status: 'ACTIVE',
  organizerOrganizationId: 1,
  organizerName: 'Grassroots Org',
  hostClubId: 3,
  hostClubName: 'Lakeside Athletic',
  participantScope: 'CLUB',
  visibility: 'PUBLIC',
  registrationPolicy: 'OPEN',
  startDate: '2026-07-01T00:00:00Z',
  endDate: '2026-07-14T00:00:00Z',
  registrationOpensAt: '2026-06-01T00:00:00Z',
  registrationClosesAt: '2026-06-25T00:00:00Z',
  locationId: null,
  staffAssignments: [],
  entries: [
    { id: 1, clubId: 1, clubName: 'Creekside FC', squadId: null, squadName: null, userId: null, displayName: 'Creekside FC', status: 'APPROVED', seed: 1, requestedBy: null, decidedBy: null, decidedAt: null, confirmedAt: '2026-06-02T00:00:00Z', withdrawnAt: null, withdrawalReason: null },
    { id: 2, clubId: 2, clubName: 'Metro United Academy', squadId: null, squadName: null, userId: null, displayName: 'Metro United Academy', status: 'APPROVED', seed: 2, requestedBy: null, decidedBy: null, decidedAt: null, confirmedAt: '2026-06-03T00:00:00Z', withdrawnAt: null, withdrawalReason: null },
  ],
  stages: [
    { id: 1, parentStageId: null, name: 'Group A', stageType: 'GROUP', stageOrder: 1, status: 'ACTIVE' },
    { id: 2, parentStageId: null, name: 'Group B', stageType: 'GROUP', stageOrder: 2, status: 'ACTIVE' },
    { id: 3, parentStageId: null, name: 'Knockout', stageType: 'KNOCKOUT', stageOrder: 3, status: 'PLANNING' },
  ],
  fixtures: [
    { id: 1, stageId: 1, stageName: 'Group A', homeEntryId: 1, homeLabel: 'Creekside FC', awayEntryId: 2, awayLabel: 'Metro United Academy', winnerEntryId: null, homeScore: null, awayScore: null, roundNumber: 1, fixtureOrder: 1, scheduledAt: '2026-07-01T15:00:00Z', locationId: null, status: 'SCHEDULED', linkedMatchId: null },
  ],
});

const summaryItem = (id: number) => ({
  id,
  name: 'Summer Cup 2026',
  description: 'Annual summer tournament.',
  status: 'ACTIVE',
  organizerOrganizationId: 1,
  organizerName: 'Grassroots Org',
  hostClubId: 3,
  hostClubName: 'Lakeside Athletic',
  participantScope: 'CLUB',
  visibility: 'PUBLIC',
  startDate: '2026-07-01T00:00:00Z',
  endDate: '2026-07-14T00:00:00Z',
  registrationOpensAt: '2026-06-01T00:00:00Z',
  registrationClosesAt: '2026-06-25T00:00:00Z',
  entryCount: 2,
});

export const tournamentHandlers: HttpHandler[] = [

  // -- GET /tournaments (returns PageResult<TournamentSummaryDto>) --
  http.get(`${API}/tournaments`, async ({ request }) => {
    await simulateLatency();
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? 0);
    const size = Number(url.searchParams.get('size') ?? 12);

    return HttpResponse.json(paginate([summaryItem(1), summaryItem(2)], page, size));
  }),

  // -- POST /tournaments (returns 201 with TournamentDetailDto) --
  http.post(`${API}/tournaments`, async () => {
    await simulateLatency();
    return HttpResponse.json(sampleDetail(99), { status: 201 });
  }),

  // -- GET /tournaments/:id --
  http.get(`${API}/tournaments/:tournamentId`, async ({ params }) => {
    await simulateLatency();
    return HttpResponse.json(sampleDetail(Number(params.tournamentId)));
  }),

  // -- PATCH /tournaments/:id (returns TournamentDetailDto) --
  http.patch(`${API}/tournaments/:tournamentId`, async ({ params }) => {
    await simulateLatency();
    return HttpResponse.json(sampleDetail(Number(params.tournamentId)));
  }),

  // -- STAFF --
  http.post(`${API}/tournaments/:tournamentId/staff`, async ({ params }) => {
    await simulateLatency();
    return HttpResponse.json(sampleDetail(Number(params.tournamentId)));
  }),

  http.delete(`${API}/tournaments/:tournamentId/staff/:assignmentId`, async ({ params }) => {
    await simulateLatency();
    return HttpResponse.json(sampleDetail(Number(params.tournamentId)));
  }),

  // -- ENTRIES --
  http.post(`${API}/tournaments/:tournamentId/entries`, async ({ params }) => {
    await simulateLatency();
    return HttpResponse.json(sampleDetail(Number(params.tournamentId)), { status: 201 });
  }),

  http.patch(`${API}/tournaments/:tournamentId/entries/:entryId/status`, async ({ params }) => {
    await simulateLatency();
    return HttpResponse.json(sampleDetail(Number(params.tournamentId)));
  }),

  http.post(`${API}/tournaments/:tournamentId/entries/:entryId/withdraw`, async ({ params }) => {
    await simulateLatency();
    return HttpResponse.json(sampleDetail(Number(params.tournamentId)));
  }),

  http.delete(`${API}/tournaments/:tournamentId/entries/:entryId`, async ({ params }) => {
    await simulateLatency();
    return HttpResponse.json(sampleDetail(Number(params.tournamentId)));
  }),

  http.put(`${API}/tournaments/:tournamentId/entries/seeding`, async ({ params }) => {
    await simulateLatency();
    return HttpResponse.json(sampleDetail(Number(params.tournamentId)));
  }),

  // -- STAGES --
  http.post(`${API}/tournaments/:tournamentId/stages`, async ({ params }) => {
    await simulateLatency();
    return HttpResponse.json(sampleDetail(Number(params.tournamentId)), { status: 201 });
  }),

  http.post(`${API}/tournaments/:tournamentId/stages/:stageId/fixtures`, async ({ params }) => {
    await simulateLatency();
    return HttpResponse.json(sampleDetail(Number(params.tournamentId)), { status: 201 });
  }),

  http.post(`${API}/tournaments/:tournamentId/stages/:stageId/fixtures/randomize`, async ({ params }) => {
    await simulateLatency();
    return HttpResponse.json(sampleDetail(Number(params.tournamentId)));
  }),

  // -- FIXTURES --
  http.patch(`${API}/tournaments/:tournamentId/fixtures/:fixtureId/participants`, async ({ params }) => {
    await simulateLatency();
    return HttpResponse.json(sampleDetail(Number(params.tournamentId)));
  }),

  http.post(`${API}/tournaments/:tournamentId/fixtures/:fixtureId/move-entry`, async ({ params }) => {
    await simulateLatency();
    return HttpResponse.json(sampleDetail(Number(params.tournamentId)));
  }),

  http.post(`${API}/tournaments/:tournamentId/fixtures/:fixtureId/replace-entry`, async ({ params }) => {
    await simulateLatency();
    return HttpResponse.json(sampleDetail(Number(params.tournamentId)));
  }),

  http.post(`${API}/tournaments/:tournamentId/fixtures/:fixtureId/match-link`, async ({ params }) => {
    await simulateLatency();
    return HttpResponse.json(sampleDetail(Number(params.tournamentId)));
  }),

  http.delete(`${API}/tournaments/:tournamentId/fixtures/:fixtureId/match-link`, async ({ params }) => {
    await simulateLatency();
    return HttpResponse.json(sampleDetail(Number(params.tournamentId)));
  }),

  http.post(`${API}/tournaments/:tournamentId/fixtures/:fixtureId/complete`, async ({ params }) => {
    await simulateLatency();
    return HttpResponse.json(sampleDetail(Number(params.tournamentId)));
  }),

  http.post(`${API}/tournaments/:tournamentId/fixtures/:fixtureId/cancel`, async ({ params }) => {
    await simulateLatency();
    return HttpResponse.json(sampleDetail(Number(params.tournamentId)));
  }),

  http.patch(`${API}/tournaments/:tournamentId/fixtures/:fixtureId/scores`, async ({ params }) => {
    await simulateLatency();
    return HttpResponse.json(sampleDetail(Number(params.tournamentId)));
  }),

  http.post(`${API}/tournaments/:tournamentId/fixtures/:fixtureId/reopen`, async ({ params }) => {
    await simulateLatency();
    return HttpResponse.json(sampleDetail(Number(params.tournamentId)));
  }),

  // -- PLAYER REGISTRATION --
  http.post(`${API}/tournaments/:tournamentId/register-player`, async ({ params }) => {
    await simulateLatency();
    return HttpResponse.json(sampleDetail(Number(params.tournamentId)), { status: 201 });
  }),

  http.get(`${API}/tournaments/:tournamentId/player-queue`, async ({ params }) => {
    await simulateLatency();
    return HttpResponse.json(sampleDetail(Number(params.tournamentId)));
  }),

  // -- DRAFT TEAMS --
  http.post(`${API}/tournaments/:tournamentId/draft-teams`, async () => {
    await simulateLatency();
    return HttpResponse.json({
      id: 50, name: 'New Team', status: 'FORMING', promotedEntryId: null,
      createdBy: 1, createdAt: new Date().toISOString(), members: [],
    }, { status: 201 });
  }),

  http.get(`${API}/tournaments/:tournamentId/draft-teams`, async () => {
    await simulateLatency();
    return HttpResponse.json([
      { id: 1, name: 'Alpha Squad', status: 'FORMING', memberCount: 5, promotedEntryId: null, createdAt: new Date().toISOString() },
      { id: 2, name: 'Beta Squad', status: 'LOCKED', memberCount: 8, promotedEntryId: null, createdAt: new Date().toISOString() },
    ]);
  }),

  http.get(`${API}/tournaments/:tournamentId/draft-teams/:teamId`, async () => {
    await simulateLatency();
    return HttpResponse.json({
      id: 1, name: 'Alpha Squad', status: 'FORMING', promotedEntryId: null,
      createdBy: 2, createdAt: new Date().toISOString(), members: [],
    });
  }),

  http.post(`${API}/tournaments/:tournamentId/draft-teams/:teamId/members`, async () => {
    await simulateLatency();
    return HttpResponse.json({
      id: 1, name: 'Alpha Squad', status: 'FORMING', promotedEntryId: null,
      createdBy: 2, createdAt: new Date().toISOString(), members: [],
    });
  }),

  http.delete(`${API}/tournaments/:tournamentId/draft-teams/:teamId/members/:entryId`, async () => {
    await simulateLatency();
    return HttpResponse.json({
      id: 1, name: 'Alpha Squad', status: 'FORMING', promotedEntryId: null,
      createdBy: 2, createdAt: new Date().toISOString(), members: [],
    });
  }),

  http.post(`${API}/tournaments/:tournamentId/draft-teams/:teamId/promote`, async () => {
    await simulateLatency();
    return HttpResponse.json({
      id: 1, name: 'Alpha Squad', status: 'PROMOTED', promotedEntryId: 99,
      createdBy: 2, createdAt: new Date().toISOString(), members: [],
    });
  }),

  http.delete(`${API}/tournaments/:tournamentId/draft-teams/:teamId`, async () => {
    await simulateLatency();
    return new HttpResponse(null, { status: 204 });
  }),

  // -- INVITATIONS --
  http.get(`${API}/tournaments/:tournamentId/invitations`, async () => {
    await simulateLatency();
    return HttpResponse.json([]);
  }),

  http.post(`${API}/tournaments/:tournamentId/invitations`, async () => {
    await simulateLatency();
    return HttpResponse.json({
      id: 1, clubId: 1, clubName: 'Creekside FC', squadId: null, squadName: null,
      status: 'PENDING', createdAt: new Date().toISOString(),
    }, { status: 201 });
  }),

  http.delete(`${API}/tournaments/:tournamentId/invitations/:invitationId`, async () => {
    await simulateLatency();
    return new HttpResponse(null, { status: 204 });
  }),
];
