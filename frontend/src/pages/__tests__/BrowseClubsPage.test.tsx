import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import '../../i18n';
import { BrowseClubsPage } from '../../pages/BrowseClubsPage';

vi.mock('../../api/axiosConfig', () => ({
    apiClient: {
        get: vi.fn(),
    },
}));

vi.mock('../../context/AuthContext', () => ({
    useAuth: vi.fn(),
}));

vi.mock('../../utils/apiError', () => ({
    extractApiErrorMessage: vi.fn(() => 'Something went wrong.'),
}));

vi.mock('../../features/clubs/api', () => ({
    createClubApplication: vi.fn(),
    fetchMyClubMembershipContext: vi.fn(),
    selfRegisterClubPlayer: vi.fn(),
}));

vi.mock('../../utils/resolveMediaUrl', () => ({
    resolveMediaUrl: vi.fn((url?: string) => url ?? null),
}));

import { apiClient } from '../../api/axiosConfig';
import { useAuth } from '../../context/AuthContext';
import { fetchMyClubMembershipContext } from '../../features/clubs/api';

interface ClubProfile {
    id: number;
    name: string;
    description: string;
    type: string;
    isOfficial: boolean;
    followerCount: number;
    memberCount: number;
    isFollowedByMe: boolean;
    addressText?: string;
    logoUrl?: string;
    joinPolicy?: 'OPEN_TRIAL' | 'APPLICATION_REQUIRED' | 'INVITE_ONLY';
    relationshipState?: 'NONE' | 'INVITED' | 'APPLIED' | 'TRIALIST' | 'ACTIVE' | 'LEFT' | 'REMOVED';
}

const makeClub = (overrides: Partial<ClubProfile> = {}): ClubProfile => ({
    id: 1,
    name: 'Test Club',
    description: 'A club for testing',
    type: 'Football',
    isOfficial: false,
    followerCount: 100,
    memberCount: 20,
    isFollowedByMe: false,
    ...overrides,
});

const renderPage = () =>
    render(
        <MemoryRouter>
            <BrowseClubsPage />
        </MemoryRouter>
    );

const getPolicyBadges = (label: string) => screen.getAllByText(label).filter((element) => element.tagName === 'SPAN');

const LocationProbe = () => {
    const location = useLocation();
    const navigate = useNavigate();
    return <><output data-testid="directory-url">{location.search}</output>
        <button onClick={() => navigate('/clubs?type=ACADEMY')}>Saved directory</button>
        <button onClick={() => navigate(-1)}>Back</button>
        <button onClick={() => navigate(1)}>Forward</button></>;
};

describe('directory request stability', () => {
    const pending: { resolve: (value: unknown) => void; reject: (error: Error) => void }[] = [];
    beforeEach(() => {
        vi.clearAllMocks();
        pending.length = 0;
        vi.mocked(useAuth).mockReturnValue({ status: 'authenticated', user: { id: 1 } } as ReturnType<typeof useAuth>);
        vi.mocked(fetchMyClubMembershipContext).mockResolvedValue(null as never);
        vi.mocked(apiClient.get).mockImplementation(() => new Promise((resolve, reject) => pending.push({ resolve, reject })));
    });
    const open = async () => {
        render(<MemoryRouter initialEntries={['/clubs']}><LocationProbe /><BrowseClubsPage /></MemoryRouter>);
        await act(async () => pending[0].resolve({ data: [makeClub()] }));
    };

    it('updates filters once, without refetching after a successful response', async () => {
        await open();
        fireEvent.click(screen.getByRole('button', { name: 'ACADEMY' }));
        await act(async () => pending[1].resolve({ data: [makeClub({ name: 'Academy result' })] }));
        expect(apiClient.get).toHaveBeenCalledTimes(2);
        expect(screen.getByTestId('directory-url')).toHaveTextContent('type=ACADEMY');
        expect(fetchMyClubMembershipContext).toHaveBeenCalledTimes(1);
    });

    it.each(['resolve', 'reject'] as const)('ignores an older %s after multiple filters change', async outcome => {
        await open();
        fireEvent.click(screen.getByRole('button', { name: 'ACADEMY' }));
        fireEvent.click(screen.getByRole('button', { name: 'OPEN TRIAL' }));
        await act(async () => pending[2].resolve({ data: [makeClub({ name: 'Latest result' })] }));
        await act(async () => {
            if (outcome === 'resolve') pending[1].resolve({ data: [makeClub({ name: 'Stale result' })] });
            else pending[1].reject(new Error('Stale failure'));
        });
        expect(screen.getByText('Latest result')).toBeInTheDocument();
        expect(screen.queryByText('Stale result')).not.toBeInTheDocument();
        expect(screen.queryByText('Something went wrong.')).not.toBeInTheDocument();
        expect(screen.getByTestId('directory-url')).toHaveTextContent('joinPolicy=OPEN_TRIAL');
        expect(apiClient.get).toHaveBeenCalledTimes(3);
    });

    it('keeps controls and existing results mounted while a filter request is pending, including empty results', async () => {
        await open();
        const heading = screen.getByRole('heading', { name: 'Club Directory' });
        const club = screen.getByText('Test Club');
        fireEvent.click(screen.getByRole('button', { name: 'ACADEMY' }));
        expect(screen.getByText('Test Club')).toBe(club);
        await act(async () => pending[1].resolve({ data: [] }));
        fireEvent.click(screen.getByRole('button', { name: 'OPEN TRIAL' }));
        expect(screen.getByRole('heading', { name: 'Club Directory' })).toBe(heading);
        expect(screen.getByRole('button', { name: 'ACADEMY' })).toBeInTheDocument();
    });

    it('restores back and forward URL filters without requests rewriting history', async () => {
        await open();
        fireEvent.click(screen.getByRole('button', { name: 'Saved directory' }));
        fireEvent.click(screen.getByRole('button', { name: 'Back' }));
        await act(async () => pending[1].resolve({ data: [makeClub({ name: 'Stale result' })] }));
        expect(screen.getByTestId('directory-url').textContent).toBe('');
        await act(async () => pending[2].resolve({ data: [makeClub()] }));
        fireEvent.click(screen.getByRole('button', { name: 'Forward' }));
        await act(async () => pending[3].resolve({ data: [makeClub({ name: 'Academy result' })] }));
        expect(screen.getByTestId('directory-url')).toHaveTextContent('type=ACADEMY');
        expect(apiClient.get).toHaveBeenCalledTimes(4);
    });
});

