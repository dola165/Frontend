vi.mock('../../paymentPreview/config', () => ({ paymentPreviewEnabled: () => false }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ status: 'authenticated' }) }));
import type { ImgHTMLAttributes } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { FundraisingPage } from '../../../pages/FundraisingPage';
import { FundraisingCataloguePage } from '../../../pages/FundraisingCataloguePage';
import { ClubFundraisingPage } from '../../../pages/ClubFundraisingPage';
import { FundraiserPage } from '../../../pages/FundraiserPage';
import { activeFilters, fundraisingHeading, fundraisingPath, readFundraising } from '../query';
import * as api from '../api';
import * as clubs from '../../clubs/api';
vi.mock('../api', async original => ({ ...await original<typeof import('../api')>(), fetchCampaigns: vi.fn(), fetchCampaign: vi.fn(), fetchCampaignLocations: vi.fn(), fetchFundraisingFront: vi.fn() }));
vi.mock('../../clubs/api', async original => ({ ...await original<typeof import('../../clubs/api')>(), fetchMyClubMembershipContext: vi.fn() }));
vi.mock('../../../api/axiosConfig', () => ({ DEPLOYMENT_URLS: { mediaBaseUrl: 'http://localhost:8080' }, apiClient: { get: vi.fn(async () => ({ data: { id: 10, name: 'Alpha FC', myRole: 'OWNER' } })) } }));
vi.mock('../../../components/ui/MediaImage', () => ({ MediaImage: (props: ImgHTMLAttributes<HTMLImageElement>) => <img {...props} /> }));
const campaign: api.Campaign = { id: 1, clubId: 10, clubName: 'Alpha FC', country: 'Georgia', city: 'Tbilisi', title: 'A pitch for everyone', summary: 'Bring youth football home', description: 'Create a safe place to play.', beneficiary: 'Youth teams', useOfFunds: 'Surface and fencing', category: 'FACILITIES', currency: 'GEL', goalAmount: 10000, reportedAmount: 2500, reportedNote: 'Treasurer', reportedAt: '2026-10-01T10:00:00Z', startsOn: null, endsOn: null, images: ['/photo.svg'], status: 'PUBLISHED', phase: 'ACTIVE', version: 2, updatedAt: '', publishedAt: '2026-09-20T10:00:00Z', updates: [], donateUrl: 'https://www.gofundme.com/f/a-pitch', donations: 31 };
beforeEach(() => {
    vi.clearAllMocks(); sessionStorage.clear();
    vi.mocked(api.fetchCampaigns).mockResolvedValue({ content: [campaign], totalElements: 1 });
    vi.mocked(api.fetchCampaignLocations).mockResolvedValue([{ country: 'Georgia', city: 'Tbilisi' }, { country: 'France', city: 'Paris' }]);
    vi.mocked(api.fetchFundraisingFront).mockResolvedValue({ city: 'Tbilisi', near: [{ ...campaign, distanceKm: 3 }], closest: [campaign], followed: [], fresh: [campaign], active: 1, raised: 2500 });
    vi.mocked(clubs.fetchMyClubMembershipContext).mockResolvedValue({ hasClubMembership: true, canCreateClub: false, clubId: 10, clubName: 'Alpha FC', myRole: 'OWNER' });
});
afterEach(() => vi.unstubAllGlobals());

describe('The search in the address', () => {
    it('reads, writes and names a search', () => {
        const query = readFundraising(new URLSearchParams('category=TRAVEL&state=ENDED&sort=RAISED&page=1'));
        expect(query).toMatchObject({ category: 'TRAVEL', state: 'ENDED', sort: 'RAISED', page: 1 });
        expect(fundraisingPath(query)).toBe('/campaigns/all?category=TRAVEL&state=ENDED&sort=RAISED&page=1');
        expect(fundraisingHeading(query)).toEqual({ title: 'Travel & competitions', hint: 'Ended fundraisers' });
        expect(activeFilters(query, false).map(f => f.label)).toEqual(['Travel & competitions', 'Ended']);
        expect(readFundraising(new URLSearchParams('state=NOPE&category=NOPE'))).toMatchObject({ state: 'ACTIVE', category: '', sort: 'RELEVANCE' });
    });
});

describe('Progress', () => {
    it('keeps an unreported amount unknown, never zero raised', () => {
        expect(api.progressOf({ ...campaign, reportedAmount: null })).toMatchObject({ raised: null, percent: null, donations: null, reached: false });
        expect(api.progressOf({ ...campaign, reportedAmount: 0 })).toMatchObject({ raised: 0, percent: 0, donations: 31 });
    });
});

