import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClubProfile } from '../../../components/discovery/clubDirectoryTypes';
import type { Participant } from '../../admissions/types';
import { setFollowing } from '../../actions/follow';
import { FollowButton } from '../../actions/FollowButton';
import type { ClubMembershipContext } from '../../clubs/domain';
import { ClubRow } from '../cards/ClubRow';
import { ProgrammesSection } from '../peek/club/ClubSections';
import type { PaneClub } from '../peek/club/clubPane';
import { forgetClubChanges } from '../cards/clubState';
import { useClubActions } from '../cards/useClubActions';
import { WorldSessionContext } from '../worldSession';

const auth = vi.hoisted(() => ({ status: 'authenticated' as string }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ status: auth.status, sessionId: 'world', user: { id: 1 } }) }));
vi.mock('../../actions/follow', () => ({ setFollowing: vi.fn() }));
/** The rule-checker is not asked here: each screen's own flag decides (as with an older server). */
vi.mock('../../../hooks/useCan', () => ({ useCan: () => ({ pending: false, decide: (_action: string, fallback: boolean) => ({ allowed: fallback }), admin: null }) }));
/** The squads the person may arrange matches for (`GET /match-exchange/squads`): none unless a test says so. */
const arranging = vi.hoisted(() => ({ squads: [] as { id: number; club_id: number; name: string; category: string; club_name: string }[] | undefined }));
vi.mock('../compose/useArrangeableSquads', () => ({ useArrangeableSquads: () => arranging.squads }));

const year = new Date().getFullYear();
const nino: Participant = { id: 501, name: 'Nino Beridze', dateOfBirth: `${year - 9}-01-10`, minor: true, guardian: true, provenance: null, gender: 'FEMALE' };
const programme = (id: number, name: string, ageMin: number | null, ageMax: number | null) => ({
    id, name, ageMin, ageMax, sessionsPerWeek: 2, priceType: 'FIXED' as const, amount: '80', currency: 'GEL', billingPeriod: 'MONTH' as const,
    trialAmount: null, joiningFee: null, equipmentFee: null, details: null, published: true, squadIds: [], validFrom: null, validUntil: null,
});
const club = (overrides: Partial<ClubProfile> = {}): ClubProfile => ({
    id: 4, name: 'Saburtalo Youth', description: 'Youth club', type: 'ACADEMY', isOfficial: true, followerCount: 10, memberCount: 30, isFollowedByMe: false,
    cityName: 'Tbilisi', playerJoinPolicy: 'OPEN_TRIAL', relationshipState: null, isMember: false,
    presentation: { profileKind: 'ACADEMY', revision: 1, canEdit: false, programmes: [programme(71, 'Seniors', 18, null), programme(72, 'Little kickers', 6, 10)], sponsors: [], affiliations: [] },
    ...overrides,
});
const noClub = { hasClubMembership: false } as ClubMembershipContext;

function Where() {
    const location = useLocation();
    return <output data-testid="where">{location.pathname}{location.search}</output>;
}
/** What World shows about a club wherever it is (its row, its pane): Follow and where the person stands. */
function ClubActionsView({ club }: { club: ClubProfile }) {
    const actions = useClubActions(club);
    return <>
        <FollowButton subject={{ kind: 'club', id: club.id }} following={actions.following} size="sm" onChange={actions.setFollowing} />
        {actions.standing && <span>{actions.standing.label}</span>}
    </>;
}
/** The club's actions on their own, or (`row`) the club as a row in a list. */
function show(profile: ClubProfile, { membership = noClub, participants = [] as Participant[], path = '/world/clubs', row = false } = {}) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <WorldSessionContext.Provider value={{ membership, participants }}>
                <Routes><Route path="/world/clubs" element={row ? <ul><ClubRow club={profile} /></ul> : <ClubActionsView club={profile} />} /><Route path="*" element={<Where />} /></Routes>
            </WorldSessionContext.Provider>
        </MemoryRouter>,
    );
}

beforeEach(() => {
    vi.clearAllMocks();
    auth.status = 'authenticated';
    arranging.squads = [];
    sessionStorage.clear();
    forgetClubChanges();
});

describe('following', () => {
    it('follows at once and keeps the change when the club confirms it', async () => {
        vi.mocked(setFollowing).mockResolvedValue(true);
        show(club());
        fireEvent.click(screen.getByRole('button', { name: 'Follow' }));
        expect(screen.getByRole('button', { name: 'Following' })).toHaveAttribute('aria-pressed', 'true');
        await waitFor(() => expect(setFollowing).toHaveBeenCalledWith({ kind: 'club', id: 4 }, true, 'world'));
        expect(screen.getByRole('button', { name: 'Following' })).toBeInTheDocument();
    });

    it('puts the button back when following fails', async () => {
        vi.mocked(setFollowing).mockRejectedValue(new Error('offline'));
        show(club());
        fireEvent.click(screen.getByRole('button', { name: 'Follow' }));
        await waitFor(() => expect(screen.getByRole('button', { name: 'Follow' })).toHaveAttribute('aria-pressed', 'false'));
        expect(screen.getByRole('button', { name: 'Follow' })).not.toBeDisabled();
    });

    it('sends a guest to sign in instead', () => {
        auth.status = 'anonymous';
        show(club());
        fireEvent.click(screen.getByRole('link', { name: 'Follow' }));
        expect(screen.getByTestId('where').textContent).toMatch(/^\/login/);
        expect(setFollowing).not.toHaveBeenCalled();
    });
});

