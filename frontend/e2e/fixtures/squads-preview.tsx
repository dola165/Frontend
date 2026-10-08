import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { ArrowLeft, CreditCard, Shield, Users, Globe, Sun, Moon, LayoutDashboard, CalendarDays } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { apiClient } from '../../src/api/axiosConfig';
import { SquadsTab } from '../../src/components/workspace/tabs/SquadsTab';
import { PlayersTab } from '../../src/components/workspace/tabs/PlayersTab';
import { PlayerCardsTab } from '../../src/components/workspace/tabs/PlayerCardsTab';
import { TabTeams } from '../../src/components/club/tabs/TabTeams';
import { ClubSquadsContent } from '../../src/pages/ClubSquadsPage';
import type {
    ClubPlayerAffiliation,
    ClubManagementOverview,
    PlayerAffiliationStatus,
} from '../../src/features/clubs/domain';
import type { PlayerCard } from '../../src/features/clubs/api';
import type { SquadRosterGroup, SquadRosterPlayer } from '../../src/components/squads/SquadRosterTable';
import i18n from '../../src/i18n';
import '../../src/index.css';
import '../../src/styles/product-identity.css';
import './squads-preview.css';

// Real product components; requests and edits stay in this in-memory development fixture.
const params = new URLSearchParams(location.search);
if (params.has('lang')) void i18n.changeLanguage(params.get('lang')!);
const clubId = 71001;
const club = {
    id: clubId,
    name: 'FC Dinamo Tbilisi',
    type: 'PROFESSIONAL',
    addressText: 'Tbilisi, Georgia',
    isOfficial: true,
};
let squads = [
    { id: 71101, clubId, name: 'First Team', category: 'SENIOR', gender: 'MALE' },
    { id: 71102, clubId, name: 'U12 Mixed', category: 'U12', gender: 'MIXED' },
    { id: 71103, clubId, name: 'U14 Boys', category: 'U14', gender: 'MALE' },
    { id: 71104, clubId, name: 'U14 Girls', category: 'U14', gender: 'FEMALE' },
    { id: 71105, clubId, name: 'U16 Boys', category: 'U16', gender: 'MALE' },
    { id: 71106, clubId, name: 'U16 Girls', category: 'U16', gender: 'FEMALE' },
    { id: 71107, clubId, name: 'U18 Boys', category: 'U18', gender: 'MALE' },
    { id: 71108, clubId, name: 'Dinamo Youth A', category: 'U19', gender: 'MALE' },
];
const names = [
    'Mikheil Makatsaria',
    'Giorgi Loria',
    'Mate Gagvishvili',
    'Saba Khvadagiani',
    'Luka Kharabadze',
    'Davit Kobouri',
    'Giorgi Moistsrapishvili',
    'Anzor Mekvabishvili',
    'Nika Ninua',
    'Giorgi Kutsia',
    'Luka Gagnidze',
    'Otar Kiteishvili',
    'Davit Skhirtladze',
    'Giorgi Gabedava',
    'Vakhtang Salia',
    'Levan Osikmashvili',
    'Sandro Kalandadze',
    'Nika Tsintsadze',
    'Ana Giorgadze',
    'Mariam Beridze',
    'Luka Chikovani',
    'Saba Abashidze',
];
const roles = ['GOALKEEPER', 'CENTER_BACK', 'CENTRAL_MIDFIELDER', 'STRIKER'];
const groupNames = ['Goalkeepers', 'Defenders', 'Midfielders', 'Forwards'];
const roster = (offset = 0, count = 16): SquadRosterGroup[] =>
    groupNames.map((label, groupIndex) => ({
        label,
        players: Array.from({ length: count === 16 ? 4 : 2 }, (_, index) => {
            const n = (groupIndex * 4 + index + offset) % names.length;
            return {
                id: 72000 + n,
                number: groupIndex * 4 + index + 1,
                name: names[n],
                position: roles[groupIndex],
                squadRole: roles[groupIndex],
                age: offset ? 12 + (groupIndex % 3) : 20 + (n % 9),
                isRegistered: n !== 17,
                status: n === 17 ? 'TRIALIST' : 'ACTIVE',
                joinedAt: '2026-09-10T10:00:00Z',
            };
        }),
    }));