describe('Front, catalogue and the fundraiser', () => {
    it('shows the fundraisers near the person and opens the catalogue from every door', async () => {
        render(<MemoryRouter initialEntries={['/campaigns']}><Routes><Route path="/campaigns" element={<FundraisingPage />} /></Routes></MemoryRouter>);
        await waitFor(() => expect(screen.getAllByRole('link').find(link => link.getAttribute('href') === '/campaigns/1')).toHaveTextContent('Club · Tbilisi · 3 km'));
        expect(screen.getAllByRole('link', { name: 'Start a fundraiser' })[0]).toHaveAttribute('href', '/campaigns/new');
        expect(screen.getByRole('link', { name: 'Pitches & facilities' })).toHaveAttribute('href', '/campaigns/all?category=FACILITIES');
        expect(api.fetchFundraisingFront).toHaveBeenCalledWith('Tbilisi', expect.any(AbortSignal));
    });
    it('keeps the club, the search and the page in the request and in the address', async () => {
        vi.mocked(api.fetchCampaigns).mockResolvedValue({ content: [campaign], totalElements: 30 });
        render(<MemoryRouter initialEntries={['/clubs/10/campaigns?query=pitch&state=ALL']}><Routes><Route path="/clubs/:id/campaigns" element={<ClubFundraisingPage />} /></Routes></MemoryRouter>);
        expect(await screen.findByRole('heading', { name: 'Alpha FC fundraising' })).toBeInTheDocument();
        expect(api.fetchCampaigns).toHaveBeenCalledWith(expect.objectContaining({ clubId: 10, query: 'pitch', state: 'ALL', page: 0, size: 24, sort: 'RELEVANCE' }), expect.any(AbortSignal));
        expect(screen.getAllByRole('link').find(link => link.getAttribute('href') === '/campaigns/1')).toHaveTextContent('A pitch for everyone');
        fireEvent.click(screen.getAllByRole('button', { name: 'Next page' })[0]);
        await waitFor(() => expect(api.fetchCampaigns).toHaveBeenLastCalledWith(expect.objectContaining({ clubId: 10, page: 1 }), expect.any(AbortSignal)));
        expect(screen.getByRole('link', { name: 'Start a fundraiser' })).toHaveAttribute('href', '/projects?club=10&new=RAISE_MONEY');
    });
    it('clears a dependent city when the country changes', async () => {
        render(<MemoryRouter initialEntries={['/campaigns/all?country=Georgia&city=Tbilisi']}><Routes><Route path="/campaigns/all" element={<FundraisingCataloguePage />} /></Routes></MemoryRouter>);
        await screen.findByRole('option', { name: 'France' });
        fireEvent.change(screen.getAllByLabelText('Country')[0], { target: { value: 'France' } });
        await waitFor(() => expect(api.fetchCampaigns).toHaveBeenLastCalledWith(expect.objectContaining({ country: 'France', city: undefined }), expect.any(AbortSignal)));
    });
    it('sends supporters to GoFundMe and reports the amount as the club’s', async () => {
        vi.mocked(api.fetchCampaign).mockResolvedValue(campaign);
        render(<MemoryRouter initialEntries={['/campaigns/1']}><Routes><Route path="/campaigns/:id" element={<FundraiserPage />} /></Routes></MemoryRouter>);
        await screen.findByRole('heading', { name: campaign.title });
        expect(screen.getByRole('link', { name: 'Donate on GoFundMe' })).toHaveAttribute('href', 'https://www.gofundme.com/f/a-pitch');
        expect(screen.getByText(/Reported by the club · 31 donations/)).toBeInTheDocument();
        expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25');
        expect(screen.getByText(/reported by Alpha FC/)).toBeInTheDocument();
    });
    it('asks the club how to give when there is no GoFundMe page, and disables an ended fundraiser', async () => {
        vi.mocked(api.fetchCampaign).mockResolvedValue({ ...campaign, donateUrl: null });
        const view = render(<MemoryRouter initialEntries={['/campaigns/1']}><Routes><Route path="/campaigns/:id" element={<FundraiserPage />} /></Routes></MemoryRouter>);
        expect(await screen.findByRole('link', { name: 'Ask the club how to give' })).toHaveAttribute('href', '/clubs/10?tab=contact');
        view.unmount();
        vi.mocked(api.fetchCampaign).mockResolvedValue({ ...campaign, phase: 'ENDED', status: 'CLOSED' });
        render(<MemoryRouter initialEntries={['/campaigns/1']}><Routes><Route path="/campaigns/:id" element={<FundraiserPage />} /></Routes></MemoryRouter>);
        expect(await screen.findByRole('button', { name: 'Ended' })).toBeDisabled();
    });
});
