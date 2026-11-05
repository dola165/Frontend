import type { ImgHTMLAttributes } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FundraisingPage } from '../../../pages/FundraisingPage';
import { StartFundraiser } from '../PersonalFundraising';
import * as api from '../api';
import * as clubs from '../../clubs/api';

// Release 17 holds personal appeals back: the server lists `fundraising.personal` only while its switch is on.
const door = { id: 'fundraising.personal', context: { type: 'user', id: 10, label: 'My appeals' } };
const auth = vi.hoisted(() => ({ status: 'authenticated', isAuthenticated: true, sessionId: 'appeals-session', user: { id: 10, navigationCapabilities: { version: 1, workspaces: [] as unknown[] } } }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../api', async original => ({ ...await original<typeof import('../api')>(), fetchFundraisingFront: vi.fn(), fetchPersonalCampaigns: vi.fn(), fetchFundraisingClubs: vi.fn() }));
vi.mock('../../clubs/api', async original => ({ ...await original<typeof import('../../clubs/api')>(), fetchMyClubMembershipContext: vi.fn() }));
vi.mock('../../../api/axiosConfig', () => ({ DEPLOYMENT_URLS: { mediaBaseUrl: 'http://localhost:8080' }, apiClient: { get: vi.fn(async () => ({ data: [] })) } }));
vi.mock('../../../components/ui/MediaImage', () => ({ MediaImage: (props: ImgHTMLAttributes<HTMLImageElement>) => <img {...props} /> }));

const campaign: api.Campaign = { id: 1, clubId: 10, clubName: 'Alpha FC', country: 'Georgia', city: 'Tbilisi', title: 'A pitch for everyone', summary: 'Bring youth football home', description: 'Create a safe place to play.', beneficiary: 'Youth teams', useOfFunds: 'Surface', category: 'FACILITIES', currency: 'GEL', goalAmount: 10000, reportedAmount: null, reportedNote: '', reportedAt: null, startsOn: null, endsOn: null, images: [], status: 'PUBLISHED', phase: 'ACTIVE', version: 2, updatedAt: '', publishedAt: '2026-09-20T10:00:00Z', updates: [] };
beforeEach(() => {
    vi.clearAllMocks(); sessionStorage.clear(); localStorage.clear();
    auth.user.navigationCapabilities.workspaces = [];
    localStorage.setItem('gk-session-id', auth.sessionId); localStorage.setItem('userId', '10');
    vi.mocked(api.fetchFundraisingFront).mockResolvedValue({ city: null, near: [campaign], closest: [], followed: [], fresh: [campaign], active: 1, raised: null });
    vi.mocked(api.fetchPersonalCampaigns).mockResolvedValue([]);
    vi.mocked(api.fetchFundraisingClubs).mockResolvedValue([{ id: 10, name: 'Alpha FC' }]);
    vi.mocked(clubs.fetchMyClubMembershipContext).mockResolvedValue({ hasClubMembership: true, canCreateClub: false, clubId: 10, clubName: 'Alpha FC', myRole: 'OWNER' });
});

function Where() { const location = useLocation(); return <output aria-label="Address">{location.pathname + location.search}</output>; }
const fundraising = (address = '/campaigns') => render(<MemoryRouter initialEntries={[address]}><Routes><Route path="/campaigns" element={<><FundraisingPage /><Where /></>} /></Routes></MemoryRouter>);
const start = (address = '/campaigns/new') => render(<MemoryRouter initialEntries={[address]}><Routes><Route path="/campaigns/new" element={<><StartFundraiser /><Where /></>} /></Routes></MemoryRouter>);

describe('Personal appeals switched off (release 17 default)', () => {
    it('the fundraising page has no My appeals and speaks of clubs', async () => {
        fundraising();
        expect(await screen.findAllByRole('link', { name: 'Start a fundraiser' })).not.toHaveLength(0);
        expect(screen.getByText('Projects from clubs on GrassKickZ, backed by their supporters')).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'My appeals' })).not.toBeInTheDocument();
    });
    it('a My appeals link lands on the fundraising list and asks for no appeals', async () => {
        fundraising('/campaigns?mine=all');
        expect(await screen.findByRole('heading', { name: 'Fundraising', level: 1 })).toBeInTheDocument();
        expect(screen.getByRole('status', { name: 'Address' })).toHaveTextContent(/^\/campaigns$/);
        expect(api.fetchPersonalCampaigns).not.toHaveBeenCalled();
    });
    it('Start a fundraiser offers clubs only, and a For myself link lands on that choice', async () => {
        start();
        expect(await screen.findByRole('button', { name: 'Alpha FC' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'For myself' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'My appeals' })).not.toBeInTheDocument();
        start('/campaigns/new?for=me');
        await waitFor(() => expect(screen.getAllByRole('status', { name: 'Address' }).at(-1)).toHaveTextContent(/^\/campaigns\/new$/));
        expect(screen.queryByText(/An appeal for yourself/)).not.toBeInTheDocument();
    });
    it('a club’s appeal form keeps working without a My appeals link', async () => {
        start('/campaigns/new?club=10');
        expect(await screen.findByRole('button', { name: 'Save draft' })).toBeInTheDocument();
        expect(screen.getByText(/One appeal, linked to its project automatically/)).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'My appeals' })).not.toBeInTheDocument();
    });
});

describe('Personal appeals switched on', () => {
    beforeEach(() => { auth.user.navigationCapabilities.workspaces = [door]; });
    it('the fundraising page offers My appeals', async () => {
        fundraising();
        expect(await screen.findByRole('link', { name: 'My appeals' })).toHaveAttribute('href', '/campaigns?mine=all');
        expect(screen.getByText('Appeals from clubs and adults in grassroots football')).toBeInTheDocument();
    });
    it('My appeals opens the person’s appeals', async () => {
        fundraising('/campaigns?mine=all');
        expect(await screen.findByRole('heading', { name: 'My personal appeals' })).toBeInTheDocument();
        await waitFor(() => expect(api.fetchPersonalCampaigns).toHaveBeenCalled());
    });
    it('Start a fundraiser offers For myself and its form', async () => {
        start();
        expect(await screen.findByRole('button', { name: 'For myself' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'My appeals' })).toHaveAttribute('href', '/campaigns?mine=all');
        start('/campaigns/new?for=me');
        expect(await screen.findByText(/An appeal for yourself/)).toBeInTheDocument();
    });
});
