import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClubProfile } from '../../../components/discovery/clubDirectoryTypes';
import type { Participant } from '../../admissions/types';
import { createClubApplication, selfRegisterClubPlayer } from '../../clubs/api';
import type { ClubMembershipContext } from '../../clubs/domain';
import { toggleClubFollow } from '../api';
import { ClubCard } from '../cards/ClubCard';
import { WorldSessionContext } from '../worldSession';

const auth = vi.hoisted(() => ({ status: 'authenticated' as string }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ status: auth.status, sessionId: 'world', user: { id: 1 } }) }));
vi.mock('../api', () => ({ toggleClubFollow: vi.fn() }));
vi.mock('../../clubs/api', () => ({ createClubApplication: vi.fn(), selfRegisterClubPlayer: vi.fn() }));

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
function show(profile: ClubProfile, { membership = noClub, participants = [] as Participant[], path = '/world/clubs' } = {}) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <WorldSessionContext.Provider value={{ membership, participants }}>
                <Routes><Route path="/world/clubs" element={<ClubCard club={profile} />} /><Route path="*" element={<Where />} /></Routes>
            </WorldSessionContext.Provider>
        </MemoryRouter>,
    );
}

beforeEach(() => {
    vi.clearAllMocks();
    auth.status = 'authenticated';
    sessionStorage.clear();
});

describe('following', () => {
    it('follows at once and keeps the change when the club confirms it', async () => {
        vi.mocked(toggleClubFollow).mockResolvedValue(undefined);
        show(club());
        fireEvent.click(screen.getByRole('button', { name: 'Follow' }));
        expect(screen.getByRole('button', { name: 'Following' })).toHaveAttribute('aria-pressed', 'true');
        await waitFor(() => expect(toggleClubFollow).toHaveBeenCalledWith(4));
        expect(screen.getByRole('button', { name: 'Following' })).toBeInTheDocument();
    });

    it('puts the button back and says so when following fails', async () => {
        vi.mocked(toggleClubFollow).mockRejectedValue(new Error('offline'));
        show(club());
        fireEvent.click(screen.getByRole('button', { name: 'Follow' }));
        expect(await screen.findByRole('alert')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Follow' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('sends a guest to sign in instead', () => {
        auth.status = 'unauthenticated';
        show(club());
        fireEvent.click(screen.getByRole('button', { name: 'Follow' }));
        expect(screen.getByTestId('where').textContent).toMatch(/^\/login/);
        expect(toggleClubFollow).not.toHaveBeenCalled();
    });
});

describe('joining for yourself', () => {
    it('joins an open-trial club as a trialist when you have no club', async () => {
        vi.mocked(selfRegisterClubPlayer).mockResolvedValue({} as never);
        show(club());
        fireEvent.click(screen.getByRole('button', { name: 'Join as trialist' }));
        expect(await screen.findByText('You joined as a trialist.')).toBeInTheDocument();
        expect(screen.getByText('Trialist')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Join as trialist' })).not.toBeInTheDocument();
    });

    it('applies to a club that asks for applications', async () => {
        vi.mocked(createClubApplication).mockResolvedValue({} as never);
        show(club({ playerJoinPolicy: 'APPLICATION_REQUIRED' }));
        fireEvent.click(screen.getByRole('button', { name: 'Apply as player' }));
        await waitFor(() => expect(createClubApplication).toHaveBeenCalledWith(4, 'PLAYER', null));
        expect(await screen.findByText('Application pending')).toBeInTheDocument();
    });

    it('offers no one-click join to someone who already has a club, or while that is unknown', () => {
        show(club(), { membership: { hasClubMembership: true } as ClubMembershipContext });
        expect(screen.queryByRole('button', { name: 'Join as trialist' })).not.toBeInTheDocument();
    });
});

describe('a parent searching for a child', () => {
    it('asks the club about a place for the child, with the programme that fits, instead of joining the parent', () => {
        show(club(), { participants: [nino], path: '/world/clubs?player=501' });
        expect(screen.queryByRole('button', { name: 'Join as trialist' })).not.toBeInTheDocument();
        expect(screen.getByText('Fits Nino')).toBeInTheDocument();
        expect(screen.getByText(/Little kickers · Ages 6–10/)).toBeInTheDocument();
        expect(screen.queryByText(/Seniors/)).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Ask Saburtalo Youth about a place for Nino Beridze' })).toHaveAttribute('href', '/clubs/4?tab=teams&programme=72&enquire=1&player=501');
    });

    it('says when no programme fits the child, and still lets the parent ask', () => {
        show(club({ presentation: { ...club().presentation!, programmes: [programme(71, 'Seniors', 18, null)] } }), { participants: [nino], path: '/world/clubs?player=501' });
        expect(screen.getByText('No programme listed for age 9')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /about a place for Nino/ })).toHaveAttribute('href', '/clubs/4?tab=teams&enquire=1&player=501');
    });

    it('remembers the child chosen on another World page', () => {
        sessionStorage.setItem('family-player:1:world', '501');
        show(club(), { participants: [nino] });
        expect(screen.getByText('Fits Nino')).toBeInTheDocument();
    });

    it('asks about joining in general before a child is chosen', () => {
        show(club(), { participants: [nino] });
        expect(screen.getByRole('link', { name: 'Ask about joining' })).toHaveAttribute('href', '/clubs/4?tab=teams&enquire=1');
        expect(screen.queryByText(/Fits/)).not.toBeInTheDocument();
    });
});
