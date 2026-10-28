import userEvent from '@testing-library/user-event';
import { ClubPeopleTab } from '../ClubPeopleTab';
import { ClubFacilitiesTab } from '../ClubFacilitiesTab';
import '../../../../i18n';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { apiClient } from '../../../../api/axiosConfig';
import { refreshAccess } from '../../../../hooks/useCan';
import type { ClubPresentation, TrainingProgramme } from '../../presentation';
import { ClubActions } from '../ClubActions';
import { ClubAboutTab } from '../ClubAboutTab';
import { ClubContactTab } from '../ClubInfoTabs';
import { feeRange } from '../fees';
import { ClubSide } from '../ClubSide';
import { ClubTeamsTab } from '../ClubTeamsTab';
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
    refreshAccess();
    vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
        if (url.startsWith('/posts/club/')) return { data: { posts: [{ id: 5, content: 'Season opener on Saturday', createdAt: new Date().toISOString(), authorName: 'Alpha FC', likeCount: 0, commentCount: 0, isLikedByMe: false }], nextCursor: null } };
        if (url.startsWith('/store/products') || url.startsWith('/campaigns')) return { data: { content: [], totalElements: 0 } };
        return { data: [] };
    });
});

describe('club profile', () => {
    it('shows only confirmed affiliations, published sponsors and safe links, with scoped ways to get involved (staff see the empty ones)', async () => {
        page(<ClubSide club={club} canEdit />);

        expect(screen.queryByText('Pending academy')).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Manage Confirmed academy profile' })).toHaveAttribute('href', '/clubs/2/profile-settings');
        expect(screen.getByRole('link', { name: /Local business/ })).toHaveAttribute('rel', 'noopener noreferrer');
        expect(screen.queryByText('Draft sponsor')).not.toBeInTheDocument();
        expect(screen.queryByText('Restricted sponsor')).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Website' })).not.toBeInTheDocument();
        const involved = within(screen.getByRole('list', { name: 'Ways to get involved' }));
        expect(involved.getByRole('link', { name: /Club store/ })).toHaveAttribute('href', '/clubs/10?tab=involved');
        expect(involved.getByRole('link', { name: /Club fundraising/ })).toHaveAttribute('href', '/clubs/10?tab=involved&show=fundraising');
        expect(involved.getByRole('link', { name: /Club jobs/ })).toHaveAttribute('href', '/clubs/10?tab=involved&show=jobs');
        expect(await screen.findByText('No jobs or volunteering published')).toBeInTheDocument();
    });

    it('never shows visitors an empty way to get involved', async () => {
        page(<ClubSide club={club} />);
        await waitFor(() => expect(screen.queryByText('Loading…')).not.toBeInTheDocument());
        expect(screen.queryByText('No jobs or volunteering published')).not.toBeInTheDocument();
    });

    it('tells the story first, then the latest news and what is coming up', async () => {
        page(<ClubAboutTab club={club} can={visitor} />);
        const post = await screen.findByText('Season opener on Saturday');
        const about = screen.getByRole('heading', { name: 'About' });
        const coming = screen.getByRole('heading', { name: 'Coming up' });
        expect(about.compareDocumentPosition(post) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(post.compareDocumentPosition(coming) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(screen.getByText('Youth football')).toBeInTheDocument();
    });

    it('shows the web addresses in the club’s story as links that open in a new tab, and nothing else', () => {
        page(<ClubAboutTab club={{ ...club, description: 'Fixtures on rustavi-lions.ge/fixtures. Write to info@rustavi-lions.ge.' }} can={visitor} />);
        const link = screen.getByRole('link', { name: 'rustavi-lions.ge/fixtures' });
        expect(link).toHaveAttribute('href', 'https://rustavi-lions.ge/fixtures');
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        expect(screen.queryByRole('link', { name: /info@/ })).not.toBeInTheDocument();
    });

    it('lists the club’s website, Instagram and Facebook under Online, http(s) only', () => {
        page(<ClubContactTab club={{ ...club, websiteUrl: 'https://rustavi-lions.ge', instagramUrl: 'https://www.instagram.com/rustavi.lions', facebookUrl: 'https://www.facebook.com/rustavilions', facebookMessengerUrl: 'javascript:alert(1)' }} />);
        expect(screen.getByRole('link', { name: 'Website' })).toHaveAttribute('href', 'https://rustavi-lions.ge/');
        expect(screen.getByRole('link', { name: 'Instagram' })).toHaveAttribute('href', 'https://www.instagram.com/rustavi.lions');
        expect(screen.getByRole('link', { name: 'Facebook' })).toHaveAttribute('href', 'https://www.facebook.com/rustavilions');
        expect(screen.queryByRole('link', { name: 'Messenger' })).not.toBeInTheDocument();
    });

    it('lists the squads and the current published fees, and clears old or draft offers', async () => {
        vi.mocked(apiClient.get).mockImplementation(async (url: string) => url.startsWith('/clubs/10/squads') ? { data: [{ id: 3, name: 'U12 Boys', category: 'U12', gender: 'MALE' }] } : { data: [] });
        page(<ClubTeamsTab club={club} onContact={vi.fn()} isAuthenticated />);
        expect(await screen.findByRole('link', { name: /U12 Boys/ })).toHaveAttribute('href', '/clubs/10?tab=teams&squad=3');
        expect(screen.getByRole('link', { name: /U12 training/ })).toHaveAttribute('href', '/clubs/10?tab=teams&programme=22');
        expect(screen.getByText(/150 GEL \/ month/)).toBeInTheDocument();
        expect(screen.queryByText('Draft group')).not.toBeInTheDocument();
        expect(screen.getByText('Old offer')).toBeInTheDocument();
        expect(feeRange(presentation.programmes)).toEqual({ range: '150 GEL / month', note: 'First session free' });
    });

    it('lets the club’s own staff arrange a match or post an open challenge from the page', async () => {
        vi.mocked(apiClient.get).mockImplementation(async (url: string) => url === '/access/clubs/10' ? { data: { allowed: ['arrange_match'], refused: [] } } : { data: [] });
        page(<ClubActions club={club} can={{ ...visitor, own: true, canManage: true, canOpenWorkspace: true, canJoin: false, canMessage: false, canChallenge: false }} onFollowChange={vi.fn()} onJoin={vi.fn()} onMessage={vi.fn()} />);
        // Arranging opens over the club page once the rule-checker allows it.
        expect(await screen.findByRole('link', { name: 'Arrange a match' })).toHaveAttribute('href', '/?do=arrange_match');
        expect(screen.getByRole('link', { name: 'Open challenge' })).toHaveAttribute('href', '/world/matches?tab=mine&peek=arrange-open');
        expect(screen.getByRole('link', { name: 'Club office' })).toHaveClass('gk-btn--primary');
    });

    it('gives another club’s staff a way to propose a match, and everyone else one primary way in', () => {
        const view = page(<ClubActions club={club} can={{ ...visitor, canChallenge: true, myClubId: 1 }} onFollowChange={vi.fn()} onJoin={vi.fn()} onMessage={vi.fn()} />);
        expect(screen.getByRole('link', { name: 'Propose a match' })).toHaveAttribute('href', '/world/matches?tab=mine&peek=arrange-direct.c10');
        expect(screen.queryByRole('button', { name: 'Join' })).not.toBeInTheDocument();
        view.unmount();
        page(<ClubActions club={club} can={visitor} onFollowChange={vi.fn()} onJoin={vi.fn()} onMessage={vi.fn()} />);
        expect(screen.getByRole('button', { name: 'Join' })).toHaveClass('gk-btn--primary');
        expect(screen.getByRole('button', { name: 'Follow' })).not.toHaveClass('gk-btn--primary');
        expect(screen.queryByRole('link', { name: 'Propose a match' })).not.toBeInTheDocument();
    });
});


it('uses the compact department hierarchy as the sole staff view and keeps published scopes', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [{ userId: 91, fullName: 'Nino Coach', role: 'COACH', responsibilities: [
        { title: 'Head of coaching', specialisations: ['HEAD_COACH'], squadId: null, squadName: null, clubWide: true, startsOn: '2025-01-01', endsOn: null },
        { title: 'Physiotherapist', specialisations: ['PHYSIO'], squadId: 8, squadName: 'U12 Girls', startsOn: '2025-01-01', endsOn: '2027-01-01' },
    ] }] });
    page(<ClubPeopleTab clubId={10} clubName="Alpha FC" canManageStaff={false} />);
    expect(await screen.findByRole('region', { name: 'Coaching' })).toBeInTheDocument();
    const care = within(screen.getByRole('region', { name: 'Medical & player care' }));
    expect(care.getByText('Physiotherapist', { selector: 'strong' })).toBeInTheDocument();
    expect(care.getByText('U12 Girls')).toBeInTheDocument();
    expect(screen.getByText('Across the club')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cards' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'List' })).not.toBeInTheDocument();
});

