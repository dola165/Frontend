import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '../../../i18n';
import { OrganizationActivitySettings } from './OrganizationActivitySettings';
import { OrganizationDelegationPanel, OrganizationInvitations } from './OrganizationDelegationPanel';
import * as api from './api';
vi.mock('../OrganizationPortfolio', () => ({ OrganizationPortfolio: () => <section>Venue portfolio mount</section> }));
import { OrganizationProfilePage } from '../../../pages/OrganizationProfilePage';
import { StadiumWorkspacePage } from '../../../pages/StadiumWorkspacePage';
import { apiClient } from '../../../api/axiosConfig';
import * as venueApi from '../../venues/api';

const auth = vi.hoisted(() => ({ sessionId: 'owner-session' }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('./api', () => ({ getActivities: vi.fn(), updateActivities: vi.fn(), getOperators: vi.fn(), inviteOperator: vi.fn(),
    cancelInvitation: vi.fn(), revokeOperator: vi.fn(), getInvitations: vi.fn(), respondToInvitation: vi.fn() }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), put: vi.fn() } }));
vi.mock('../../venues/api', () => ({ fetchVenue: vi.fn(), fetchVenueBookings: vi.fn(), createBooking: vi.fn() }));
vi.mock('../../venues/VenueEditors', () => ({ VenueListingEditor: () => <p>Configuration editor</p>, VenuePitchEditor: () => <p>Pitch editor</p> }));
vi.mock('../../venues/VenueBookings', () => ({ BookingRows: () => <p>Booking decisions</p> }));

const capabilities: api.OrganizationCapabilities = { enabledActivities: ['PROFILE', 'VENUE', 'TOURNAMENT'], revision: 4, venueAvailable: true,
    canConfigureActivities: true, canEditProfile: true, canConfigureVenue: true, canManageVenueBookings: true, canCreateTournament: true, canInviteVenueOperator: true };
const operatorCapabilities = { ...capabilities, canConfigureActivities: false, canEditProfile: false, canConfigureVenue: false, canCreateTournament: false, canInviteVenueOperator: false };
const invitation: api.OrganizationInvitation = { id: 8, organizationId: 17, organizationName: 'Community stadium', recipientName: 'Operator', status: 'PENDING', expiresAt: null, canRespond: true, canOpenVenue: false };
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; };
beforeEach(async () => {
    vi.resetAllMocks(); auth.sessionId = 'owner-session'; await i18n.changeLanguage('en');
    vi.mocked(api.getActivities).mockResolvedValue(capabilities);
    vi.mocked(api.getOperators).mockResolvedValue({ invitations: [], operators: [] });
    vi.mocked(api.getInvitations).mockResolvedValue([]);
    vi.mocked(venueApi.fetchVenueBookings).mockResolvedValue([]);
});
afterEach(cleanup);

it('preserves both activities and sends the current revision, then requires review after conflict', async () => {
    const user = userEvent.setup();
    vi.mocked(api.updateActivities).mockRejectedValue({ response: { status: 409 } });
    render(<OrganizationActivitySettings id={17} />);
    const venue = await screen.findByRole('checkbox', { name: 'Accept new venue reservations' });
    expect(venue).toBeChecked();
    await user.click(venue);
    await user.click(screen.getByRole('button', { name: 'Save activities' }));
    expect(api.updateActivities).toHaveBeenCalledWith(17, { revision: 4, venueEnabled: false, tournamentEnabled: true });
    expect(await screen.findByRole('alert')).toHaveTextContent('Reload to review');
    expect(venue).not.toBeChecked(); expect(venue).toBeDisabled();
    vi.mocked(api.getActivities).mockResolvedValue({ ...capabilities, revision: 5, enabledActivities: ['PROFILE'] });
    await user.click(screen.getByRole('button', { name: 'Reload' }));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Create new tournaments' })).not.toBeChecked());
});

