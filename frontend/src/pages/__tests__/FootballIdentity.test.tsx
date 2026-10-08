import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { apiClient } from '../../api/axiosConfig';
import { FootballRolesPage } from '../FootballRolesPage';
import { OrganizationProfilePage } from '../OrganizationProfilePage';
import { RoleProfileSummary } from '../../features/roles/RoleProfileSummary';
import type { RoleProfile } from '../../features/roles/domain';
import type { OrganizationProfile } from '../../features/organizations/domain';

const account = vi.hoisted(() => ({ id: 17, sessionId: 'first-session' }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: account.id }, sessionId: account.sessionId }) }));
vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), put: vi.fn() } }));

const fan: RoleProfile = { role: 'FAN', primary: true, published: false };
const venue: OrganizationProfile = {
    id: 12, displayName: 'Riverside pitches', description: 'Football beside the river', kinds: ['VENUE'], profileKind: 'VENUE',
    clubId: null, verificationStatus: 'UNVERIFIED', published: true, website: null, publicEmail: 'venue@example.com',
    publicPhone: null, addressText: 'Tbilisi', focus: 'Two floodlit pitches', canEdit: false, canCreateTournament: false,
};
const rolesPage = () => <MemoryRouter><FootballRolesPage /></MemoryRouter>;
const organizationPage = () => <MemoryRouter initialEntries={['/organizations/12']}><Routes>
    <Route path="/organizations/:organizationId" element={<OrganizationProfilePage />} />
    <Route path="/clubs/:clubId" element={<h1>Club profile</h1>} />
    <Route path="/stadiums/:organizationId" element={<h1>Stadium profile</h1>} />
</Routes></MemoryRouter>;

beforeEach(() => {
    vi.resetAllMocks(); account.id = 17; account.sessionId = 'first-session';
    vi.mocked(apiClient.get).mockResolvedValue({ data: [fan] });
    vi.mocked(apiClient.put).mockImplementation(async (_url, body) => ({ data: (body as { profiles: RoleProfile[] }).profiles }));
});

it('saves multiple roles with a single primary and deliberate publication, without changing login role', async () => {
    render(rolesPage());
    await screen.findByRole('button', { name: 'Save football roles' });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Coach' }));
    const coach = within(screen.getByRole('region', { name: 'Coach details' }));
    fireEvent.change(coach.getByRole('textbox', { name: 'Headline' }), { target: { value: 'Youth development coach' } });
    fireEvent.click(coach.getByRole('radio', { name: 'Primary profile role' }));
    fireEvent.click(coach.getByRole('checkbox', { name: 'Show on my public profile' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save football roles' }));
    await screen.findByRole('status');
    expect(apiClient.put).toHaveBeenCalledWith('/users/me/roles', { profiles: [
        { ...fan, primary: false }, { role: 'COACH', primary: true, published: true, headline: 'Youth development coach' },
    ] });
    expect(screen.getByText('Your football roles have been saved.')).toBeInTheDocument();
});

it('does not allow an empty editor to overwrite roles after a load failure', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Offline'));
    render(rolesPage());
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save football roles' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
});

it('keeps unsaved details after a server rejects the update', async () => {
    vi.mocked(apiClient.put).mockRejectedValue({ response: { data: { error: 'An adult account is required.' } } });
    render(rolesPage());
    await screen.findByRole('button', { name: 'Save football roles' });
    fireEvent.change(screen.getByRole('textbox', { name: 'Headline' }), { target: { value: 'Keep my draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save football roles' }));
    await screen.findByRole('alert');
    expect(screen.getByRole('textbox', { name: 'Headline' })).toHaveValue('Keep my draft');
    expect(screen.queryByText('Your football roles have been saved.')).not.toBeInTheDocument();
});

it('discards an earlier account response after the account changes', async () => {
    let finish: (value: { data: RoleProfile[] }) => void = () => undefined;
    vi.mocked(apiClient.get).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const view = render(rolesPage());
    account.id = 18; account.sessionId = 'second-session';
    vi.mocked(apiClient.get).mockResolvedValue({ data: [{ role: 'REFEREE', primary: true, published: false }] });
    view.rerender(rolesPage());
    await screen.findByRole('region', { name: 'Referee details' });
    await act(async () => { finish({ data: [{ role: 'COACH', primary: true, published: false, headline: 'Other account' }] }); });
    expect(screen.queryByRole('region', { name: 'Coach details' })).not.toBeInTheDocument();
});

it('routes venue organizations to their dedicated stadium profile', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: venue });
    render(organizationPage());
    expect(await screen.findByRole('heading', { name: 'Stadium profile' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit profile' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /book/i })).not.toBeInTheDocument();
});

it('saves only editable organization information and surfaces permission revocation', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { ...venue, profileKind: 'TOURNAMENT_ORGANIZER', kinds: ['TOURNAMENT_ORGANIZER'], canEdit: true } });
    vi.mocked(apiClient.put).mockRejectedValue({ response: { data: { error: 'Your organization access has ended.' } } });
    render(organizationPage());
    fireEvent.click(await screen.findByRole('button', { name: 'Edit profile' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Competitions and age groups' }), { target: { value: 'Three divisions' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    await screen.findByRole('alert');
    const payload = vi.mocked(apiClient.put).mock.calls[0][1] as Record<string, unknown>;
    expect(payload.focus).toBe('Three divisions');
    expect(payload).not.toHaveProperty('canEdit');
    expect(payload).not.toHaveProperty('profileKind');
    expect(payload).not.toHaveProperty('verificationStatus');
    expect(screen.getByRole('textbox', { name: 'Competitions and age groups' })).toHaveValue('Three divisions');
});

it('gives tournament organizers their own presentation and authorized tournament action', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { ...venue, kinds: ['TOURNAMENT_ORGANIZER'], profileKind: 'TOURNAMENT_ORGANIZER', canCreateTournament: true } });
    render(organizationPage());
    expect(await screen.findByRole('heading', { name: 'Competitions and age groups' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create a tournament' })).toHaveAttribute('href', '/tournaments/setup?organizer=12');
    expect(screen.queryByRole('heading', { name: 'Facilities and playing spaces' })).not.toBeInTheDocument();
});

it('routes club-backed organizations to their existing club profile', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { ...venue, clubId: 42, profileKind: 'CLUB' } });
    render(organizationPage());
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Club profile' })).toBeInTheDocument());
});

it('uses role-specific information and never presents self-reported qualifications as verified', () => {
    render(<RoleProfileSummary profiles={[{ role: 'REFEREE', primary: true, published: true, specialties: '7v7 and 11v11', qualifications: 'Local refereeing course' }]} />);
    expect(screen.getByText('Officiating formats')).toBeInTheDocument();
    expect(screen.getByText('Qualifications · self-reported')).toBeInTheDocument();
});
