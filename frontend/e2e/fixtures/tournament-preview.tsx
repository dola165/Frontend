import { createRoot } from 'react-dom/client';
import { Suspense, useEffect } from 'react';
import { MemoryRouter } from 'react-router-dom';
import axios, { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import type { TournamentDetail, TournamentEntryDto, TournamentFixtureDto, MyOrganization } from '../../src/features/tournaments/domain';
import '../../src/index.css';
import '../../src/styles/product-identity.css';

// Every Axios instance is created after this adapter is installed. No fixture
// request, including authentication utilities, can reach an application server.
const params = new URLSearchParams(location.search);
const view = params.get('view') ?? 'workspace';
const requests: { method: string; path: string }[] = [];
const unexpected: string[] = [];
const failures: { method: string; path: string; message: string; status: number }[] = [];
let nextId = 1000;
const organizations: MyOrganization[] = [
    { id: 21, slug: 'horizon-health', displayName: 'Horizon Health', membershipRole: 'OWNER', kinds: ['HEALTHCARE'], primaryKind: 'HEALTHCARE', clubBacked: false, canCreateTournament: true },
    { id: 22, slug: 'greenline-sports', displayName: 'Greenline Sports', membershipRole: 'ADMIN', kinds: ['COMPANY'], primaryKind: 'COMPANY', clubBacked: false, canCreateTournament: true },
];
const team = (id: number, name: string, guest = false): TournamentEntryDto => ({
    id, clubId: guest ? null : id + 200, clubName: guest ? null : name, squadId: null, squadName: null,
    userId: null, displayName: name, status: 'ACTIVE', seed: id, requestedBy: null, decidedBy: null,
    decidedAt: null, confirmedAt: null, withdrawnAt: null, withdrawalReason: null, draftTeamId: null,
});
const makeFixture = (id: number, roundNumber: number, fixtureOrder: number, stageId = 71): TournamentFixtureDto => ({
    id, stageId, stageName: 'Championship', homeEntryId: null, homeLabel: null, awayEntryId: null, awayLabel: null,
    winnerEntryId: null, homeScore: null, awayScore: null, roundNumber, fixtureOrder,
    scheduledAt: null, locationId: null, status: 'SCHEDULED', linkedMatchId: null,
});
let tournament: TournamentDetail = {
    id: 42, name: 'Horizon Community Cup', description: 'A weekend of football for our community. Local clubs and workplace teams come together to support a healthier, more active Tbilisi.',
    rules: 'Seven-a-side football. Matches are two halves of 20 minutes. Drawn knockout matches go directly to penalties. Arrive 30 minutes before kickoff.',
    status: params.get('results') === '1' || params.get('active') === '1' ? 'ACTIVE' : 'PLANNING', organizerOrganizationId: 21, organizerName: 'Horizon Health', hostClubId: null, hostClubName: null,
    participantScope: 'CLUB', visibility: 'PUBLIC', registrationPolicy: 'APPROVAL_ONLY', startDate: '2026-10-17T09:00:00', endDate: '2026-10-18T19:00:00',
    registrationOpensAt: '2026-09-15T09:00:00', registrationClosesAt: '2026-10-15T19:00:00', incentives: 'Community Cup trophy, team medals and a donation to local youth football.',
    staffAssignments: [{ id: 1, userId: 901, fullName: 'Nino Beridze', role: 'ADMIN', status: 'ACTIVE', assignedBy: 901, createdAt: '2026-09-15T09:00:00' }],
    entries: [team(1, 'Saburtalo United'), team(2, 'Riverbank FC'), team(3, 'Vake Athletic'), team(4, 'Horizon Medics', true), team(5, 'Dighomi Rangers'), team(6, 'Greenline XI', true), { ...team(7, 'Old Tbilisi FC'), status: 'PENDING' }],
    stages: [{ id: 71, parentStageId: null, name: 'Championship', stageType: 'KNOCKOUT', stageOrder: 1, status: 'PLANNING', advanceCount: null }],
    fixtures: [makeFixture(101, 1, 1), makeFixture(102, 1, 2), makeFixture(103, 1, 3), makeFixture(104, 1, 4), makeFixture(105, 2, 1), makeFixture(106, 2, 2), makeFixture(107, 3, 1)],
};
const setSlot = (fixture: TournamentFixtureDto, slot: 'HOME' | 'AWAY', entryId: number | null) => {
    const name = tournament.entries.find(entry => entry.id === entryId)?.displayName ?? null;
    if (slot === 'HOME') { fixture.homeEntryId = entryId; fixture.homeLabel = name; }
    else { fixture.awayEntryId = entryId; fixture.awayLabel = name; }
};
setSlot(tournament.fixtures[0], 'HOME', 1); setSlot(tournament.fixtures[0], 'AWAY', 2);
setSlot(tournament.fixtures[1], 'HOME', 3); setSlot(tournament.fixtures[1], 'AWAY', 4);
tournament.fixtures[0].scheduledAt = '2026-10-17T10:00:00';
tournament.fixtures[1].scheduledAt = '2026-10-17T11:00:00';
if (params.get('active') === '1' || params.get('filled') === '1') {
    tournament.entries.push(team(8, 'Avlabari Friends', true), team(9, 'Mtatsminda FC'));
    setSlot(tournament.fixtures[2], 'HOME', 5); setSlot(tournament.fixtures[2], 'AWAY', 6);
    setSlot(tournament.fixtures[3], 'HOME', 8); setSlot(tournament.fixtures[3], 'AWAY', 9);
    if (params.get('active') === '1') tournament.stages[0].status = 'ACTIVE';
}
if (params.get('empty') === '1') { tournament.stages = []; tournament.fixtures = []; }
if (params.get('results') === '1') {
    Object.assign(tournament.fixtures[0], { status: 'COMPLETED', homeScore: 2, awayScore: 1, winnerEntryId: 1 });
    tournament.entries[1].status = 'ELIMINATED';
    setSlot(tournament.fixtures[4], 'HOME', 1);
}
if (params.get('groups') === '1') tournament.stages.push({ id: 72, parentStageId: null, name: 'Group A', stageType: 'GROUP', stageOrder: 0, status: 'COMPLETED', advanceCount: 2 });
if (params.get('legacy') === '1') {
    tournament.stages = ['Quarter Finals', 'Semi Finals', 'Final'].map((name, index) => ({ id: 71 + index, parentStageId: null, name, stageType: 'KNOCKOUT', stageOrder: index + 1, status: 'PLANNING', advanceCount: null }));
    tournament.fixtures = [
        { ...tournament.fixtures[0], roundNumber: null, stageName: 'Quarter Finals' },
        { ...tournament.fixtures[1], roundNumber: null, stageName: 'Quarter Finals' },
        { ...makeFixture(105, 1, 1, 72), roundNumber: null, stageName: 'Semi Finals' },
        { ...makeFixture(107, 1, 1, 73), roundNumber: null, stageName: 'Final' },
    ];
}
const ok = (config: InternalAxiosRequestConfig, data: unknown): AxiosResponse => ({ config, data: structuredClone(data), status: 200, statusText: 'OK', headers: {} });
const fail = (config: InternalAxiosRequestConfig, message: string, status = 400): never => { throw new AxiosError(message, 'ERR_PREVIEW', config, undefined, { ...ok(config, { message }), status }); };
axios.defaults.adapter = async (config) => {
    const path = new URL(config.url ?? '', location.origin).pathname.replace(/^\/api(?=\/)/, '');
    const method = (config.method ?? 'get').toUpperCase();
    const data = typeof config.data === 'string' ? JSON.parse(config.data) : config.data ?? {};
    requests.push({ method, path });
    const failureIndex = failures.findIndex(failure => failure.method === method && failure.path === path);
    if (failureIndex >= 0) {
        const [failure] = failures.splice(failureIndex, 1);
        return fail(config, failure.message, failure.status);
    }
    if (path === '/auth/csrf') return ok(config, { headerName: 'X-XSRF-TOKEN', token: 'fixture-only' });
    if (path === '/users/me') return ok(config, { id: 901, username: 'nino.preview', fullName: 'Nino Beridze', role: 'ORGANIZER', profileComplete: true, emailVerified: true });
    if (path === '/clubs/my-membership-context') return ok(config, { hasClubMembership: false, clubId: null, clubName: null, myRole: null, canCreateClub: true });
    if (path === '/notifications/unread-count') return ok(config, { unreadCount: 0 });
    if (path === '/notifications') return ok(config, { content: [], pageNumber: 0, pageSize: 7, totalElements: 0 });
    if (path === '/organizations/mine') return ok(config, organizations);
    if (/^\/organizations\/\d+\/tournament-host-clubs$/.test(path)) return ok(config, []);
    if (path === '/organizations' && method === 'POST') { const org = { ...organizations[0], id: ++nextId, displayName: data.displayName, kinds: [data.kind], primaryKind: data.kind }; organizations.push(org); return ok(config, org); }
    if (path === '/clubs/my-club') return ok(config, null);
    if (path === '/clubs/search') return ok(config, [{ id: 888, name: 'Mtatsminda FC', logoUrl: null, memberCount: 22, cityName: 'Tbilisi', countryName: 'Georgia' }]);
    if (/^\/clubs\/\d+\/squads$/.test(path)) return ok(config, []);
    if (path === '/tournaments' && method === 'POST') {
        tournament = { ...tournament, ...data, id: ++nextId, organizerName: organizations.find(org => org.id === data.organizerOrganizationId)?.displayName ?? 'Horizon Health', entries: [], stages: [], fixtures: [], status: 'PLANNING' };
        return ok(config, tournament);
    }
    if (/^\/tournaments\/\d+$/.test(path)) {
        if (method === 'PATCH') {
            Object.assign(tournament, data);
            if (data.clearRegistrationOpensAt) tournament.registrationOpensAt = null;
            if (data.clearRegistrationClosesAt) tournament.registrationClosesAt = null;
            for (const field of ['description', 'rules', 'incentives', 'bannerImageUrl'] as const) if (data[field] === '') tournament[field] = null;
        }
        return ok(config, tournament);
    }
    if (/\/guest-entries$/.test(path) && method === 'POST') { tournament.entries.push(team(++nextId, data.name, true)); return ok(config, tournament); }
    if (/\/place-entry$/.test(path) && method === 'POST') {
        const fixtureId = Number(path.split('/')[4]);
        const target = tournament.fixtures.find(fixture => fixture.id === fixtureId);
        if (!target) return fail(config, 'Match was not found.');
        const replaced = data.slot === 'HOME' ? target.homeEntryId : target.awayEntryId;
        const source = tournament.fixtures.find(fixture => fixture.stageId === target.stageId && fixture.roundNumber === target.roundNumber && (fixture.homeEntryId === data.entryId || fixture.awayEntryId === data.entryId));
        if (source) setSlot(source, source.homeEntryId === data.entryId ? 'HOME' : 'AWAY', replaced);
        setSlot(target, data.slot, data.entryId); return ok(config, tournament);
    }
    if (/\/unplace-entry$/.test(path) && method === 'POST') {
        const target = tournament.fixtures.find(fixture => fixture.id === Number(path.split('/')[4]));
        if (!target) return fail(config, 'Match was not found.');
        setSlot(target, data.slot, null); return ok(config, tournament);
    }
    if (/\/stages$/.test(path) && method === 'POST') {
        const stageId = ++nextId;
        tournament.stages.push({ ...data, id: stageId, parentStageId: null, status: 'PLANNING', advanceCount: data.advanceCount ?? null });
        if (data.bracketSize) for (let round = 1, count = data.bracketSize / 2; count >= 1; round++, count /= 2) for (let index = 1; index <= count; index++) tournament.fixtures.push(makeFixture(++nextId, round, index, stageId));
        return ok(config, tournament);
    }
    if (/\/fixtures\/\d+\/(complete|scores|schedule|participants|cancel|reopen)$/.test(path)) {
        const fixture = tournament.fixtures.find(item => item.id === Number(path.split('/')[4]));
        if (!fixture) return fail(config, 'Match was not found.');
        const action = path.split('/').at(-1);
        if (action === 'cancel') fixture.status = 'CANCELLED';
        else if (action === 'reopen') fixture.status = 'SCHEDULED';
        else {
            Object.assign(fixture, data);
            if (action === 'participants') { setSlot(fixture, 'HOME', data.homeEntryId ?? null); setSlot(fixture, 'AWAY', data.awayEntryId ?? null); }
            if (action === 'complete') {
                fixture.status = 'COMPLETED';
                const next = tournament.fixtures.find(item => item.stageId === fixture.stageId && item.roundNumber === (fixture.roundNumber ?? 1) + 1 && item.fixtureOrder === Math.ceil((fixture.fixtureOrder ?? 1) / 2));
                if (next && fixture.winnerEntryId != null) setSlot(next, (fixture.fixtureOrder ?? 1) % 2 ? 'HOME' : 'AWAY', fixture.winnerEntryId);
            }
        }
        return ok(config, tournament);
    }
    if (/\/entries\/\d+\/status$/.test(path)) { const entry = tournament.entries.find(item => item.id === Number(path.split('/')[4])); if (entry) entry.status = data.status; return ok(config, tournament); }
    if (/\/entries\/\d+$/.test(path) && method === 'DELETE') { tournament.entries = tournament.entries.filter(item => item.id !== Number(path.split('/')[4])); return ok(config, null); }
    if (/\/invitations$/.test(path)) return ok(config, method === 'GET' ? [] : { id: ++nextId, ...data, clubName: 'Mtatsminda FC', status: 'PENDING', createdAt: new Date().toISOString() });
    if (/\/draft-teams$/.test(path) || /\/player-queue$/.test(path)) return ok(config, []);
    if (/\/standings$/.test(path)) return ok(config, tournament.entries.slice(0, 4).map((entry, index) => ({ entryId: entry.id, entryName: entry.displayName, entryType: entry.clubId ? 'CLUB' : 'DRAFT_TEAM', played: 3, won: 3 - index, drawn: 0, lost: index, goalsFor: 8 - index * 2, goalsAgainst: index * 2, goalDifference: 8 - index * 4, points: (3 - index) * 3 })));
    if (/\/start$/.test(path)) { tournament.status = 'ACTIVE'; return ok(config, tournament); }
    if (/\/complete$/.test(path)) { tournament.status = 'COMPLETED'; return ok(config, tournament); }
    unexpected.push(`${method} ${path}`); return fail(config, `Unhandled preview request: ${method} ${path}`);
};
(window as unknown as { tournamentPreview: unknown }).tournamentPreview = {
    requests, unexpected, snapshot: () => structuredClone(tournament),
    replaceTournament: (detail: TournamentDetail) => { tournament = structuredClone(detail); },
    failNext: (method: string, path: string, message = 'Could not save. Please try again.', status = 503) => failures.push({ method, path, message, status }),
};

async function bootstrap() {
    const [{ AuthProvider }, { MainLayout }, { AuthSessionBoundary }, { default: i18n }, auth] = await Promise.all([
        import('../../src/context/AuthContext'), import('../../src/App'), import('../../src/context/AuthSessionBoundary'),
        import('../../src/i18n'), import('../../src/utils/authStorage'),
    ]);
    await i18n.changeLanguage(params.get('lang') ?? 'en');
    if (view === 'public') auth.clearStoredAuth(); else auth.setStoredAccessToken('preview.fixture-only.unsigned');
    localStorage.setItem('theme-preference', params.get('theme') === 'light' ? 'light' : 'dark');
    document.documentElement.classList.toggle('dark', params.get('theme') !== 'light');
    document.documentElement.lang = params.get('lang') ?? 'en';
    function Preview() {
        useEffect(() => {
            if (params.get('tab') !== 'bracket') return;
            const selectBracket = () => {
                const buttons = document.querySelectorAll<HTMLButtonElement>('.tw-workspace nav.tw-tabs button');
                const target = [...buttons].find(button => button.textContent?.trim() === (i18n.language.startsWith('ka') ? 'ბადე' : 'Bracket'));
                if (!target) return false;
                target.click();
                return true;
            };
            if (selectBracket()) return;
            const observer = new MutationObserver(() => { if (selectBracket()) observer.disconnect(); });
            observer.observe(document.getElementById('root')!, { childList: true, subtree: true });
            return () => observer.disconnect();
        }, []);
        return <Suspense fallback={<p>Loading preview…</p>}><AuthSessionBoundary><MainLayout /></AuthSessionBoundary></Suspense>;
    }
    const initial = view === 'setup' ? '/tournaments/setup' : view === 'public' ? '/tournaments/42' : '/tournaments/42/workspace';
    // The real App shell owns navigation, themes, layout and tournament routes.
    // MemoryRouter keeps fixture reloads isolated without copying product UI.
    createRoot(document.getElementById('root')!).render(<MemoryRouter initialEntries={[initial]}><AuthProvider><Preview /></AuthProvider></MemoryRouter>);
}
void bootstrap();
