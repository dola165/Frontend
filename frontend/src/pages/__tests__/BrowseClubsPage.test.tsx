import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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
    extractApiErrorMessage: vi.fn((_err: unknown) => 'Something went wrong.'),
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

    it('shows OPEN TRIAL badge with emerald styling', async () => {
        (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
            data: [makeClub({ joinPolicy: 'OPEN_TRIAL' })],
        });
        renderPage();
        const badge = await screen.findByText('OPEN TRIAL');
        expect(badge).toBeInTheDocument();
        expect(badge.className).toMatch(/emerald/);
    });

    it('shows APPLICATION REQUIRED badge with amber styling', async () => {
        (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
            data: [makeClub({ joinPolicy: 'APPLICATION_REQUIRED' })],
        });
        renderPage();
        const badge = await screen.findByText('APPLICATION REQUIRED');
        expect(badge).toBeInTheDocument();
        expect(badge.className).toMatch(/amber/);
    });

    it('shows INVITE ONLY badge with purple styling', async () => {
        (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
            data: [makeClub({ joinPolicy: 'INVITE_ONLY' })],
        });
        renderPage();
        const badge = await screen.findByText('INVITE ONLY');
        expect(badge).toBeInTheDocument();
        expect(badge.className).toMatch(/purple/);
    });

    it('does not render joinPolicy badge when policy is not set', async () => {
        (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
            data: [makeClub({ joinPolicy: undefined })],
        });
        renderPage();
        await screen.findByText('Test Club');
        expect(screen.queryByText('OPEN TRIAL')).not.toBeInTheDocument();
        expect(screen.queryByText('APPLICATION REQUIRED')).not.toBeInTheDocument();
        expect(screen.queryByText('INVITE ONLY')).not.toBeInTheDocument();
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
        expect(await screen.findByText('OPEN TRIAL')).toBeInTheDocument();
        expect(screen.getByText('INVITE ONLY')).toBeInTheDocument();
        // Gamma has no badge, but all three club names are rendered
        expect(screen.getByText('Alpha')).toBeInTheDocument();
        expect(screen.getByText('Beta')).toBeInTheDocument();
        expect(screen.getByText('Gamma')).toBeInTheDocument();
    });
});