const rosters = new Map<number, SquadRosterGroup[]>(
    squads.map((s, i) => [s.id, roster(i === 0 ? 0 : 17, i === 0 ? 16 : 8)]),
);
let cards: PlayerCard[] = [
    {
        id: 73001,
        clubId,
        userId: 72017,
        fullName: 'Nika Tsintsadze',
        birthYear: 2014,
        position: 'GOALKEEPER',
        jerseyNumber: 12,
        parentEmail: 'nino@example.test',
        squadId: 71102,
        registered: false,
    },
    {
        id: 73002,
        clubId,
        userId: 72018,
        fullName: 'Ana Giorgadze',
        birthYear: 2013,
        position: 'CENTRAL_MIDFIELDER',
        jerseyNumber: 8,
        parentEmail: 'tamar@example.test',
        squadId: 71104,
        registered: false,
    },
    {
        id: 73003,
        clubId,
        userId: 72019,
        fullName: 'Mariam Beridze',
        birthYear: 2012,
        position: 'STRIKER',
        jerseyNumber: 9,
        parentEmail: 'dato@example.test',
        squadId: 71106,
        registered: true,
    },
];
let affiliations: ClubPlayerAffiliation[] = names.map((fullName, index) => ({
    userId: 72000 + index,
    fullName,
    username: fullName.toLowerCase().replace(' ', '.'),
    status: index >= 17 && index <= 20 ? 'TRIALIST' : index === 21 ? 'PAST' : 'ACTIVE',
    primary: true,
    joinedAt: '2026-09-10T10:00:00Z',
    position: roles[Math.floor(index / 4) % 4],
    jerseyNumber: index + 1,
    trialEndsOn: index >= 17 ? '2026-09-24' : null,
    requiresParentalConsent: index >= 17,
    parentEmail: index >= 17 ? 'parent@example.test' : null,
    parentalConsentStatus: index === 18 ? 'PENDING' : index >= 17 ? 'CONFIRMED' : 'NOT_REQUIRED',
}));
let nextId = 74000;
let requestCount = 0;
const ok = (config: InternalAxiosRequestConfig, data: unknown): AxiosResponse => ({
    config,
    data: structuredClone(data),
    status: 200,
    statusText: 'OK',
    headers: {},
});
const fail = (config: InternalAxiosRequestConfig, message: string): never => {
    throw new AxiosError(message, 'ERR_PREVIEW', config, undefined, { ...ok(config, { message }), status: 400 });
};
apiClient.defaults.adapter = async (config) => {
    requestCount += 1;
    (window as unknown as { previewRequests: number }).previewRequests = requestCount;
    const path = new URL(config.url ?? '', location.origin).pathname.replace(/^\/api(?=\/)/, '');
    const method = config.method?.toUpperCase() ?? 'GET';
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
    if (path === '/clubs/my-membership-context')
        return ok(config, { hasClubMembership: false, clubId: null, myRole: null });
    if (path === `/clubs/${clubId}`) return ok(config, club);
    if (path === `/clubs/${clubId}/players`) {
        const status = config.params?.status;
        const rows = affiliations.filter((p) => !status || p.status === status);
        const page = Number(config.params?.page ?? 0),
            size = Number(config.params?.size ?? 20);
        return ok(config, {
            content: rows.slice(page * size, (page + 1) * size),
            pageNumber: page,
            pageSize: size,
            totalElements: rows.length,
        });
    }
    if (path === `/clubs/${clubId}/squads`) {
        if (method === 'POST') {
            const s = { id: nextId++, clubId, ...body };
            squads.push(s);
            rosters.set(s.id, []);
            return ok(config, s);
        }
        return ok(config, squads);
    }
    const team = new RegExp(`^/clubs/${clubId}/squads/(\\d+)(?:/(.*))?$`).exec(path);
    if (team) {
        const squadId = Number(team[1]),
            suffix = team[2];
        if (!suffix && method === 'PATCH') {
            squads = squads.map((s) => (s.id === squadId ? { ...s, ...body } : s));
            return ok(config, {});
        }
        if (!suffix && method === 'DELETE') {
            if (rosters.get(squadId)?.some((g) => g.players.length))
                return fail(config, 'Remove the players before deleting this squad.');
            squads = squads.filter((s) => s.id !== squadId);
            rosters.delete(squadId);
            return ok(config, {});
        }
        if (suffix === 'roster') {
            // Optional inverted latency exercises stale roster responses.
            if (params.has('race')) await new Promise((resolve) => setTimeout(resolve, squadId === 71101 ? 450 : 30));
            return ok(config, rosters.get(squadId) ?? []);
        }
        const playerMatch = /^players\/(\d+)$/.exec(suffix ?? '');
        if (playerMatch) {
            const userId = Number(playerMatch[1]);
            rosters.set(
                squadId,
                (rosters.get(squadId) ?? []).map((g) => ({
                    ...g,
                    players:
                        method === 'DELETE'
                            ? g.players.filter((p) => p.id !== userId)
                            : g.players.map((p) =>
                                  p.id === userId ? { ...p, number: body.jerseyNumber, squadRole: body.squadRole } : p,
                              ),
                })),
            );
            return ok(config, {});
        }
        if (suffix === 'players' || suffix === 'players/batch') {
            const ids = suffix === 'players' ? [body.userId] : body.players.map((p: { userId: number }) => p.userId);
            const groups = rosters.get(squadId) ?? [];
            const additions: SquadRosterPlayer[] = ids.map((userId: number) => {
                const p = affiliations.find((p) => p.userId === userId)!;
                return {
                    id: userId,
                    name: p.fullName!,
                    position: p.position,
                    number: p.jerseyNumber,
                    isRegistered: true,
                    status: p.status,
                };
            });
            rosters.set(squadId, [...groups, { label: 'Other players', players: additions }]);
            return ok(config, {});
        }
    }
    if (path === `/clubs/${clubId}/player-cards`) {
        if (method === 'POST') {
            const card = { id: nextId++, userId: nextId++, clubId, registered: false, ...body };
            cards.push(card);
            if (card.squadId) {
                const groups = rosters.get(card.squadId) ?? [];
                rosters.set(card.squadId, [
                    ...groups,
                    {
                        label: 'New players',
                        players: [
                            {
                                id: card.userId,
                                name: card.fullName,
                                number: card.jerseyNumber,
                                position: card.position,
                                age: 2026 - card.birthYear,
                                isRegistered: false,
                            },
                        ],
                    },
                ]);
            }
            return ok(config, card);
        }
        return ok(config, cards);
    }
    const cardMatch = new RegExp(`^/clubs/${clubId}/player-cards/(\\d+)$`).exec(path);
    if (cardMatch) {
        const cardId = Number(cardMatch[1]);
        if (method === 'DELETE') cards = cards.filter((c) => c.id !== cardId);
        else cards = cards.map((c) => (c.id === cardId ? { ...c, ...body } : c));
        return ok(config, cards.find((c) => c.id === cardId) ?? {});
    }
    return fail(config, 'This action is not part of this local design preview.');
};
const overview: ClubManagementOverview = {
    currentUserRole: 'OWNER',
    assignableInviteRoles: [],
    assignableStaffRoles: [],
    activePlayerCount: 17,
    trialistCount: 4,
    overdueTrialistCount: 0,
    pendingTryoutCount: 0,
    members: [],
    pendingInvitations: [],
    pendingApplications: [],
};
export function PlayerPreview() {
    const [revision, setRevision] = useState(0);
    const [filter, setFilter] = useState<'ALL' | PlayerAffiliationStatus>('ALL');
    const [page, setPage] = useState(0);
    const navigate = useNavigate();
    const rows = affiliations.filter((p) => filter === 'ALL' || p.status === filter);
    const counts = Object.fromEntries(
        ['ALL', 'ACTIVE', 'TRIALIST', 'PAST', 'REMOVED'].map((status) => [
            status,
            affiliations.filter((p) => status === 'ALL' || p.status === status).length,
        ]),
    );
    const change = async (userId: number, status: PlayerAffiliationStatus) => {
        affiliations = affiliations.map((p) => (p.userId === userId ? { ...p, status } : p));
        setRevision(revision + 1);
    };
    return (
        <PlayersTab
            playerDirectory={{
                content: rows.slice(page * 20, page * 20 + 20),
                pageNumber: page,
                pageSize: 20,
                totalElements: rows.length,
            }}
            playerLoading={false}
            playerError={null}
            playerStatusFilter={filter}
            playerCounts={counts}
            pendingKey={null}
            canManagePlayerStatuses
            totalPlayerPages={Math.ceil(rows.length / 20)}
            onStatusFilterChange={(value) => {
                setFilter(value);
                setPage(0);
            }}
            onPlayerStatusChange={change}
            onPromotePlayer={(player) => void change(player.userId, 'ACTIVE')}
            onTrialEndsChange={async (userId, trialEndsOn) => {
                affiliations = affiliations.map((p) => (p.userId === userId ? { ...p, trialEndsOn } : p));
                setRevision(revision + 1);
            }}
            onRetry={() => {}}
            onPageChange={setPage}
            onMessagePlayer={() => toast('Messages are not sent from the design preview.')}
            onSendConsentEmail={async () => {
                toast('Preview only — no email sent.');
                return false;
            }}
            onTabChange={(tab) => navigate(`/workspace/${tab}`)}
        />
    );
}
export function Preview() {
    const [dark, setDark] = useState(params.get('theme') !== 'light');
    const path = useLocation().pathname;
    const isPublic = path.startsWith('/clubs');
    document.documentElement.classList.toggle('dark', dark);
    const navigation = [
        { id: 'squads', label: 'Squads', icon: Shield },
        { id: 'players', label: 'Players', icon: Users },
        { id: 'player-cards', label: 'Player cards', icon: CreditCard },
    ];
    return (
        <div
            className={`team-preview workspace-page-shell${dark ? '' : ' workspace-light'} ${isPublic ? 'club-page-shell' : ''}`}
        >
            <div className="tp-previewbar">
                <strong>GrassKickZ</strong>
                <span>Design preview · Changes stay in this tab</span>
                <button aria-label="Toggle theme" onClick={() => setDark(!dark)}>
                    {dark ? <Sun size={15} /> : <Moon size={15} />}
                </button>
            </div>
            <header className="tp-topnav">
                <img src="/brand/grasskickz-main.png" alt="GrassKickZ" style={{width:110,height:38,objectFit:"contain"}} />
                <span className="tp-global-search">Search people, clubs, events…</span>
                <span className="tp-owner">CO</span>
            </header>
            <nav className="tp-nav">
                <span>
                    <LayoutDashboard size={14} />
                    Home
                </span>
                <span>
                    <Globe size={14} />
                    Clubs
                </span>
                <span className="active">
                    <Shield size={14} />
                    My Club
                </span>
                <span>
                    <CalendarDays size={14} />
                    Schedule
                </span>
            </nav>
            <div className={`tp-layout ${isPublic ? 'is-public' : ''}`}>
                {!isPublic && (
                    <aside className="tp-sidebar">
                        <Link to={`/clubs/${clubId}`}>
                            <ArrowLeft size={14} />
                            Back to club
                        </Link>
                        <div className="tp-club">
                            <span>DT</span>
                            <div>
                                <strong>FC Dinamo Tbilisi</strong>
                                <small>Owner · Club workspace</small>
                            </div>
                        </div>
                        <p>Football & people</p>
                        {navigation.map(({ id, label, icon: Icon }) => (
                            <Link key={id} className={path.endsWith(id) ? 'active' : ''} to={`/workspace/${id}`}>
                                <Icon size={16} />
                                {label}
                            </Link>
                        ))}
                        <p>Public profile</p>
                        <Link to={`/clubs/${clubId}`}>
                            <Globe size={16} />
                            View club teams
                        </Link>
                    </aside>
                )}
                <main className="tp-main">
                    <Routes>
                        <Route
                            path="/workspace/squads"
                            element={
                                <SquadsTab
                                    clubId={clubId}
                                    overview={overview}
                                    setParentError={(message) => message && toast.error(message)}
                                    setParentSuccess={(message) => message && toast.success(message)}
                                />
                            }
                        />
                        <Route path="/workspace/players" element={<PlayerPreview />} />
                        <Route
                            path="/workspace/player-cards"
                            element={
                                <PlayerCardsTab
                                    clubId={clubId}
                                    setParentError={(message) => message && toast.error(message)}
                                    setParentSuccess={(message) => message && toast.success(message)}
                                />
                            }
                        />
                        <Route
                            path="/clubs/:id"
                            element={
                                <>
                                    <Link className="tp-back" to="/workspace/squads">
                                        <ArrowLeft size={15} />
                                        Back to workspace preview
                                    </Link>
                                    <div className="tp-public-hero">
                                        <span className="tp-crest">DT</span>
                                        <div>
                                            <span className="sd-eyebrow">Tbilisi · Since 1925</span>
                                            <h1>FC Dinamo Tbilisi</h1>
                                            <p>One club. Every generation.</p>
                                        </div>
                                    </div>
                                    <div className="tp-public-tabs">
                                        <span>Our club</span>
                                        <span>Management</span>
                                        <strong>Teams</strong>
                                        <span>Schedule</span>
                                        <span>Opportunities</span>
                                    </div>
                                    <TabTeams clubId={clubId} />
                                </>
                            }
                        />
                        <Route path="/clubs/:id/squads" element={<ClubSquadsContent isAuthenticated={false} sessionId="preview-public" />} />
                    </Routes>
                </main>
            </div>
            <Toaster theme={dark ? 'dark' : 'light'} />
        </div>
    );
}
const initial =
    params.get('view') === 'public'
        ? `/clubs/${clubId}`
        : params.get('view') === 'roster'
          ? `/clubs/${clubId}/squads?squad=71101`
          : `/workspace/${params.get('view') ?? 'squads'}`;
createRoot(document.getElementById('root')!).render(
    <MemoryRouter initialEntries={[initial]}>
        <Preview />
    </MemoryRouter>,
);