it('shows facilities as reusable cards with their own directions action', async () => {
    vi.mocked(apiClient.get).mockImplementation(async (url: string) => ({ data: url.endsWith('/facilities') ? [{ id: 19, title: 'Lions Ground', details: { type: 'VENUE', address: 'Match Street 1', description: 'Use the west gate.' } }] : [] }));
    page(<ClubFacilitiesTab club={club} canEdit={false} />);
    const heading = await screen.findByRole('heading', { name: 'Lions Ground' });
    const card = within(heading.closest('article')!);
    expect(card.getByText('Match Street 1')).toBeInTheDocument();
    expect(card.getByRole('button', { name: 'Get directions' })).toBeInTheDocument();
});


it('opens a location from its URL, keeps directions and suppresses rental destinations on the club tab', async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.get).mockImplementation(async (url: string) => ({ data: url.endsWith('/facilities') ? [{ id: 19, title: 'Lions Ground', details: { placeType: 'VENUE', address: 'Match Street 1' }, linkedVenue: { id: 9, name: 'Municipal ground', bookingAvailable: true } }] : [] }));
    render(<MemoryRouter initialEntries={['/clubs/10?tab=facilities&place=19']}><ClubFacilitiesTab club={club} canEdit={false} /></MemoryRouter>);
    const dialog = within(await screen.findByRole('dialog', { name: 'Lions Ground' }));
    expect(dialog.getByRole('button', { name: 'Get directions' })).toBeInTheDocument();
    expect(dialog.queryByRole('link', { name: 'Rental availability' })).not.toBeInTheDocument();
    expect(dialog.queryByRole('link', { name: 'View venue page' })).not.toBeInTheDocument();
    await user.click(dialog.getByRole('button', { name: 'Close location details' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'View ground' }));
    expect(await screen.findByRole('dialog', { name: 'Lions Ground' })).toBeInTheDocument();
});
