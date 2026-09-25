import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import i18n from '../../i18n';
import { CreateOrganizationPage } from '../CreateOrganizationPage';
import { createOrganization, fetchMyOrganizations } from '../../features/tournaments/api';
import { useAuth } from '../../context/AuthContext';
import type { CreatableOrganizationKind, MyOrganization } from '../../features/tournaments/domain';
import type { TournamentSetupDraft } from '../../features/tournaments/setupDraft';
import { getOrganizationOnboardingCopy } from '../../features/organizations/onboarding/organizationOnboarding';
import { getInvitations } from '../../features/organizations/activities/api';

vi.mock('../../features/organizations/activities/api', () => ({ getInvitations: vi.fn() }));

vi.mock('../../features/tournaments/api', () => ({
    createOrganization: vi.fn(),
    fetchMyOrganizations: vi.fn(),
}));
vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));

const organization = (kind: CreatableOrganizationKind, id = 91): MyOrganization => ({
    id,
    slug: `organization-${id}`,
    displayName: 'Community organization',
    membershipRole: 'OWNER',
    kinds: [kind],
    primaryKind: kind,
    clubBacked: false,
    canCreateTournament: true,
});

const tournamentSetupDraft: TournamentSetupDraft = {
    accountId: 17,
    organizerId: null,
    form: {
        hostClubId: '44',
        name: 'Kept tournament',
        description: 'Kept description',
        rules: 'Kept rules',
        participantScope: 'SQUAD',
        visibility: 'UNLISTED',
        registrationOpensAt: '2099-01-01T10:00',
        registrationClosesAt: '2099-01-02T10:00',
        startDate: '2099-02-01T10:00',
        endDate: '2099-02-02T10:00',
    },
};

const LocationResult = () => {
    const location = useLocation();
    return <div>
        <output data-testid="location">{location.pathname}{location.search}</output>
        <output data-testid="location-state">{JSON.stringify(location.state)}</output>
    </div>;
};

const pageTree = (path: string, state?: unknown) => {
    const [pathname, search = ''] = path.split('?');
    return <MemoryRouter initialEntries={[{ pathname, search: search ? `?${search}` : '', state }]}>
        <Routes>
            <Route path="/organizations/create" element={<CreateOrganizationPage />} />
            <Route path="*" element={<LocationResult />} />
        </Routes>
    </MemoryRouter>;
};

