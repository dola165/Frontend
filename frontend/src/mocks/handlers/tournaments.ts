import { http, HttpHandler, HttpResponse } from 'msw';
import { simulateLatency, paginate } from '../utils';

const API = '*/api';

// In-memory dev state: tournaments whose knockout bracket was "generated".
const generatedIds = new Set<number>();

// Mutable per-tournament detail store so bracket edits (drag/advance/complete)
// persist across refetches during the manual dev walk.
interface MockFixture {
    id: number;
    stageId: number | null;
    stageName: string | null;
    homeEntryId: number | null;
    homeLabel: string | null;
    awayEntryId: number | null;
    awayLabel: string | null;
    winnerEntryId: number | null;
    homeScore: number | null;
    awayScore: number | null;
    roundNumber: number | null;
    fixtureOrder: number | null;
    scheduledAt: string | null;
    locationId: number | null;
    status: string;
    linkedMatchId: number | null;
}

interface MockDetail {
    id: number;
    name: string;
    status: string;
    entries: Array<Record<string, unknown>>;
    stages: Array<Record<string, unknown>>;
    fixtures: MockFixture[];
}

const details = new Map<number, MockDetail>();

const ensureDetail = (id: number): MockDetail => {
    if (!details.has(id)) {
        const base = generatedIds.has(id) ? sampleGeneratedDetail(id) : sampleDetail(id);
        details.set(id, {
            ...base,
            fixtures: (base.fixtures as MockFixture[]).map((f) => ({ ...f })),
        } as MockDetail);
    }
    return details.get(id)!;
};

const findFixture = (detail: MockDetail, fixtureId: number): MockFixture | undefined =>
    detail.fixtures.find((f) => f.id === fixtureId);

// In-memory fake ("off-platform") draft-team members per team.
const fakeMembersByTeam = new Map<number, Array<{ id: number; name: string }>>();
let fakeMemberSeq = 1000;

// Stateful draft teams: created teams persist, promotion lands them in the
// tournament's entries so they appear in the teams-only bracket pool.
interface MockDraftTeam {
    id: number;
    name: string;
    status: string;
    promotedEntryId: number | null;
    createdBy: number | null;
    createdAt: string;
    memberEntryIds: number[];
}
const draftTeamsByTournament = new Map<number, MockDraftTeam[]>();
let draftTeamSeq = 500;

const teamsOf = (tournamentId: number): MockDraftTeam[] => {
    if (!draftTeamsByTournament.has(tournamentId)) draftTeamsByTournament.set(tournamentId, []);
    return draftTeamsByTournament.get(tournamentId)!;
};

const findTeam = (tournamentId: number, teamId: number): MockDraftTeam | undefined =>
    teamsOf(tournamentId).find((t) => t.id === teamId);

const teamDetail = (team: MockDraftTeam | undefined) => {
    if (!team) return null;
    return {
        id: team.id, name: team.name, status: team.status, promotedEntryId: team.promotedEntryId,
        createdBy: team.createdBy, createdAt: team.createdAt,
        members: team.memberEntryIds.map((entryId) => ({
            id: entryId, clubId: null, clubName: null, squadId: null, squadName: null,
            userId: entryId, displayName: `Player ${entryId}`, status: 'ACTIVE', seed: null,
            requestedBy: null, decidedBy: null, decidedAt: null, confirmedAt: null,
            withdrawnAt: null, withdrawalReason: null, draftTeamId: null,
        })),
        fakeMembers: fakeMembersByTeam.get(team.id) ?? [],
    };
};