it('does not turn operator membership into editable activity or pitch settings', async () => {
    vi.mocked(api.getActivities).mockResolvedValue(operatorCapabilities);
    render(<OrganizationActivitySettings id={17} />);
    expect(await screen.findByRole('checkbox', { name: 'Accept new venue reservations' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save activities' })).not.toBeInTheDocument();
});

it('drops an old account response and does not invoke its completion callback', async () => {
    const user = userEvent.setup(), pending = deferred<api.OrganizationCapabilities>(), onChanged = vi.fn();
    vi.mocked(api.updateActivities).mockReturnValue(pending.promise);
    const view = render(<OrganizationActivitySettings id={17} onChanged={onChanged} />);
    await user.click(await screen.findByRole('button', { name: 'Save activities' }));
    auth.sessionId = 'other-account';
    vi.mocked(api.getActivities).mockResolvedValue(operatorCapabilities);
    view.rerender(<OrganizationActivitySettings id={17} onChanged={onChanged} />);
    await act(async () => pending.resolve({ ...capabilities, revision: 5 }));
    expect(onChanged).not.toHaveBeenCalled();
    expect(screen.queryByText('Activities saved.')).not.toBeInTheDocument();
});

it('requires concrete revocation confirmation and clears privileged lists on authority loss', async () => {
    const user = userEvent.setup();
    vi.mocked(api.getOperators).mockResolvedValue({ invitations: [], operators: [{ membershipId: 9, userId: 8, name: 'Venue operator', status: 'ACTIVE', startedAt: '', endedAt: null }] });
    vi.mocked(api.revokeOperator).mockRejectedValue({ response: { status: 403 } });
    render(<OrganizationDelegationPanel id={17} />);
    await user.click(await screen.findByRole('button', { name: 'Revoke access' }));
    expect(api.revokeOperator).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Confirm revocation' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Access has changed');
    expect(screen.queryByText('Venue operator')).not.toBeInTheDocument();
});

it('provides recipient acceptance and only opens the venue after fresh authorization', async () => {
    const user = userEvent.setup();
    vi.mocked(api.getInvitations).mockResolvedValue([invitation]);
    render(<MemoryRouter><OrganizationInvitations /></MemoryRouter>);
    const accept = await screen.findByRole('button', { name: 'Accept venue role' });
    vi.mocked(api.getInvitations).mockResolvedValue([{ ...invitation, status: 'ACCEPTED', canRespond: false, canOpenVenue: true }]);
    await user.click(accept);
    expect(api.respondToInvitation).toHaveBeenCalledWith(8, 'ACCEPT');
    expect(await screen.findByRole('link', { name: 'Open venue workspace' })).toHaveAttribute('href', '/stadiums/17/manage');
});

it('does not expose acceptance or workspace access for revoked/expired invitations', async () => {
    vi.mocked(api.getInvitations).mockResolvedValue([{ ...invitation, status: 'EXPIRED', canRespond: false }, { ...invitation, id: 9, status: 'ACCEPTED', canRespond: false }]);
    render(<MemoryRouter><OrganizationInvitations /></MemoryRouter>);
    await screen.findByText('Expired');
    expect(screen.queryByRole('button', { name: 'Accept venue role' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open venue workspace' })).not.toBeInTheDocument();
});

it('renders Georgian activity controls and a successful save', async () => {
    const user = userEvent.setup(); await i18n.changeLanguage('ka');
    vi.mocked(api.updateActivities).mockResolvedValue({ ...capabilities, revision: 5 });
    render(<OrganizationActivitySettings id={17} />);
    expect(await screen.findByRole('checkbox', { name: 'ახალი ჯავშნების მიღება' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'საქმიანობის შენახვა' }));
    expect(await screen.findByText('საქმიანობა შენახულია.')).toBeInTheDocument();
});

it('keeps mixed venue profile tools in the dedicated organization workspace', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { profile: { id:17, displayName:'Mixed venue',profileKind:'VENUE',clubId:null,published:false,verificationStatus:'UNVERIFIED',capabilities,canEdit:true,canCreateTournament:true }, competitions:[], portfolio:{venues:[]}, canOpenWorkspace:true,membershipRole:'OWNER' } });
    render(<MemoryRouter initialEntries={['/organizations/17']}><Routes><Route path="/organizations/:organizationId" element={<OrganizationProfilePage />} /></Routes></MemoryRouter>);
    expect(await screen.findByRole('link', { name: 'Open workspace' })).toHaveAttribute('href', '/organizations/17/workspace');
    expect(screen.getByRole('tab', { name:'Venues' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name:'Tournaments' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name:'Save activities' })).not.toBeInTheDocument();
});
it('opens the actual club profile from an old organization link', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { profile:{id:17,clubId:31},competitions:[] } });
    render(<MemoryRouter initialEntries={['/organizations/17']}><Routes><Route path="/organizations/:organizationId" element={<OrganizationProfilePage />} /><Route path="/clubs/31" element={<h1>Canonical club profile</h1>} /></Routes></MemoryRouter>);
    expect(await screen.findByRole('heading', { name:'Canonical club profile' })).toBeInTheDocument();
});

it('shows booking controls to a venue operator and hides venue configuration', async () => {
    vi.mocked(venueApi.fetchVenue).mockResolvedValue({ id: 17, displayName: 'Venue', timezone: 'Asia/Tbilisi', published: false, canManage: true,
        capabilities: { ...operatorCapabilities, enabledActivities: ['PROFILE'] }, pitches: [], photos: [], openingHours: [] } as unknown as venueApi.Venue);
    render(<MemoryRouter initialEntries={['/stadiums/17/manage']}><Routes><Route path="/stadiums/:organizationId/manage" element={<StadiumWorkspacePage />} /></Routes></MemoryRouter>);
    await userEvent.click(await screen.findByRole('button', { name: 'Calendar & reservations' }));
    expect(await screen.findByRole('button', { name: 'Add closure' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Stadium page' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pitches' })).not.toBeInTheDocument();
    expect(screen.queryByText('Configuration editor')).not.toBeInTheDocument();
});
