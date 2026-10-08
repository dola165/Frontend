import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../../context/AuthContext';
import { AgentDashboardPage } from '../../pages/AgentDashboardPage';
import { fetchAgentDashboard, fetchMyEngagements, fetchMyInterests, fetchRepresentationAttention, fetchClubApproachSummary } from './api';
import type { AgentDashboardData, AgentEngagement, AgentInterest } from './domain';
import { AgentHubFixture } from './__fixtures__/AgentHubFixture';
import { StrictMode } from 'react';

const copyLocale = vi.hoisted(() => ({ value: 'en' }));

vi.mock('./api', () => ({
    fetchAgentDashboard: vi.fn(),
    fetchMyEngagements: vi.fn(),
    fetchMyInterests: vi.fn(),
    fetchRepresentationAttention: vi.fn(),
    fetchClubApproachSummary: vi.fn()
}));
vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ i18n: { resolvedLanguage: copyLocale.value, language: copyLocale.value } })
}));

const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((promiseResolve, promiseReject) => {
        resolve = promiseResolve;
        reject = promiseReject;
    });
    return { promise, resolve, reject };
};

const dashboard: AgentDashboardData = {
    agencyName: 'North Star Agency',
    fifaLicenseNumber: 'FIFA-77',
    verified: true,
    activePlayerCount: 2,
    activeEngagementCount: 1,
    pendingEngagementCount: 1,
    portfolio: [
        {
            representationId: 11,
            playerUserId: null,
            fullName: null,
            username: null,
            avatarUrl: null,
            position: null,
            currentClubName: null,
            currentClubId: null,
            representationType: 'FULL',
            status: 'ACTIVE',
            startedAt: '2026-09-01',
            requiresMinorConsent: true,
            minorConsentStatus: 'PENDING'
        },
        {
            representationId: 12,
            playerUserId: 88,
            fullName: 'Adult Player',
            username: 'adult_player',
            avatarUrl: null,
            position: 'MIDFIELDER',
            currentClubName: 'Current FC',
            currentClubId: 4,
            representationType: 'FULL',
            status: 'ACTIVE',
            startedAt: '2026-08-01',
            requiresMinorConsent: false,
            minorConsentStatus: null
        }
    ]
};

const interests: AgentInterest[] = [
    {
        interestId: 21,
        listingId: 90,
        clubId: 4,
        clubName: 'Current FC',
        interestedByUserId: 44,
        interestedByName: 'Sporting Director',
        message: 'Can we arrange a private call?',
        status: 'EXPRESSED',
        createdAt: '2026-09-20T10:00:00'
    },
    {
        interestId: 22,
        listingId: null,
        clubId: 5,
        clubName: 'Historic FC',
        interestedByUserId: null,
        interestedByName: null,
        message: null,
        status: 'VIEWED',
        createdAt: '2026-08-20T10:00:00'
    }
];

const engagements: AgentEngagement[] = [
    {
        engagementId: 31,
        clubId: 4,
        clubName: 'Current FC',
        clubLogoUrl: null,
        status: 'PENDING',
        notes: 'Representation discussion',
        responseNotes: null,
        createdAt: '2026-09-18T10:00:00',
        respondedAt: null,
        agentUserId: 7,
        agentName: 'Agent User',
        agencyName: 'North Star Agency',
        agentAvatarUrl: null
    },
    {
        engagementId: 32,
        clubId: 5,
        clubName: 'Historic FC',
        clubLogoUrl: null,
        status: 'TERMINATED',
        notes: null,
        responseNotes: 'Closed by agreement',
        createdAt: '2026-07-18T10:00:00',
        respondedAt: '2026-08-18T10:00:00',
        agentUserId: 7,
        agentName: 'Agent User',
        agencyName: 'North Star Agency',
        agentAvatarUrl: null
    }
];

const renderPage = (entry = '/agent') => render(
    <MemoryRouter initialEntries={[entry]}>
        <AgentDashboardPage />
    </MemoryRouter>
);

