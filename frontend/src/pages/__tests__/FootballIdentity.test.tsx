import '../../i18n';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { apiClient } from '../../api/axiosConfig';
import { OrganizationProfilePage, OrganizationProfileEditor } from '../OrganizationProfilePage';
import type { OrganizationProfile } from '../../features/organizations/domain';

const account = vi.hoisted(() => ({ id: 17, sessionId: 'first-session' }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: account.id }, sessionId: account.sessionId, refreshNavigationCapabilities:()=>Promise.resolve() }) }));
vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), put: vi.fn() } }));

const venue: OrganizationProfile = {
    id: 12, displayName: 'Riverside pitches', description: 'Football beside the river', kinds: ['VENUE'], profileKind: 'VENUE',
    clubId: null, verificationStatus: 'UNVERIFIED', published: true, website: null, publicEmail: 'venue@example.com',
    publicPhone: null, addressText: 'Tbilisi', focus: 'Two floodlit pitches', canEdit: false, canCreateTournament: false,
};
const presentation=(profile:OrganizationProfile)=>({profile,competitions:[],canOpenWorkspace:profile.canEdit,membershipRole:'',portfolio:{venues:[]}});
const organizationPage = () => <MemoryRouter initialEntries={['/organizations/12']}><Routes>
    <Route path="/organizations/:organizationId" element={<OrganizationProfilePage />} />
    <Route path="/organizations/:organizationId/workspace" element={<OrganizationProfileEditor id="12"/>}/>
    <Route path="/clubs/:clubId" element={<h1>Club profile</h1>} />
    <Route path="/stadiums/:organizationId" element={<h1>Stadium profile</h1>} />
</Routes></MemoryRouter>;

beforeEach(() => {
    vi.resetAllMocks(); account.id = 17; account.sessionId = 'first-session';
});

it('shows venue organizations in the shared organization profile', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: presentation(venue) });
    render(organizationPage());
    expect(await screen.findByRole('heading', { name: 'Riverside pitches' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit profile' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /book/i })).not.toBeInTheDocument();
});

it('saves only editable organization information and surfaces permission revocation', async () => {
    vi.mocked(apiClient.get).mockImplementation(async url=>{const profile:OrganizationProfile={...venue,profileKind:'TOURNAMENT_ORGANIZER',kinds:['TOURNAMENT_ORGANIZER'],canEdit:true};return {data:String(url).endsWith('/presentation')?presentation(profile):profile};});
    vi.mocked(apiClient.put).mockRejectedValue({ response: { data: { error: 'Your organization access has ended.' } } });
    render(organizationPage());
    fireEvent.click(await screen.findByRole('link', { name: 'Edit profile' }));
    fireEvent.change(await screen.findByRole('textbox', { name: 'What we do' }), { target: { value: 'Three divisions' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    await screen.findByRole('alert');
    const payload = vi.mocked(apiClient.put).mock.calls[0][1] as Record<string, unknown>;
    expect(payload.focus).toBe('Three divisions');
    expect(payload).not.toHaveProperty('canEdit');
    expect(payload).not.toHaveProperty('profileKind');
    expect(payload).not.toHaveProperty('verificationStatus');
    expect(screen.getByRole('textbox', { name: 'What we do' })).toHaveValue('Three divisions');
});

it('gives tournament organizers their own presentation and authorized tournament action', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: presentation({...venue,kinds:['TOURNAMENT_ORGANIZER'],profileKind:'TOURNAMENT_ORGANIZER',canCreateTournament:true,capabilities:{enabledActivities:['PROFILE','TOURNAMENT'],revision:1,venueAvailable:false,canConfigureActivities:false,canEditProfile:false,canConfigureVenue:false,canManageVenueBookings:false,canCreateTournament:true,canInviteVenueOperator:false}}) });
    render(organizationPage());
    fireEvent.click(await screen.findByRole('tab', { name: 'Tournaments' }));
    expect(screen.getByRole('heading', { name: 'Tournaments' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create a tournament' })).toHaveAttribute('href', '/tournaments/setup?organizer=12');
    expect(screen.queryByRole('heading', { name: 'Facilities and playing spaces' })).not.toBeInTheDocument();
});

it('routes club-backed organizations to their existing club profile', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: presentation({...venue,clubId:42,profileKind:'CLUB'}) });
    render(organizationPage());
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Club profile' })).toBeInTheDocument());
});
