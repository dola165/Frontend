import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import i18n from '../../i18n';
import { TournamentSetupPage } from '../TournamentSetupPage';
import { CreateOrganizationPage } from '../CreateOrganizationPage';
import { BrowseTournamentsPage } from '../BrowseTournamentsPage';
import { fetchMyOrganizations, fetchTournamentHostClubs, fetchTournaments,fetchTournamentDiscovery } from '../../features/tournaments/api';
import { useAuth } from '../../context/AuthContext';
import type { MyOrganization, TournamentDetail } from '../../features/tournaments/domain';
import type { TournamentSetupDraft } from '../../features/tournaments/setupDraft';
import { apiClient } from '../../api/axiosConfig';
import type { CreatedOrganization } from '../../features/organizations/setup/domain';
vi.mock('../../api/axiosConfig', () => ({ apiClient: { post: vi.fn(), get: vi.fn() } }));
vi.mock('../../components/MiniMap', () => ({ MiniMap: () => <div>Map picker</div> }));
import { getInvitations } from '../../features/organizations/activities/api';

vi.mock('../../features/organizations/activities/api', () => ({ getInvitations: vi.fn() }));

vi.mock('../../features/tournaments/api', () => ({
    createCompetition: vi.fn(), fetchMyOrganizations: vi.fn(),
    fetchTournamentHostClubs: vi.fn(), fetchTournaments: vi.fn(), fetchTournamentDiscovery:vi.fn().mockResolvedValue({highlights:[],followedHosts:[],suggestedHosts:[],shelves:[]}), registerPlayer: vi.fn(),
}));
import {createCompetition} from '../../features/competitions/api';
vi.mock('../../features/competitions/api',async importOriginal=>{const actual=await importOriginal<typeof import('../../features/competitions/api')>();return {...actual,createCompetition:vi.fn(),defaultRules:()=>({...actual.defaultRules(),ruleset:'Published organiser rules for adult football',seasonPolicy:'This single event retains historical results; withdrawals reviewed by organiser.'})};});
vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../features/tournaments/components/TournamentDiscovery',()=>({TournamentDiscovery:()=> <p>No tournaments found</p>,TournamentHosts:()=> <p>No public hosts</p>}));

const organization = (id: number, available = true): MyOrganization => ({
    id, slug: `org-${id}`, displayName: `Organization ${id}`, membershipRole: available ? 'OWNER' : 'MEMBER',
    kinds: ['SPORTS_ORG'], primaryKind: 'SPORTS_ORG', clubBacked: false, canCreateTournament: available,
});

const BackButton = () => {
    const navigate = useNavigate();
    return <button onClick={() => navigate(-1)}>Device back</button>;
};

async function reviewOrganization(user: ReturnType<typeof userEvent.setup>, name: string) {
    await user.click(await screen.findByRole('button', { name: 'Continue' }));
    await user.type(screen.getByRole('textbox', { name: 'Name' }), name);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
}

const fillTournamentDates = () => {
    fireEvent.change(screen.getByLabelText('Starts'), { target: { value: '2099-06-01T10:00' } });
    fireEvent.change(screen.getByLabelText('Ends'), { target: { value: '2099-06-02T18:00' } });
};

function renderFlow(path = '/tournaments/setup', state?: unknown) {
    return render(<MemoryRouter initialEntries={[{ pathname: path.split('?')[0], search: path.includes('?') ? `?${path.split('?')[1]}` : '', state }]}>
        <BackButton />
        <Routes>
            <Route path="/" element={<Link to="/tournaments">Tournaments</Link>} />
            <Route path="/tournaments" element={<BrowseTournamentsPage />} />
            <Route path="/tournaments/setup" element={<TournamentSetupPage />} />
            <Route path="/organizations/create" element={<CreateOrganizationPage />} />
            <Route path="/my-organizations" element={<Link to="/tournaments">Tournaments</Link>} />
            <Route path="/organizations/:id" element={<h1>Organization profile</h1>} />
            <Route path="/stadiums/:id/manage" element={<h1>Venue management</h1>} />
            <Route path="/tournaments/:id/workspace" element={<h1>Event workspace</h1>} />
        </Routes>
    </MemoryRouter>);
}