describe('AgentDashboardPage', () => {
    let authState: ReturnType<typeof useAuth>;

    beforeEach(() => {
        vi.clearAllMocks();
        copyLocale.value = 'en';
        authState = {
            sessionId: 'agent-session-a',
            status: 'authenticated',
            user: { id: 7, role: 'AGENT', username: 'agent_user' }
        } as ReturnType<typeof useAuth>;
        vi.mocked(useAuth).mockImplementation(() => authState);
        vi.mocked(fetchAgentDashboard).mockResolvedValue(dashboard);
        vi.mocked(fetchMyInterests).mockResolvedValue(interests);
        vi.mocked(fetchMyEngagements).mockResolvedValue(engagements);
        vi.mocked(fetchRepresentationAttention).mockResolvedValue(0);
        vi.mocked(fetchClubApproachSummary).mockResolvedValue({active: 0, pending: 0});
    });

    it('counts incoming representation decisions and opens their portfolio inbox', async () => {
        vi.mocked(fetchRepresentationAttention).mockResolvedValue(2);
        renderPage();
        expect(await screen.findByRole('heading', { name: '5 items need attention' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Representation requests/ }));
        expect(screen.getByRole('tabpanel', { name: 'Portfolio' })).toBeInTheDocument();
    });

    it('includes consented club approaches in attention and refreshes after an approach changes', async () => {
        vi.mocked(fetchClubApproachSummary).mockResolvedValue({active: 2, pending: 3});
        renderPage();
        expect(await screen.findByRole('heading', { name: '6 items need attention' })).toBeInTheDocument();
        vi.mocked(fetchClubApproachSummary).mockResolvedValue({active: 3, pending: 2});
        act(() => window.dispatchEvent(new Event('club-approaches-updated')));
        expect(await screen.findByRole('heading', { name: '5 items need attention' })).toBeInTheDocument();
    });

    it('prioritizes enquiries, consent, and the club decision without exposing pending identity', async () => {
        renderPage();

        expect(await screen.findByRole('heading', { name: '3 items need attention' })).toBeInTheDocument();
        fireEvent.click(screen.getAllByRole('tab', { name: /Portfolio/ })[0]);

        expect(await screen.findByText('Protected representation request')).toBeInTheDocument();
        expect(screen.getByText('Identity and club details are withheld under the current privacy boundary.')).toBeInTheDocument();
        expect(screen.getByText('Adult Player')).toBeInTheDocument();
        expect(screen.queryByText('Pending Player')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Add Player/i })).not.toBeInTheDocument();
    });

    it('shows agent-owned enquiries and links only an available contact to private messaging', async () => {
        renderPage('/agent?tab=inbox');

        expect(await screen.findByRole('heading', { name: 'Agent inbox' })).toBeInTheDocument();
        expect(screen.getByText('Can we arrange a private call?')).toBeInTheDocument();
        expect(screen.getByText(/Message content is hidden because the listing is closed/)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Message contact/ })).toHaveAttribute('href', '/messages?chatWith=44');
        expect(screen.getByText('No message destination is available.')).toBeInTheDocument();
        expect(screen.queryByText(/club workspace/i)).not.toBeInTheDocument();
    });

    it('supports arrow navigation and a single tab stop per desktop/mobile tab list', async () => {
        renderPage();
        await screen.findByRole('heading', { name: '3 items need attention' });
        const overviewTabs = screen.getAllByRole('tab', { name: /Overview/ });
        overviewTabs[0].focus();
        fireEvent.keyDown(overviewTabs[0], { key: 'ArrowDown' });
        const inboxTabs = screen.getAllByRole('tab', { name: /Enquiries/ });
        expect(inboxTabs[0]).toHaveFocus();
        expect(inboxTabs[0]).toHaveAttribute('aria-selected', 'true');
        expect(overviewTabs[0]).toHaveAttribute('tabindex', '-1');
        expect(screen.getByRole('tabpanel', { name: 'Enquiries' })).toBeInTheDocument();
        inboxTabs[1].focus();
        fireEvent.keyDown(inboxTabs[1], { key: 'End' });
        const relationships = screen.getAllByRole('tab', { name: /Club relationships/ });
        expect(relationships[1]).toHaveFocus();
        fireEvent.keyDown(relationships[1], { key: 'ArrowRight' });
        expect(screen.getAllByRole('tab', { name: /Overview/ })[1]).toHaveFocus();
    });

    it('keeps relationships read-only and explains pending and ended states', async () => {
        renderPage('/agent?tab=relationships');

        expect(await screen.findByText('Awaiting club decision')).toBeInTheDocument();
        expect(screen.getByText('Relationship ended')).toBeInTheDocument();
        expect(screen.getByText(/agent-side withdrawal is not available yet/i)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Initiate/i })).not.toBeInTheDocument();
    });

    it('offers a stable retry after a failed hub load', async () => {
        vi.mocked(fetchAgentDashboard).mockRejectedValueOnce(new Error('offline'));
        renderPage();

        expect(await screen.findByText('Your agent hub could not load. No private club data was used. Please try again.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

        await waitFor(() => expect(fetchAgentDashboard).toHaveBeenCalledTimes(2));
        expect(await screen.findByRole('heading', { name: '3 items need attention' })).toBeInTheDocument();
    });

    it('finishes loading through the StrictMode setup-cleanup-setup cycle', async () => {
        render(<StrictMode><MemoryRouter initialEntries={['/agent']}><AgentDashboardPage /></MemoryRouter></StrictMode>);
        expect(await screen.findByRole('heading', { name: '3 items need attention' })).toBeInTheDocument();
        expect(fetchAgentDashboard).toHaveBeenCalled();
    });

    it('re-keys on account switches, clears old data, and ignores delayed responses from the retired session', async () => {
        const oldDashboard = deferred<AgentDashboardData>();
        const oldInterests = deferred<AgentInterest[]>();
        const oldEngagements = deferred<AgentEngagement[]>();
        const secondDashboard = deferred<AgentDashboardData>();
        const secondInterests = deferred<AgentInterest[]>();
        const secondEngagements = deferred<AgentEngagement[]>();
        const second = { ...dashboard, agencyName: 'Second Agency', portfolio: [], activePlayerCount: 0 };

        vi.mocked(fetchAgentDashboard).mockImplementation(config =>
            config?._authSessionId === 'agent-session-a' ? oldDashboard.promise : secondDashboard.promise);
        vi.mocked(fetchMyInterests).mockImplementation(config =>
            config?._authSessionId === 'agent-session-a' ? oldInterests.promise : secondInterests.promise);
        vi.mocked(fetchMyEngagements).mockImplementation((_status, config) =>
            config?._authSessionId === 'agent-session-a' ? oldEngagements.promise : secondEngagements.promise);

        const view = renderPage();
        authState = {
            sessionId: 'agent-session-b',
            status: 'authenticated',
            user: { id: 8, role: 'AGENT', username: 'second_agent' }
        } as ReturnType<typeof useAuth>;
        view.rerender(<MemoryRouter initialEntries={['/agent']}><AgentDashboardPage /></MemoryRouter>);

        expect(screen.queryByText('North Star Agency')).not.toBeInTheDocument();
        await act(async () => {
            secondDashboard.resolve(second);
            secondInterests.resolve([]);
            secondEngagements.resolve([]);
        });
        expect((await screen.findAllByText('Second Agency')).length).toBeGreaterThan(0);

        await act(async () => {
            oldDashboard.resolve(dashboard);
            oldInterests.resolve(interests);
            oldEngagements.resolve(engagements);
        });
        expect(screen.queryByText('North Star Agency')).not.toBeInTheDocument();
        expect(screen.getAllByText('Second Agency').length).toBeGreaterThan(0);
    });

    it('opens the hub for a server-issued agent capability alongside a different account role', async () => {
        authState = { ...authState, user: { ...authState.user!, role: 'PARENT', navigationCapabilities: {
            version: 1, workspaces: [{ id: 'agent.hub', context: { type: 'user', id: 7, label: 'Agent Hub' } }]
        } } };
        renderPage();
        expect(await screen.findByRole('heading', { name: '3 items need attention' })).toBeInTheDocument();
        expect(fetchAgentDashboard).toHaveBeenCalledOnce();
    });

    it('does not overlap refreshes while the initial hub request is still pending', async () => {
        const pending = deferred<AgentDashboardData>();
        vi.mocked(fetchAgentDashboard).mockReturnValue(pending.promise);
        renderPage();
        fireEvent(window, new Event('focus'));
        fireEvent(window, new Event('representation-updated'));
        expect(fetchAgentDashboard).toHaveBeenCalledOnce();
        await act(async () => pending.resolve(dashboard));
        expect(await screen.findByRole('heading', { name: '3 items need attention' })).toBeInTheDocument();
    });

    it('refreshes accepted representations without unmounting the active workspace', async () => {
        renderPage();
        await screen.findByRole('heading', { name: '3 items need attention' });
        vi.mocked(fetchAgentDashboard).mockResolvedValue({ ...dashboard, agencyName: 'Updated Agency', activePlayerCount: 3 });
        fireEvent(window, new Event('representation-updated'));
        expect(screen.getByRole('heading', { name: '3 items need attention' })).toBeInTheDocument();
        expect((await screen.findAllByText('Updated Agency')).length).toBeGreaterThan(0);
        expect(fetchAgentDashboard).toHaveBeenCalledTimes(2);
    });

    it('does not fetch or render the Hub for a non-agent or logged-out session', () => {
        authState = {
            sessionId: 'fan-session',
            status: 'authenticated',
            user: { id: 9, role: 'FAN', username: 'fan_user' }
        } as ReturnType<typeof useAuth>;
        const view = renderPage();
        expect(fetchAgentDashboard).not.toHaveBeenCalled();
        expect(screen.queryByText('Agent Hub')).not.toBeInTheDocument();

        authState = { sessionId: 'logged-out', status: 'anonymous', user: null } as ReturnType<typeof useAuth>;
        view.rerender(<MemoryRouter initialEntries={['/agent']}><AgentDashboardPage /></MemoryRouter>);
        expect(fetchAgentDashboard).not.toHaveBeenCalled();
        expect(screen.queryByText('Agent Hub')).not.toBeInTheDocument();
    });

    it('renders the production presentation fixture in Georgian without global locale registration', async () => {
        copyLocale.value = 'ka';
        render(<MemoryRouter><AgentHubFixture variant="protected" /></MemoryRouter>);
        expect(await screen.findByRole('heading', { name: 'მოთამაშეთა პორტფელი' })).toBeInTheDocument();
        expect(screen.getByText('დაცული წარმომადგენლობის მოთხოვნა')).toBeInTheDocument();
        expect(screen.getByText('ვინაობისა და კლუბის დეტალები მოქმედი კონფიდენციალურობის წესებით დაფარულია.')).toBeInTheDocument();
    });
});