/** The steps that belong on the club page and must never show in World's list (the owner, 2 November 2026). */
const STEPS = /Join as trialist|Apply as player|Ask about|Arrange a match|Ask .* about a place/;
const forty = { hasClubMembership: false } as ClubMembershipContext;
const admin = { hasClubMembership: true, clubId: 1, myRole: 'CLUB_ADMIN' } as ClubMembershipContext;
const dinamo = { id: 103, club_id: 1, name: 'U14 Boys', category: 'U14', club_name: 'Dinamo' };

describe('World shows a club the same for everyone', () => {
    it('a row offers Follow only, for someone with no club, a club administrator who arranges matches, and a parent searching for a child', () => {
        const cases: { membership: ClubMembershipContext; participants?: Participant[]; path?: string; squads?: typeof arranging.squads }[] = [
            { membership: forty },
            { membership: admin, squads: [dinamo] },
            { membership: noClub, participants: [nino], path: '/world/clubs?player=501' },
        ];
        for (const { membership, participants = [], path, squads = [] } of cases) {
            arranging.squads = squads;
            show(club({ playerJoinPolicy: 'APPLICATION_REQUIRED' }), { membership, participants, path, row: true });
            const row = screen.getByRole('listitem');
            expect(within(row).getAllByRole('button').map(button => button.textContent)).toEqual(['Follow', '']);
            expect(within(row).queryByText(STEPS)).not.toBeInTheDocument();
            expect(within(row).queryByRole('link', { name: STEPS })).not.toBeInTheDocument();
            cleanup();
        }
    });

    it('says nothing about how the club takes players, only where the person stands', () => {
        show(club({ playerJoinPolicy: 'OPEN_TRIAL' }), { row: true });
        expect(screen.queryByText('Open trials')).not.toBeInTheDocument();
        cleanup();
        show(club({ relationshipState: 'APPLIED' }), { row: true });
        expect(screen.getByText('Application pending')).toBeInTheDocument();
    });

    it('opens the club page from its name and from its crest', () => {
        show(club(), { row: true });
        expect(screen.getByRole('link', { name: 'Saburtalo Youth' })).toHaveAttribute('href', '/clubs/4');
        expect(document.querySelector('a.gk-result__lead')).toHaveAttribute('href', '/clubs/4');
    });
});

describe('a parent searching for a child', () => {
    it('S14: discovery rows and the club pane use the accepted programme name with birth years', () => {
        const profile = club({ presentation: { ...club().presentation!, programmes: [programme(72, 'Foundation (U8–U10)', 8, 10)] } });
        const row = show(profile, { participants: [nino], path: '/world/clubs?player=501', row: true });
        expect(screen.getByText(`Fits Nino: Foundation · Born ${year - 10}–${year - 8}`)).toBeInTheDocument();
        expect(screen.queryByText(/U8/)).not.toBeInTheDocument();
        row.unmount();
        const pane = render(<MemoryRouter><WorldSessionContext.Provider value={{ membership: noClub, participants: [nino] }}>
            <ProgrammesSection club={profile as unknown as PaneClub} child={nino} link={() => '/clubs/4?programme=72'} />
        </WorldSessionContext.Provider></MemoryRouter>);
        expect(screen.getByRole('link', { name: 'Foundation' })).toBeInTheDocument();
        expect(screen.getByText(new RegExp(`Born ${year - 10}–${year - 8}`))).toBeInTheDocument();
        expect(screen.queryByText(/U8/)).not.toBeInTheDocument();
        pane.unmount();
        render(<MemoryRouter><WorldSessionContext.Provider value={{ membership: noClub, participants: [] }}>
            <ProgrammesSection club={profile as unknown as PaneClub} link={() => '/clubs/4?programme=72'} />
        </WorldSessionContext.Provider></MemoryRouter>);
        expect(screen.getByRole('link', { name: 'Foundation (U8–U10)' })).toBeInTheDocument();
    });
    it('tells the parent which programme fits the child, or that none does', () => {
        show(club(), { participants: [nino], path: '/world/clubs?player=501', row: true });
        expect(screen.getByText(/Fits Nino: Little kickers/)).toBeInTheDocument();
        cleanup();
        show(club({ presentation: { ...club().presentation!, programmes: [programme(71, 'Seniors', 18, null)] } }), { participants: [nino], path: '/world/clubs?player=501', row: true });
        expect(screen.getByText('No programme listed for age 9')).toBeInTheDocument();
    });

    it('remembers the child chosen on another World page', () => {
        sessionStorage.setItem('family-player:1:world', '501');
        show(club(), { participants: [nino], row: true });
        expect(screen.getByText(/Fits Nino/)).toBeInTheDocument();
    });
});