describe('CreateOrganizationPage onboarding routing', () => {
    let auth: ReturnType<typeof useAuth>;

    beforeEach(async () => {
        vi.resetAllMocks();
        vi.mocked(getInvitations).mockResolvedValue([]);
        await i18n.changeLanguage('en');
        auth = { sessionId: 'session-a', user: { id: 17 }, refreshNavigationCapabilities: vi.fn().mockResolvedValue(undefined) } as unknown as ReturnType<typeof useAuth>;
        vi.mocked(useAuth).mockImplementation(() => auth);
        vi.mocked(fetchMyOrganizations).mockResolvedValue([]);
        vi.mocked(createOrganization).mockImplementation(async payload => organization(payload.kind));
    });

    it.each([
        ['VENUE', 'Venue operator', '/stadiums/91/manage'],
        ['TOURNAMENT_ORGANIZER', 'Tournament organizer', '/organizations/91'],
        ['SPORTS_ORG', 'Sports organization', '/organizations/91'],
        ['COMPANY', 'Company', '/organizations/91'],
        ['SPONSOR', 'Sponsor', '/organizations/91'],
        ['MEDIA', 'Media organization', '/organizations/91'],
        ['HEALTHCARE', 'Healthcare organization', '/organizations/91'],
        ['PARTNER', 'Partner organization', '/organizations/91'],
    ] as const)('sends standalone %s creation to its real next destination', async (kind, label, destination) => {
        const user = userEvent.setup();
        render(pageTree(`/organizations/create?kind=${kind}`));

        expect(await screen.findByRole('radio', { name: new RegExp(`^${label}`) })).toBeChecked();
        await user.type(screen.getByRole('textbox', { name: 'Organization Name' }), `${label} name`);
        await user.click(screen.getByRole('button', { name: 'Create Organization' }));

        expect(createOrganization).toHaveBeenCalledWith({ displayName: `${label} name`, description: null, kind });
        expect(await screen.findByTestId('location')).toHaveTextContent(destination);
        expect(auth.refreshNavigationCapabilities).toHaveBeenCalledOnce();
    });

    it('opens the confirmed venue even when refreshing navigation fails', async () => {
        const user = userEvent.setup();
        vi.mocked(auth.refreshNavigationCapabilities).mockRejectedValue(new Error('Offline'));
        render(pageTree('/organizations/create?kind=VENUE'));
        expect(screen.getByRole('heading', { name: 'Create your venue organization' })).toBeInTheDocument();
        await user.type(screen.getByRole('textbox', { name: 'Organization Name' }), 'Sports Park');
        await user.click(screen.getByRole('button', { name: 'Create Organization' }));
        expect(await screen.findByTestId('location')).toHaveTextContent('/stadiums/91/manage');
        expect(createOrganization).toHaveBeenCalledOnce();
    });

    it('opens a confirmed venue when an older auth provider has no navigation refresh method', async () => {
        const user = userEvent.setup();
        Reflect.deleteProperty(auth, 'refreshNavigationCapabilities');
        render(pageTree('/organizations/create?kind=VENUE'));
        await user.type(screen.getByRole('textbox', { name: 'Organization Name' }), 'Legacy venue');
        await user.click(screen.getByRole('button', { name: 'Create Organization' }));
        expect(await screen.findByTestId('location')).toHaveTextContent('/stadiums/91/manage');
        expect(fetchMyOrganizations).toHaveBeenCalledOnce();
        expect(createOrganization).toHaveBeenCalledOnce();
    });

    it('routes an existing venue member through its organization unless venue operations are allowed', async () => {
        vi.mocked(fetchMyOrganizations).mockResolvedValue([
            { ...organization('VENUE', 12), displayName: 'Member venue', membershipRole: 'MEMBER' },
            { ...organization('COMPANY', 13), displayName: 'Company with venue', capabilities: { canManageVenueBookings: true } as NonNullable<MyOrganization['capabilities']> },
            { ...organization('VENUE', 14), displayName: 'Legacy owner venue' },
            { ...organization('VENUE', 15), displayName: 'Legacy admin venue', membershipRole: 'ADMIN' },
            { ...organization('VENUE', 16), displayName: 'Denied venue', capabilities: { canManageVenueBookings: false } as NonNullable<MyOrganization['capabilities']> },
        ]);
        render(pageTree('/organizations/create?kind=VENUE'));
        expect(await screen.findByRole('link', { name: 'Member venue' })).toHaveAttribute('href', '/organizations/12');
        expect(screen.getByRole('link', { name: 'Company with venue' })).toHaveAttribute('href', '/stadiums/13/manage');
        expect(screen.getByRole('link', { name: 'Legacy owner venue' })).toHaveAttribute('href', '/stadiums/14/manage');
        expect(screen.getByRole('link', { name: 'Legacy admin venue' })).toHaveAttribute('href', '/stadiums/15/manage');
        expect(screen.getByRole('link', { name: 'Denied venue' })).toHaveAttribute('href', '/organizations/16');
    });

    it('keeps the explicit tournament continuation and its full draft for every organization kind', async () => {
        const user = userEvent.setup();
        render(pageTree('/organizations/create?kind=HEALTHCARE', { tournamentSetupDraft }));

        expect(screen.getByRole('heading', { name: 'Add the organization running this tournament' })).toBeInTheDocument();
        await user.type(screen.getByRole('textbox', { name: 'Organization Name' }), 'Tournament clinic');
        await user.click(screen.getByRole('button', { name: 'Create Organization' }));

        expect(await screen.findByTestId('location')).toHaveTextContent('/tournaments/setup?organizer=91');
        expect(JSON.parse(screen.getByTestId('location-state').textContent ?? '{}')).toEqual({
            tournamentSetupDraft: {
                ...tournamentSetupDraft,
                organizerId: 91,
                form: { ...tournamentSetupDraft.form, hostClubId: '' },
            },
        });
    });

    it('keeps the form editable after failure and permits one deliberate retry', async () => {
        const user = userEvent.setup();
        vi.mocked(createOrganization)
            .mockRejectedValueOnce({ response: { status: 400, data: { error: 'Unavailable' } } })
            .mockResolvedValueOnce(organization('SPONSOR'));
        render(pageTree('/organizations/create?kind=SPONSOR'));

        await user.type(screen.getByRole('textbox', { name: 'Organization Name' }), '  Local sponsor  ');
        await user.type(screen.getByRole('textbox', { name: 'Public Introduction (Optional)' }), 'Keep this introduction');
        await user.click(screen.getByRole('button', { name: 'Create Organization' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Unavailable');
        expect(screen.getByRole('textbox', { name: 'Organization Name' })).toHaveValue('  Local sponsor  ');
        expect(screen.getByRole('textbox', { name: 'Public Introduction (Optional)' })).toHaveValue('Keep this introduction');
        await user.click(screen.getByRole('button', { name: 'Create Organization' }));

        expect(createOrganization).toHaveBeenCalledTimes(2);
        expect(createOrganization).toHaveBeenLastCalledWith({ displayName: 'Local sponsor', description: 'Keep this introduction', kind: 'SPONSOR' });
        expect(await screen.findByTestId('location')).toHaveTextContent('/organizations/91');
    });

    it('prevents repeated submission while creation is pending', async () => {
        const user = userEvent.setup();
        let finish!: (created: MyOrganization) => void;
        vi.mocked(createOrganization).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        render(pageTree('/organizations/create?kind=MEDIA'));

        await user.type(screen.getByRole('textbox', { name: 'Organization Name' }), 'Media team');
        await user.dblClick(screen.getByRole('button', { name: 'Create Organization' }));

        expect(createOrganization).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('button', { name: 'Creating organization…' })).toBeDisabled();
        await act(async () => finish(organization('MEDIA')));
        expect(await screen.findByTestId('location')).toHaveTextContent('/organizations/91');
    });

    it('recovers an organization created behind an ambiguous response without submitting again', async () => {
        const user = userEvent.setup();
        vi.mocked(fetchMyOrganizations)
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([organization('PARTNER')]);
        vi.mocked(createOrganization).mockRejectedValueOnce(new Error('Connection closed'));
        render(pageTree('/organizations/create?kind=PARTNER'));

        await user.type(screen.getByRole('textbox', { name: 'Organization Name' }), 'Community organization');
        await user.click(screen.getByRole('button', { name: 'Create Organization' }));

        expect(await screen.findByTestId('location')).toHaveTextContent('/organizations/91');
        expect(createOrganization).toHaveBeenCalledTimes(1);
        expect(fetchMyOrganizations).toHaveBeenCalledTimes(2);
        expect(auth.refreshNavigationCapabilities).toHaveBeenCalledOnce();
    });

    it('does not redirect or allow a duplicate when the account scope changes in flight', async () => {
        const user = userEvent.setup();
        let finish!: (created: MyOrganization) => void;
        vi.mocked(createOrganization).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        const view = render(pageTree('/organizations/create?kind=COMPANY'));

        await user.type(screen.getByRole('textbox', { name: 'Organization Name' }), 'Scoped company');
        await user.click(screen.getByRole('button', { name: 'Create Organization' }));
        auth = { sessionId: 'session-b', user: { id: 22 } } as ReturnType<typeof useAuth>;
        view.rerender(pageTree('/organizations/create?kind=COMPANY'));
        expect(await screen.findByRole('alert')).toHaveTextContent('Your sign-in changed');

        await act(async () => finish(organization('COMPANY')));
        expect(screen.getByRole('alert')).toHaveTextContent('was created, but your sign-in changed');
        expect(screen.getByRole('button', { name: 'Create Organization' })).toBeDisabled();
        expect(screen.queryByTestId('location')).not.toBeInTheDocument();
        await waitFor(() => expect(fetchMyOrganizations).toHaveBeenCalledTimes(2));
    });

    it.each(['resolve', 'reject'] as const)('keeps account isolation when reconciliation later %s', async outcome => {
        const user = userEvent.setup();
        let finish!: (organizations: MyOrganization[]) => void;
        let fail!: (reason: Error) => void;
        vi.mocked(fetchMyOrganizations)
            .mockResolvedValueOnce([])
            .mockImplementationOnce(() => new Promise((resolve, reject) => { finish = resolve; fail = reject; }))
            .mockResolvedValueOnce([]);
        vi.mocked(createOrganization).mockRejectedValueOnce(new Error('Connection closed'));
        const view = render(pageTree('/organizations/create?kind=COMPANY'));
        await user.type(screen.getByRole('textbox', { name: 'Organization Name' }), 'Community organization');
        await user.click(screen.getByRole('button', { name: 'Create Organization' }));
        await waitFor(() => expect(fetchMyOrganizations).toHaveBeenCalledTimes(2));

        auth = { sessionId: 'session-b', user: { id: 22 } } as ReturnType<typeof useAuth>;
        view.rerender(pageTree('/organizations/create?kind=COMPANY'));
        await waitFor(() => expect(fetchMyOrganizations).toHaveBeenCalledTimes(3));
        await act(async () => {
            if (outcome === 'resolve') finish([organization('COMPANY')]);
            else fail(new Error('Connection lost'));
        });

        expect(screen.getByRole('alert')).toHaveTextContent('Your sign-in changed');
        expect(screen.getByRole('button', { name: 'Create Organization' })).toBeDisabled();
        expect(screen.queryByRole('link', { name: 'Community organization' })).not.toBeInTheDocument();
        expect(screen.queryByTestId('location')).not.toBeInTheDocument();
        expect(createOrganization).toHaveBeenCalledTimes(1);
    });

    it('does not offer another create when an ambiguous request is absent from an immediate read', async () => {
        const user = userEvent.setup();
        vi.mocked(createOrganization).mockRejectedValueOnce(new Error('Connection closed'));
        render(pageTree('/organizations/create?kind=COMPANY'));
        await user.type(screen.getByRole('textbox', { name: 'Organization Name' }), 'Community organization');
        await user.click(screen.getByRole('button', { name: 'Create Organization' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('The result could not be confirmed');
        expect(screen.getByRole('button', { name: 'Create Organization' })).toBeDisabled();
        expect(screen.getByRole('textbox', { name: 'Organization Name' })).toHaveValue('Community organization');
        expect(createOrganization).toHaveBeenCalledTimes(1);
    });

    it('does not mistake an old matching organization for a recovered create without a starting inventory', async () => {
        const user = userEvent.setup();
        vi.mocked(fetchMyOrganizations)
            .mockRejectedValueOnce(new Error('Inventory unavailable'))
            .mockResolvedValueOnce([organization('COMPANY')]);
        vi.mocked(createOrganization).mockRejectedValueOnce(new Error('Connection closed'));
        render(pageTree('/organizations/create?kind=COMPANY'));
        await user.type(screen.getByRole('textbox', { name: 'Organization Name' }), 'Community organization');
        await user.click(screen.getByRole('button', { name: 'Create Organization' }));

        await waitFor(() => expect(screen.getByRole('button', { name: 'Create Organization' })).toBeDisabled());
        expect(screen.queryByTestId('location')).not.toBeInTheDocument();
        expect(await screen.findByText('The result could not be confirmed. Check My organizations before creating another to avoid a duplicate.')).toBeInTheDocument();
        expect(createOrganization).toHaveBeenCalledTimes(1);
    });

    it('offers an existing organizer as a continuation only when a tournament draft is present', async () => {
        vi.mocked(fetchMyOrganizations).mockResolvedValue([organization('SPORTS_ORG', 12)]);
        const standalone = render(pageTree('/organizations/create'));
        expect(await screen.findByRole('link', { name: 'Community organization' })).toHaveAttribute('href', '/organizations/12');
        expect(screen.queryByRole('link', { name: 'Use for this tournament' })).not.toBeInTheDocument();
        standalone.unmount();

        render(pageTree('/organizations/create', { tournamentSetupDraft }));
        expect(await screen.findByRole('link', { name: 'Use for this tournament' })).toHaveAttribute('href', '/tournaments/setup?organizer=12');
    });

    it('keeps reusable Georgian starter copy for every supported kind', () => {
        const georgian = getOrganizationOnboardingCopy('ka-GE');
        expect(georgian.kinds).toHaveLength(8);
        expect(georgian.kinds.find(({ kind }) => kind === 'SPORTS_ORG')?.nextStep).toContain('კლუბები და შემადგენლობები');
        expect(georgian.kinds.find(({ kind }) => kind === 'HEALTHCARE')?.nextStep).toContain('სამედიცინო ჩანაწერებზე წვდომას');
    });
});