describe('Organization and tournament creation', () => {
    let organizations: MyOrganization[];

    beforeEach(() => {
        vi.resetAllMocks();
        sessionStorage.clear();
        vi.mocked(getInvitations).mockResolvedValue([]);
        vi.mocked(apiClient.get).mockResolvedValue({ data: { content: [] } });
        organizations = [];
        vi.mocked(useAuth).mockReturnValue({ isAuthenticated: true, user: { id: 17, role: 'FAN' }, refreshNavigationCapabilities: vi.fn().mockResolvedValue(undefined) } as unknown as ReturnType<typeof useAuth>);
        vi.mocked(fetchMyOrganizations).mockImplementation(async () => [...organizations]);
        vi.mocked(fetchTournamentHostClubs).mockResolvedValue([]);
        vi.mocked(fetchTournamentDiscovery).mockResolvedValue({highlights:[],followedHosts:[],suggestedHosts:[],shelves:[]});
        vi.mocked(fetchTournaments).mockResolvedValue({ content: [], pageNumber: 0, pageSize: 12, totalPages: 1, totalElements: 0 });
        vi.mocked(apiClient.post).mockImplementation(async (_path, payload) => {
            const body = payload as { displayName: string; organizationType: MyOrganization['primaryKind'] };
            organizations.push({ ...organization(42), displayName: body.displayName, kinds: [body.organizationType!], primaryKind: body.organizationType });
            return { data: { id: 42, clubId: null, profilePath: '/organizations/42', workspacePath: '/organizations/42/workspace' } };
        });
        vi.mocked(createCompetition).mockResolvedValue({ id: 88 } as TournamentDetail);
    });

    it('lets a new account create an organizer and then an event from the directory', async () => {
        const user = userEvent.setup();
        renderFlow('/tournaments');
        await user.click(await screen.findByRole('link', { name: 'Tournament setup' }));
        expect(await screen.findByText(/You do not manage an organization/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
        await user.click(screen.getByRole('button', { name: 'Create organization' }));
        await reviewOrganization(user, '  Community events  ');
        await user.click(screen.getByRole('button', { name: 'Create organization' }));
        expect(apiClient.post).toHaveBeenCalledWith('/organizations/setup', expect.objectContaining({ displayName: 'Community events', organizationType: 'SPORTS_ORG', tournamentEnabled: true, requestId: expect.any(String) }));
        await user.click(await screen.findByRole('button', { name: 'Continue tournament setup' }));
        expect(await screen.findByRole('combobox', { name: 'Organizer' })).toHaveValue('42');
        await user.type(screen.getByRole('textbox', { name: 'Tournament name' }), 'Spring cup');
        fillTournamentDates();
        await user.click(screen.getByRole('button', { name: 'Continue' }));
        await user.click(screen.getByRole('button', { name: 'Review tournament' }));
        await user.click(screen.getByRole('button', { name: 'Create tournament' }));
        expect(vi.mocked(createCompetition).mock.calls[0]?.[0]).toEqual(expect.objectContaining({ organizerOrganizationId: 42, name: 'Spring cup', hostClubId: null, visibility: 'PRIVATE' }));
        expect(await screen.findByRole('heading', { name: 'Event workspace' })).toBeInTheDocument();
    });

    it('preserves event details on cancel, device Back, and a successful organization round trip', async () => {
        organizations = [organization(3)];
        const user = userEvent.setup();
        renderFlow();
        await user.type(await screen.findByRole('textbox', { name: 'Tournament name' }), 'Keep this event');
        fillTournamentDates();
        await user.click(screen.getByRole('button', { name: 'Continue' }));
        await user.type(screen.getByRole('textbox', { name: 'Rules' }), 'Five players per side');
        await user.click(screen.getByRole('button', { name: 'Review tournament' }));
        await user.selectOptions(screen.getByRole('combobox', { name: /^Visibility/ }), 'UNLISTED');
        await user.click(screen.getByRole('button', { name: 'Basics' }));
        await user.click(screen.getByRole('button', { name: 'Create organization' }));
        await user.click(screen.getByRole('button', { name: 'Device back' }));
        expect(await screen.findByRole('textbox', { name: 'Tournament name' })).toHaveValue('Keep this event');
        await user.click(screen.getByRole('button', { name: 'Create organization' }));
        await user.click(screen.getByRole('button', { name: 'Device back' }));
        await user.click(await screen.findByRole('button', { name: 'Continue' }));
        expect(await screen.findByRole('textbox', { name: 'Rules' })).toHaveValue('Five players per side');
        await user.click(screen.getByRole('button', { name: 'Basics' }));
        await user.click(screen.getByRole('button', { name: 'Create organization' }));
        await reviewOrganization(user, 'New host');
        await user.click(screen.getByRole('button', { name: 'Create organization' }));
        await user.click(await screen.findByRole('button', { name: 'Continue tournament setup' }));
        expect(await screen.findByRole('combobox', { name: 'Organizer' })).toHaveValue('42');
        expect(screen.getByRole('textbox', { name: 'Tournament name' })).toHaveValue('Keep this event');
        await user.click(screen.getByRole('button', { name: 'Continue' }));
        expect(screen.getByRole('textbox', { name: 'Rules' })).toHaveValue('Five players per side');
        await user.click(screen.getByRole('button', { name: 'Review tournament' }));
        expect(screen.getByRole('combobox', { name: /^Visibility/ })).toHaveValue('UNLISTED');
    }, 10000); // Multiple complete wizard round trips also run under parallel-suite load.

    it('uses only current server capabilities when returning an organization selection', async () => {
        organizations = [organization(42, false), organization(3)];
        renderFlow('/tournaments/setup?organizer=42');
        expect(await screen.findByRole('combobox', { name: 'Organizer' })).toHaveValue('3');
        expect(screen.queryByRole('option', { name: 'Organization 42' })).not.toBeInTheDocument();
        expect(fetchTournamentHostClubs).not.toHaveBeenCalledWith(42);
    });

    it('shows a retryable load failure instead of claiming the account has no organizations', async () => {
        const user = userEvent.setup();
        organizations = [organization(3)];
        vi.mocked(fetchMyOrganizations).mockRejectedValueOnce(new Error('Offline'));
        renderFlow();
        expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load organizations.');
        expect(screen.queryByText(/You do not manage an organization/)).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Retry organizations' }));
        expect(await screen.findByRole('combobox', { name: 'Organizer' })).toHaveValue('3');
    });

    it('retains the organization form after rejection and prevents duplicate submissions', async () => {
        const user = userEvent.setup();
        let reject!: (reason: unknown) => void;
        vi.mocked(apiClient.post).mockImplementationOnce(() => new Promise((_resolve, rejectRequest) => { reject = rejectRequest; }));
        renderFlow('/organizations/create');
        await reviewOrganization(user, 'Keep organization');
        await user.dblClick(screen.getByRole('button', { name: 'Create organization' }));
        expect(apiClient.post).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled();
        await act(async () => reject({ response: { status: 403, data: { error: 'Denied' } } }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Denied');
        await user.click(screen.getByRole('button', { name: 'Back' }));
        expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Keep organization');
        await user.click(screen.getByRole('button', { name: 'Continue' }));
        expect(screen.getByRole('button', { name: 'Create organization' })).toBeEnabled();
    });

    it('does not reopen setup when an abandoned organization request finishes', async () => {
        const user = userEvent.setup();
        let finish!: (result: { data: CreatedOrganization }) => void;
        vi.mocked(apiClient.post).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        renderFlow('/organizations/create');
        await reviewOrganization(user, 'Started organization');
        await user.click(screen.getByRole('button', { name: 'Create organization' }));
        await user.click(screen.getByRole('link', { name: 'Open an existing organization' }));
        await user.click(await screen.findByRole('link', { name: 'Tournaments' }));
        await act(async () => finish({ data: { id: 42, clubId: null, profilePath: '/organizations/42', workspacePath: '/organizations/42/workspace' } }));
        expect(screen.queryByRole('heading', { name: 'Create a tournament' })).not.toBeInTheDocument();
        expect(await screen.findByText('No tournaments found')).toBeInTheDocument();
    });

    it('does not restore a different account event draft', async () => {
        organizations = [organization(3)];
        const tournamentSetupDraft: TournamentSetupDraft = {
            accountId: 99, organizerId: 3,
            form: { hostClubId: '', name: 'Other account event', description: '', rules: '', participantScope: 'CLUB', visibility: 'PRIVATE',
                registrationOpensAt: '', registrationClosesAt: '', startDate: '', endDate: '' },
        };
        renderFlow('/tournaments/setup', { tournamentSetupDraft });
        expect(await screen.findByRole('textbox', { name: 'Tournament name' })).toHaveValue('');
    });

    it('provides an existing eligible organization as a working return action', async () => {
        organizations = [organization(3), organization(8, false)];
        const user = userEvent.setup();
        const tournamentSetupDraft: TournamentSetupDraft = {
            accountId: 17, organizerId: null,
            form: { hostClubId: '', name: 'Kept tournament', description: '', rules: '', participantScope: 'CLUB', visibility: 'PRIVATE',
                registrationOpensAt: '', registrationClosesAt: '', startDate: '', endDate: '' },
        };
        renderFlow('/tournaments/setup', { tournamentSetupDraft });
        await user.selectOptions(await screen.findByRole('combobox', { name: 'Organizer' }), '3');
        expect(screen.queryByRole('option', { name: 'Organization 8' })).not.toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: 'Tournament name' })).toHaveValue('Kept tournament');
        expect(await screen.findByRole('combobox', { name: 'Organizer' })).toHaveValue('3');
        await waitFor(() => expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled());
    });

    it.each([['Media', 'MEDIA'], ['Healthcare', 'HEALTHCARE']])('can create the supported %s organization kind', async (label, kind) => {
        const user = userEvent.setup();
        renderFlow('/organizations/create');
        await user.click(screen.getByRole('radio', { name: new RegExp(`^${label}`) }));
        await reviewOrganization(user, 'Community partner');
        await user.click(screen.getByRole('button', { name: 'Create organization' }));
        expect(apiClient.post).toHaveBeenCalledWith('/organizations/setup', expect.objectContaining({ organizationType: kind }));
        await user.click(await screen.findByRole('link', { name: 'View profile' }));
        expect(await screen.findByRole('heading', { name: 'Organization profile' })).toBeInTheDocument();
    });

    it('requires real future dates and correct ordering before advancing', async () => {
        organizations = [organization(3)];
        const user = userEvent.setup();
        renderFlow();
        await user.type(await screen.findByRole('textbox', { name: 'Tournament name' }), 'Community cup');
        await user.click(screen.getByRole('button', { name: 'Continue' }));
        expect(screen.getByRole('alert')).toHaveTextContent('Choose when the tournament starts.');
        fillTournamentDates();
        fireEvent.change(screen.getByLabelText('Ends'), { target: { value: '2099-05-31T18:00' } });
        await user.click(screen.getByRole('button', { name: 'Review' }));
        expect(screen.getByRole('alert')).toHaveTextContent('The tournament must end on or after it starts.');
        fireEvent.change(screen.getByLabelText('Starts'), { target: { value: '2020-05-31T18:00' } });
        await user.click(screen.getByRole('button', { name: 'Continue' }));
        expect(screen.getByRole('alert')).toHaveTextContent('Choose a start date in the future.');
        expect(createCompetition).not.toHaveBeenCalled();
    });

    it('keeps invalid registration details editable and prevents skipping validation through the review step', async () => {
        organizations = [organization(3)];
        const user = userEvent.setup();
        renderFlow();
        await user.type(await screen.findByRole('textbox', { name: 'Tournament name' }), 'Community cup');
        fillTournamentDates();
        await user.click(screen.getByRole('button', { name: 'Continue' }));
        fireEvent.change(screen.getByLabelText('Registration opens'), { target: { value: '2099-05-28T09:00' } });
        fireEvent.change(screen.getByLabelText('Registration closes'), { target: { value: '2099-05-27T09:00' } });
        await user.click(screen.getByRole('button', { name: 'Review' }));
        expect(screen.getByRole('alert')).toHaveTextContent('Registration must close on or after it opens.');
        expect(screen.getByRole('button', { name: 'Details' })).toHaveAttribute('aria-current', 'step');
        fireEvent.change(screen.getByLabelText('Registration closes'), { target: { value: '2099-06-03T09:00' } });
        await user.click(screen.getByRole('button', { name: 'Review tournament' }));
        expect(screen.getByRole('alert')).toHaveTextContent('Registration must close by the tournament start.');
        expect(createCompetition).not.toHaveBeenCalled();
    });

    it('lets a healthcare organizer continue without host clubs and retains details after a failed save', async () => {
        organizations = [{ ...organization(3), primaryKind: 'HEALTHCARE', kinds: ['HEALTHCARE'] }];
        vi.mocked(fetchTournamentHostClubs).mockRejectedValueOnce(new Error('Offline'));
        let reject!: (reason: Error) => void;
        vi.mocked(createCompetition).mockImplementationOnce(() => new Promise((_resolve, rejectRequest) => { reject = rejectRequest; }));
        const user = userEvent.setup();
        renderFlow();
        await user.type(await screen.findByRole('textbox', { name: 'Tournament name' }), 'Health community cup');
        fillTournamentDates();
        await user.click(screen.getByRole('button', { name: 'Continue' }));
        expect(screen.getByRole('alert')).toHaveTextContent('You can continue without a host club.');
        await user.type(screen.getByRole('textbox', { name: 'Rules' }), 'Five players per side');
        await user.click(screen.getByRole('button', { name: 'Review tournament' }));
        await user.dblClick(screen.getByRole('button', { name: 'Create tournament' }));
        expect(createCompetition).toHaveBeenCalledTimes(1);
        expect(vi.mocked(createCompetition).mock.calls[0]?.[0]).toEqual(expect.objectContaining({ organizerOrganizationId: 3, hostClubId: null, registrationOpensAt: null, rules: 'Five players per side', visibility: 'PRIVATE' }));
        expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled();
        await act(async () => reject(new Error('Unavailable')));
        expect(screen.getByRole('alert')).toHaveTextContent('Your details have been kept.');
        await user.click(screen.getByRole('button', { name: 'Back' }));
        expect(screen.getByRole('textbox', { name: 'Rules' })).toHaveValue('Five players per side');
        await user.click(screen.getByRole('button', { name: 'Retry host clubs' }));
        await waitFor(() => expect(screen.queryByText('Failed to load host clubs. You can continue without a host club.')).not.toBeInTheDocument());
    });

    it('clears a previous organizer host club when choosing a different organization', async () => {
        organizations = [organization(3), organization(4)];
        vi.mocked(fetchTournamentHostClubs).mockImplementation(async id => id === 3 ? [{ clubId: 21, clubName: 'Host club', organizationId: 3, organizationName: 'Organization 3', accessType: 'OWN_ORGANIZATION' }] : []);
        const user = userEvent.setup();
        renderFlow();
        await user.type(await screen.findByRole('textbox', { name: 'Tournament name' }), 'Community cup');
        fillTournamentDates();
        await user.click(screen.getByRole('button', { name: 'Continue' }));
        await user.selectOptions(screen.getByRole('combobox', { name: /^Host club/ }), '21');
        await user.click(screen.getByRole('button', { name: 'Basics' }));
        await user.selectOptions(screen.getByRole('combobox', { name: 'Organizer' }), '4');
        await user.click(screen.getByRole('button', { name: 'Review' }));
        await user.click(screen.getByRole('button', { name: 'Create tournament' }));
        expect(vi.mocked(createCompetition).mock.calls[0]?.[0]).toEqual(expect.objectContaining({ organizerOrganizationId: 4, hostClubId: null }));
    });

    it('does not return to the workspace after leaving a pending tournament creation', async () => {
        organizations = [organization(3)];
        let finish!: (result: TournamentDetail) => void;
        vi.mocked(createCompetition).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        const user = userEvent.setup();
        renderFlow();
        await user.type(await screen.findByRole('textbox', { name: 'Tournament name' }), 'Community cup');
        fillTournamentDates();
        await user.click(screen.getByRole('button', { name: 'Review' }));
        await user.click(screen.getByRole('button', { name: 'Create tournament' }));
        await user.click(screen.getByRole('link', { name: 'Tournaments' }));
        await act(async () => finish({ id: 88 } as TournamentDetail));
        expect(screen.queryByRole('heading', { name: 'Event workspace' })).not.toBeInTheDocument();
    });

    it('shows the creation form and validation in Georgian', async () => {
        organizations = [organization(3)];
        await i18n.changeLanguage('ka');
        try {
            const user = userEvent.setup();
            renderFlow();
            expect(await screen.findByRole('textbox', { name: 'ტურნირის სახელი' })).toBeInTheDocument();
            await user.click(screen.getByRole('button', { name: 'გაგრძელება' }));
            expect(screen.getByRole('alert')).toHaveTextContent('შეიყვანე ტურნირის სახელი.');
        } finally {
            await act(async () => { await i18n.changeLanguage('en'); });
        }
    });
});