// Empty knockout shell for a chosen spot count (P4 bracket diagram): all
// participant slots null; the diagram derives locked placeholders from
// roundNumber + fixtureOrder, so no source ids are needed in the mock.
const buildShellFixtures = (bracketSize: number) => {
    const fixtures: Array<Record<string, unknown>> = [];
    const totalRounds = Math.log2(bracketSize);
    let perRound = bracketSize / 2;
    let id = 100;
    for (let round = 1; round <= totalRounds; round++) {
        for (let order = 1; order <= perRound; order++) {
            fixtures.push({
                id: id++, stageId: 90, stageName: 'Knockout',
                homeEntryId: null, homeLabel: null, awayEntryId: null, awayLabel: null,
                winnerEntryId: null, homeScore: null, awayScore: null,
                roundNumber: round, fixtureOrder: order,
                scheduledAt: null, locationId: null, status: 'SCHEDULED', linkedMatchId: null,
            });
        }
        perRound /= 2;
    }
    return fixtures;
};

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
  bannerImageUrl: 'https://picsum.photos/seed/tournament-banner/1600/400',
  // Champion set so the workspace banner is visible in the dev-browser walk.
  championEntryId: 2,
  championName: 'Metro United Academy',
  staffAssignments: [],
  entries: [
    { id: 1, clubId: 1, clubName: 'Creekside FC', squadId: 11, squadName: 'Creekside U18', userId: null, displayName: 'Creekside FC', status: 'APPROVED', seed: 1, requestedBy: null, decidedBy: null, decidedAt: null, confirmedAt: '2026-06-02T00:00:00Z', withdrawnAt: null, withdrawalReason: null },
    { id: 2, clubId: 2, clubName: 'Metro United Academy', squadId: null, squadName: null, userId: null, displayName: 'Metro United Academy', status: 'APPROVED', seed: 2, requestedBy: null, decidedBy: null, decidedAt: null, confirmedAt: '2026-06-03T00:00:00Z', withdrawnAt: null, withdrawalReason: null },
    { id: 3, clubId: 4, clubName: 'Riverside Rovers', squadId: null, squadName: null, userId: null, displayName: 'Riverside Rovers', status: 'ACTIVE', seed: 3, requestedBy: null, decidedBy: null, decidedAt: null, confirmedAt: '2026-06-04T00:00:00Z', withdrawnAt: null, withdrawalReason: null },
  ],
  stages: [
    { id: 1, parentStageId: null, name: 'Group A', stageType: 'GROUP', stageOrder: 1, status: 'ACTIVE', advanceCount: 2 },
    { id: 2, parentStageId: null, name: 'Group B', stageType: 'GROUP', stageOrder: 2, status: 'ACTIVE', advanceCount: 2 },
    { id: 3, parentStageId: null, name: 'Knockout', stageType: 'KNOCKOUT', stageOrder: 3, status: 'PLANNING', advanceCount: null },
  ],
  fixtures: [
    { id: 1, stageId: 1, stageName: 'Group A', homeEntryId: 1, homeLabel: 'Creekside FC', awayEntryId: 2, awayLabel: 'Metro United Academy', winnerEntryId: null, homeScore: null, awayScore: null, roundNumber: 1, fixtureOrder: 1, scheduledAt: '2026-07-01T15:00:00Z', locationId: null, status: 'SCHEDULED', linkedMatchId: null },
  ],
});

