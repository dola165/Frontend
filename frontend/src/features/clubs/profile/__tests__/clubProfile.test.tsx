import '../../../../i18n';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { apiClient } from '../../../../api/axiosConfig';
import type { ClubPresentation, TrainingProgramme } from '../../presentation';
import { ClubActions } from '../ClubActions';
import { ClubOverviewTab } from '../ClubOverviewTab';
import { ClubSide } from '../ClubSide';
import type { ClubPermissions } from '../useClubProfile';
import type { ClubProfile } from '../types';

vi.mock('../../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 7, role: 'FAN' }, sessionId: 's', status: 'authenticated' }) }));
vi.mock('../../../../api/axiosConfig', () => ({ DEPLOYMENT_URLS: { mediaBaseUrl: 'http://localhost:8080' }, apiClient: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));

const programme: TrainingProgramme = { id: 22, name: 'U12 training', ageMin: 8, ageMax: 12, sessionsPerWeek: 2, priceType: 'FIXED', amount: '150', currency: 'GEL', billingPeriod: 'MONTH', trialAmount: '0', joiningFee: null, equipmentFee: null, details: null, published: true };
const presentation: ClubPresentation = {
    profileKind: 'ACADEMY', revision: 1, canEdit: false,
    programmes: [programme, { ...programme, id: 23, name: 'Draft group', published: false }, { ...programme, id: 24, name: 'Old offer', validUntil: '2000-01-01' }],
    sponsors: [{ id: 1, name: 'Local business', logoUrl: null, websiteUrl: 'https://example.com', organizationId: null, published: true },
        { id: 2, name: 'Draft sponsor', logoUrl: null, websiteUrl: null, organizationId: null, published: false },
        { id: 3, name: 'Restricted sponsor', logoUrl: null, websiteUrl: 'https://example.com', organizationId: null, published: true, promotionBlocked: true }],
    affiliations: [{ id: 1, clubId: 2, name: 'Confirmed academy', logoUrl: null, profileKind: 'ACADEMY', status: 'ACTIVE', canRespond: false, canManageProfile: true },
        { id: 2, clubId: 3, name: 'Pending academy', logoUrl: null, profileKind: 'ACADEMY', status: 'PENDING', canRespond: false }],
};
const club = { id: 10, name: 'Alpha FC', description: 'Youth football', type: 'ACADEMY', isOfficial: true, statusLabel: '', followerCount: 3, memberCount: 2, isFollowedByMe: false,
    isStaffMember: false, isMember: false, trustedByClubs: [], honours: [], opportunities: [], presentation, websiteUrl: 'javascript:alert(1)', email: 'hello@alpha.ge' } as ClubProfile;
const visitor: ClubPermissions = { role: null, own: false, connected: false, isLeader: false, canManage: false, canOpenWorkspace: false, invitationOnly: false, canEditFacilities: false,
    canManageStaff: false, canPost: false, canMessage: true, canFollow: true, canChallenge: false, canJoin: true, myClubId: null };
const page = (node: React.ReactNode) => render(<MemoryRouter>{node}</MemoryRouter>);

beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
        if (url.startsWith('/posts/club/')) return { data: { posts: [{ id: 5, content: 'Season opener on Saturday', createdAt: new Date().toISOString(), authorName: 'Alpha FC', likeCount: 0, commentCount: 0, isLikedByMe: false }], nextCursor: null } };
        if (url.startsWith('/store/products') || url.startsWith('/campaigns')) return { data: { content: [], totalElements: 0 } };
        return { data: [] };
    });
});

describe('club profile', () => {
    it('shows only confirmed affiliations, published sponsors and safe links, with scoped ways to get involved', async () => {
        page(<ClubSide club={club} />);
        expect(screen.getByRole('link', { name: /^Confirmed academy/ })).toHaveAttribute('href', '/clubs/2');
        expect(screen.queryByText('Pending academy')).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Manage Confirmed academy profile' })).toHaveAttribute('href', '/clubs/2/profile-settings');
        expect(screen.getByRole('link', { name: /Local business/ })).toHaveAttribute('rel', 'noopener noreferrer');
        expect(screen.queryByText('Draft sponsor')).not.toBeInTheDocument();
        expect(screen.queryByText('Restricted sponsor')).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Website' })).not.toBeInTheDocument();
        const involved = within(screen.getByRole('list', { name: 'Ways to get involved' }));
        expect(involved.getByRole('link', { name: /Store/ })).toHaveAttribute('href', '/clubs/10/store');
        expect(involved.getByRole('link', { name: /Campaigns/ })).toHaveAttribute('href', '/clubs/10/campaigns');
        expect(involved.getByRole('link', { name: /Roles/ })).toHaveAttribute('href', '/clubs/10?tab=business&opportunity=jobs');
        expect(await screen.findByText('No open roles published')).toBeInTheDocument();
    });

    it('leads a newcomer with the latest posts and a follow or join call, then training with published current fees', async () => {
        page(<ClubOverviewTab club={club} can={visitor} onFollow={vi.fn()} onJoin={vi.fn()} />);
        const post = await screen.findByText('Season opener on Saturday');
        const call = screen.getByRole('heading', { name: 'Keep up with Alpha FC' });
        const coming = screen.getByRole('heading', { name: 'Coming up' });
        expect(post.compareDocumentPosition(call) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(call.compareDocumentPosition(coming) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(screen.getByRole('link', { name: /U12 training/ })).toHaveAttribute('href', '/clubs/10?tab=teams&programme=22');
        expect(screen.getByText(/150 GEL \/ month/)).toBeInTheDocument();
        expect(screen.queryByText('Draft group')).not.toBeInTheDocument();
        expect(screen.queryByText('Old offer')).not.toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: 'See how to join' }).length).toBeGreaterThan(0);
    });

    it('gives another club’s staff a way to propose a match, and everyone else one primary way in', () => {
        const view = page(<ClubActions club={club} can={{ ...visitor, canChallenge: true, myClubId: 1 }} onFollow={vi.fn()} onJoin={vi.fn()} onMessage={vi.fn()} onSettings={vi.fn()} />);
        expect(screen.getByRole('link', { name: 'Propose a match' })).toHaveAttribute('href', '/world/matches/arrange?opponent=10');
        expect(screen.queryByRole('button', { name: 'Join' })).not.toBeInTheDocument();
        view.unmount();
        page(<ClubActions club={club} can={visitor} onFollow={vi.fn()} onJoin={vi.fn()} onMessage={vi.fn()} onSettings={vi.fn()} />);
        expect(screen.getByRole('button', { name: 'Join' })).toHaveClass('gk-btn--primary');
        expect(screen.getByRole('button', { name: 'Follow' })).not.toHaveClass('gk-btn--primary');
        expect(screen.queryByRole('link', { name: 'Propose a match' })).not.toBeInTheDocument();
    });
});