describe('BrowseClubsPage joinPolicy badges', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
            status: 'authenticated',
            isAuthenticated: true,
            user: { id: 1 },
        });
        (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
            data: [],
        });
        (fetchMyClubMembershipContext as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    });

    it('shows OPEN TRIAL badge with the semantic accent', async () => {
        (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
            data: [makeClub({ joinPolicy: 'OPEN_TRIAL' })],
        });
        renderPage();
        await screen.findByText('Test Club');
        const badges = await screen.findAllByText('OPEN TRIAL').then(() => getPolicyBadges('OPEN TRIAL'));
        expect(badges.length).toBeGreaterThan(0);
        badges.forEach((badge) => expect(badge.className).toContain("var(--color-accent)"));
    });

    it('shows APPLICATION REQUIRED badge with the semantic warning colour', async () => {
        (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
            data: [makeClub({ joinPolicy: 'APPLICATION_REQUIRED' })],
        });
        renderPage();
        await screen.findByText('Test Club');
        const badges = await screen.findAllByText('APPLICATION REQUIRED').then(() => getPolicyBadges('APPLICATION REQUIRED'));
        expect(badges.length).toBeGreaterThan(0);
        badges.forEach((badge) => expect(badge.className).toContain("var(--color-warning)"));
    });

    it('shows INVITE ONLY badge with the semantic purple colour', async () => {
        (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
            data: [makeClub({ joinPolicy: 'INVITE_ONLY' })],
        });
        renderPage();
        await screen.findByText('Test Club');
        const badges = await screen.findAllByText('INVITE ONLY').then(() => getPolicyBadges('INVITE ONLY'));
        expect(badges.length).toBeGreaterThan(0);
        badges.forEach((badge) => expect(badge.className).toContain("var(--color-purple)"));
    });

    it('does not render joinPolicy badge when policy is not set', async () => {
        (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
            data: [makeClub({ joinPolicy: undefined })],
        });
        renderPage();
        await screen.findByText('Test Club');
        expect(getPolicyBadges('OPEN TRIAL')).toHaveLength(0);
        expect(getPolicyBadges('APPLICATION REQUIRED')).toHaveLength(0);
        expect(getPolicyBadges('INVITE ONLY')).toHaveLength(0);
    });

    it('renders multiple clubs with mixed join policies', async () => {
        (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
            data: [
                makeClub({ id: 1, name: 'Alpha', joinPolicy: 'OPEN_TRIAL' }),
                makeClub({ id: 2, name: 'Beta', joinPolicy: 'INVITE_ONLY' }),
                makeClub({ id: 3, name: 'Gamma', joinPolicy: undefined }),
            ],
        });
        renderPage();
        await screen.findByText('Alpha');
        expect((await screen.findAllByText('OPEN TRIAL').then(() => getPolicyBadges('OPEN TRIAL'))).length).toBeGreaterThan(0);
        expect(getPolicyBadges('INVITE ONLY').length).toBeGreaterThan(0);
        // Gamma has no badge, but all three club names are rendered
        expect(screen.getByText('Alpha')).toBeInTheDocument();
        expect(screen.getByText('Beta')).toBeInTheDocument();
        expect(screen.getByText('Gamma')).toBeInTheDocument();
    });
});