// Variant returned after "Generate bracket": seeded knockout with a bye and
// placeholder winner slots in the final.
const sampleGeneratedDetail = (id: number) => ({
  ...sampleDetail(id),
  fixtures: [
    ...sampleDetail(id).fixtures,
    { id: 2, stageId: 3, stageName: 'Knockout', homeEntryId: 1, homeLabel: 'Creekside FC', awayEntryId: null, awayLabel: null, winnerEntryId: null, homeScore: null, awayScore: null, roundNumber: 1, fixtureOrder: 1, scheduledAt: null, locationId: null, status: 'SCHEDULED', linkedMatchId: null },
    { id: 3, stageId: 3, stageName: 'Knockout', homeEntryId: 2, homeLabel: 'Metro United Academy', awayEntryId: 3, awayLabel: 'Riverside Rovers', winnerEntryId: null, homeScore: null, awayScore: null, roundNumber: 1, fixtureOrder: 2, scheduledAt: null, locationId: null, status: 'SCHEDULED', linkedMatchId: null },
    { id: 4, stageId: 3, stageName: 'Knockout', homeEntryId: null, homeLabel: null, awayEntryId: null, awayLabel: null, winnerEntryId: null, homeScore: null, awayScore: null, roundNumber: 2, fixtureOrder: 1, scheduledAt: null, locationId: null, status: 'SCHEDULED', linkedMatchId: null },
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
    return HttpResponse.json(ensureDetail(Number(params.tournamentId)));
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
  http.post(`${API}/tournaments/:tournamentId/entries`, async ({ params, request }) => {
    await simulateLatency();
    const detail = ensureDetail(Number(params.tournamentId));
    let body: { clubId?: number; squadId?: number | null } = {};
    try {
      body = (await request.json()) as { clubId?: number; squadId?: number | null };
    } catch {
      // no body
    }
    if (body?.clubId) {
      detail.entries.push({
        id: 99, clubId: body.clubId, clubName: 'My Club',
        squadId: body.squadId ?? null, squadName: body.squadId ? 'My Squad' : null,
        userId: null, displayName: 'My Club', status: 'PENDING', seed: null,
        requestedBy: null, decidedBy: null, decidedAt: null, confirmedAt: null,
        withdrawnAt: null, withdrawalReason: null, draftTeamId: null,
      });
    }
    return HttpResponse.json(detail, { status: 201 });
  }),

  http.patch(`${API}/tournaments/:tournamentId/entries/:entryId/squad`, async ({ params, request }) => {
    await simulateLatency();
    const detail = ensureDetail(Number(params.tournamentId));
    const body = (await request.json()) as { squadId?: number | null };
    const entry = detail.entries.find((e) => (e as { id: number }).id === Number(params.entryId));
    if (entry) {
      const e = entry as Record<string, unknown>;
      e.squadId = body.squadId ?? null;
      e.squadName = body.squadId ? 'Selected Squad' : null;
    }
    return HttpResponse.json(detail);
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
  http.post(`${API}/tournaments/:tournamentId/stages`, async ({ params, request }) => {
    await simulateLatency();
    const id = Number(params.tournamentId);
    let body: { bracketSize?: number } = {};
    try {
      body = (await request.json()) as { bracketSize?: number };
    } catch {
      // no body
    }
    if (body?.bracketSize) {
      const created = {
        ...sampleDetail(id),
        stages: [
          ...sampleDetail(id).stages,
          { id: 90, parentStageId: null, name: 'Knockout', stageType: 'KNOCKOUT', stageOrder: 3, status: 'PLANNING', advanceCount: null },
        ],
        fixtures: buildShellFixtures(body.bracketSize),
      };
      details.set(id, created as unknown as MockDetail);
      return HttpResponse.json(created, { status: 201 });
    }
    const detail = ensureDetail(id);
    return HttpResponse.json(detail, { status: 201 });
  }),

  http.post(`${API}/tournaments/:tournamentId/stages/:stageId/fixtures`, async ({ params }) => {
    await simulateLatency();
    return HttpResponse.json(sampleDetail(Number(params.tournamentId)), { status: 201 });
  }),

  http.post(`${API}/tournaments/:tournamentId/stages/:stageId/fixtures/randomize`, async ({ params }) => {
    await simulateLatency();
    return HttpResponse.json(sampleDetail(Number(params.tournamentId)));
  }),

  // -- STANDINGS --
  http.get(`${API}/tournaments/:tournamentId/stages/:stageId/standings`, async () => {
    await simulateLatency();
    return HttpResponse.json([
      { entryId: 1, entryName: 'Creekside FC', entryType: 'CLUB', played: 1, won: 1, drawn: 0, lost: 0, goalsFor: 2, goalsAgainst: 0, goalDifference: 2, points: 3 },
      { entryId: 2, entryName: 'Metro United Academy', entryType: 'CLUB', played: 1, won: 0, drawn: 0, lost: 1, goalsFor: 0, goalsAgainst: 2, goalDifference: -2, points: 0 },
      { entryId: 3, entryName: 'Riverside Rovers', entryType: 'CLUB', played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 },
    ]);
  }),

  // -- FIXTURES --
  http.patch(`${API}/tournaments/:tournamentId/fixtures/:fixtureId/participants`, async ({ params, request }) => {
    await simulateLatency();
    const detail = ensureDetail(Number(params.tournamentId));
    const fx = findFixture(detail, Number(params.fixtureId));
    if (fx) {
      const body = (await request.json()) as { homeEntryId?: number | null; awayEntryId?: number | null };
      if (body?.homeEntryId !== undefined) fx.homeEntryId = body.homeEntryId;
      if (body?.awayEntryId !== undefined) fx.awayEntryId = body.awayEntryId;
    }
    return HttpResponse.json(detail);
  }),

  http.post(`${API}/tournaments/:tournamentId/fixtures/:fixtureId/move-entry`, async ({ params, request }) => {
    await simulateLatency();
    const detail = ensureDetail(Number(params.tournamentId));
    const source = findFixture(detail, Number(params.fixtureId));
    const body = (await request.json()) as { entryId: number; targetFixtureId: number; targetSlot: 'HOME' | 'AWAY' };
    const target = findFixture(detail, body.targetFixtureId);
    if (source && target) {
      if (source.homeEntryId === body.entryId) source.homeEntryId = null;
      if (source.awayEntryId === body.entryId) source.awayEntryId = null;
      if (body.targetSlot === 'HOME') target.homeEntryId = body.entryId;
      else target.awayEntryId = body.entryId;
    }
    return HttpResponse.json(detail);
  }),

  http.post(`${API}/tournaments/:tournamentId/fixtures/:fixtureId/replace-entry`, async ({ params, request }) => {
    await simulateLatency();
    const detail = ensureDetail(Number(params.tournamentId));
    const fx = findFixture(detail, Number(params.fixtureId));
    if (fx) {
      const body = (await request.json()) as { slot: 'HOME' | 'AWAY'; replacementEntryId: number };
      if (body.slot === 'HOME') fx.homeEntryId = body.replacementEntryId;
      else fx.awayEntryId = body.replacementEntryId;
    }
    return HttpResponse.json(detail);
  }),

  http.post(`${API}/tournaments/:tournamentId/fixtures/:fixtureId/match-link`, async ({ params }) => {
    await simulateLatency();
    return HttpResponse.json(sampleDetail(Number(params.tournamentId)));
  }),

  http.delete(`${API}/tournaments/:tournamentId/fixtures/:fixtureId/match-link`, async ({ params }) => {
    await simulateLatency();
    return HttpResponse.json(sampleDetail(Number(params.tournamentId)));
  }),

  http.post(`${API}/tournaments/:tournamentId/fixtures/:fixtureId/complete`, async ({ params, request }) => {
    await simulateLatency();
    const detail = ensureDetail(Number(params.tournamentId));
    const fx = findFixture(detail, Number(params.fixtureId));
    if (fx) {
      const body = (await request.json()) as { winnerEntryId?: number | null; homeScore?: number | null; awayScore?: number | null };
      fx.winnerEntryId = body.winnerEntryId ?? null;
      fx.homeScore = body.homeScore ?? null;
      fx.awayScore = body.awayScore ?? null;
      fx.status = 'COMPLETED';
      // Parity with the backend: the winner auto-advances into the next slot.
      if (fx.winnerEntryId != null && fx.roundNumber != null && fx.fixtureOrder != null) {
        const targetOrder = Math.ceil(fx.fixtureOrder / 2);
        const target = detail.fixtures.find(
          (f) =>
            f.stageId === fx.stageId &&
            f.roundNumber === fx.roundNumber! + 1 &&
            f.fixtureOrder === targetOrder,
        );
        if (target) {
          if (fx.fixtureOrder % 2 === 1) target.homeEntryId = fx.winnerEntryId;
          else target.awayEntryId = fx.winnerEntryId;
        }
      }
    }
    return HttpResponse.json(detail);
  }),

  http.post(`${API}/tournaments/:tournamentId/fixtures/:fixtureId/cancel`, async ({ params }) => {
    await simulateLatency();
    const detail = ensureDetail(Number(params.tournamentId));
    const fx = findFixture(detail, Number(params.fixtureId));
    if (fx) fx.status = 'CANCELLED';
    return HttpResponse.json(detail);
  }),

  http.patch(`${API}/tournaments/:tournamentId/fixtures/:fixtureId/scores`, async ({ params, request }) => {
    await simulateLatency();
    const detail = ensureDetail(Number(params.tournamentId));
    const fx = findFixture(detail, Number(params.fixtureId));
    if (fx) {
      const body = (await request.json()) as { homeScore?: number | null; awayScore?: number | null };
      if (body?.homeScore !== undefined) fx.homeScore = body.homeScore;
      if (body?.awayScore !== undefined) fx.awayScore = body.awayScore;
    }
    return HttpResponse.json(detail);
  }),

  http.post(`${API}/tournaments/:tournamentId/fixtures/:fixtureId/reopen`, async ({ params }) => {
    await simulateLatency();
    const detail = ensureDetail(Number(params.tournamentId));
    const fx = findFixture(detail, Number(params.fixtureId));
    if (fx) {
      fx.status = 'SCHEDULED';
      fx.winnerEntryId = null;
      fx.homeScore = null;
      fx.awayScore = null;
    }
    return HttpResponse.json(detail);
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

  // -- DRAFT TEAMS (stateful: teams persist, promotion lands in the pool) --
  http.post(`${API}/tournaments/:tournamentId/draft-teams`, async ({ params, request }) => {
    await simulateLatency();
    const tournamentId = Number(params.tournamentId);
    let body: { name?: string } = {};
    try {
      body = (await request.json()) as { name?: string };
    } catch {
      // no body
    }
    const team: MockDraftTeam = {
      id: draftTeamSeq++, name: body.name?.trim() || 'New Team', status: 'FORMING',
      promotedEntryId: null, createdBy: 1, createdAt: new Date().toISOString(), memberEntryIds: [],
    };
    teamsOf(tournamentId).push(team);
    return HttpResponse.json(teamDetail(team), { status: 201 });
  }),

  http.get(`${API}/tournaments/:tournamentId/draft-teams`, async ({ params }) => {
    await simulateLatency();
    const tournamentId = Number(params.tournamentId);
    return HttpResponse.json(
      teamsOf(tournamentId)
        .filter((t) => t.status !== 'DISBANDED')
        .map((t) => ({
          id: t.id, name: t.name, status: t.status, promotedEntryId: t.promotedEntryId,
          memberCount: t.memberEntryIds.length + (fakeMembersByTeam.get(t.id) ?? []).length,
          createdAt: t.createdAt,
        })),
    );
  }),

  http.get(`${API}/tournaments/:tournamentId/draft-teams/:teamId`, async ({ params }) => {
    await simulateLatency();
    return HttpResponse.json(teamDetail(findTeam(Number(params.tournamentId), Number(params.teamId))));
  }),

  http.patch(`${API}/tournaments/:tournamentId/draft-teams/:teamId`, async ({ params, request }) => {
    await simulateLatency();
    const tournamentId = Number(params.tournamentId);
    const team = findTeam(tournamentId, Number(params.teamId));
    if (!team) {
      return HttpResponse.json({ message: 'Draft team not found.' }, { status: 404 });
    }
    const body = (await request.json()) as { name?: string };
    if (team.status !== 'FORMING' && team.status !== 'LOCKED') {
      return HttpResponse.json({ message: 'Only forming or locked draft teams can be renamed.' }, { status: 409 });
    }
    const name = body.name?.trim();
    if (!name) {
      return HttpResponse.json({ message: 'Team name is required.' }, { status: 400 });
    }
    team.name = name;
    return HttpResponse.json(teamDetail(team));
  }),

  http.post(`${API}/tournaments/:tournamentId/draft-teams/:teamId/fake-members`, async ({ params, request }) => {
    await simulateLatency();
    const tournamentId = Number(params.tournamentId);
    const teamId = Number(params.teamId);
    const body = (await request.json()) as { name: string };
    const list = fakeMembersByTeam.get(teamId) ?? [];
    list.push({ id: fakeMemberSeq++, name: body.name });
    fakeMembersByTeam.set(teamId, list);
    return HttpResponse.json(teamDetail(findTeam(tournamentId, teamId)));
  }),

  http.delete(`${API}/tournaments/:tournamentId/draft-teams/:teamId/fake-members/:memberId`, async ({ params }) => {
    await simulateLatency();
    const tournamentId = Number(params.tournamentId);
    const teamId = Number(params.teamId);
    const memberId = Number(params.memberId);
    const list = (fakeMembersByTeam.get(teamId) ?? []).filter((m) => m.id !== memberId);
    fakeMembersByTeam.set(teamId, list);
    return HttpResponse.json(teamDetail(findTeam(tournamentId, teamId)));
  }),

  http.post(`${API}/tournaments/:tournamentId/draft-teams/:teamId/members`, async ({ params, request }) => {
    await simulateLatency();
    const tournamentId = Number(params.tournamentId);
    const team = findTeam(tournamentId, Number(params.teamId));
    if (team) {
      const body = (await request.json()) as { entryIds?: number[] };
      for (const entryId of body.entryIds ?? []) {
        if (!team.memberEntryIds.includes(entryId)) team.memberEntryIds.push(entryId);
      }
    }
    return HttpResponse.json(teamDetail(team));
  }),

  http.delete(`${API}/tournaments/:tournamentId/draft-teams/:teamId/members/:entryId`, async ({ params }) => {
    await simulateLatency();
    const tournamentId = Number(params.tournamentId);
    const team = findTeam(tournamentId, Number(params.teamId));
    if (team) {
      team.memberEntryIds = team.memberEntryIds.filter((id) => id !== Number(params.entryId));
    }
    return HttpResponse.json(teamDetail(team));
  }),

  http.post(`${API}/tournaments/:tournamentId/draft-teams/:teamId/promote`, async ({ params }) => {
    await simulateLatency();
    const tournamentId = Number(params.tournamentId);
    const team = findTeam(tournamentId, Number(params.teamId));
    if (team) {
      const total = team.memberEntryIds.length + (fakeMembersByTeam.get(team.id) ?? []).length;
      if (total < 5) {
        return HttpResponse.json(
          { message: 'A draft team needs at least 5 members to be promoted (minimum for small-sided football).' },
          { status: 409 },
        );
      }
      team.status = 'PROMOTED';
      team.promotedEntryId = 900 + team.id;
      // The promoted team lands in the tournament's entries (teams-only pool).
      ensureDetail(tournamentId).entries.push({
        id: team.promotedEntryId, clubId: null, clubName: null, squadId: null, squadName: null,
        userId: null, displayName: team.name, status: 'ACTIVE', seed: null,
        requestedBy: null, decidedBy: null, decidedAt: null, confirmedAt: null,
        withdrawnAt: null, withdrawalReason: null, draftTeamId: team.id,
      });
    }
    return HttpResponse.json(teamDetail(team));
  }),

  http.delete(`${API}/tournaments/:tournamentId/draft-teams/:teamId`, async ({ params }) => {
    await simulateLatency();
    const team = findTeam(Number(params.tournamentId), Number(params.teamId));
    if (team) team.status = 'DISBANDED';
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
