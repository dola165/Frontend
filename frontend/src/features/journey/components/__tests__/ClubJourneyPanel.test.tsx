import { apiClient } from '../../../../api/axiosConfig';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '../../../../i18n';
import { ClubJourneyPanel } from '../ClubJourneyPanel';
const refreshNavigation = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const auth = vi.hoisted(() => ({ sessionId: 'journey-session' }));
vi.mock('../../../../context/AuthContext', () => ({ useAuth: () => ({ ...auth, refreshNavigationCapabilities: refreshNavigation }) }));
vi.mock('../../../../utils/authStorage', async importOriginal => ({
    ...await importOriginal<typeof import('../../../../utils/authStorage')>(),
    getAuthSessionId: () => auth.sessionId,
    isCurrentAuthSession: (id: string) => id === auth.sessionId,
}));
vi.mock('../ClubRelationships', () => ({ ClubRelationships: () => null }));
vi.mock('../../../organizations/setup/OrganizationInvitationInbox', () => ({ OrganizationInvitationInbox: () => null }));

vi.mock('react-router-dom', async importOriginal => ({...await importOriginal<typeof import('react-router-dom')>(),useNavigate:()=>vi.fn()}));
vi.mock('../../../../api/axiosConfig',()=>({apiClient:{get:vi.fn(),post:vi.fn()}}));

vi.mock('../../../clubs/api', () => ({
    fetchClubJourney: vi.fn(),
    cancelClubApplication: vi.fn().mockResolvedValue({ status: 'CANCELLED' }),
}));

vi.mock('../../../../utils/apiError', () => ({
    extractApiErrorMessage: vi.fn(() => 'Something went wrong.'),
}));

import { fetchClubJourney } from '../../../clubs/api';

const journeyPayload = {
    applications: [
        { applicationId: 601, clubId: 2, clubName: 'Metro United Academy', role: 'PLAYER', status: 'PENDING', createdAt: null, decisionMessage: null },
        { applicationId: 602, clubId: 3, clubName: 'Lakeside Athletic', role: 'PLAYER', status: 'DECLINED', createdAt: null, decisionMessage: 'This intake is full — try again at our next tryouts. Keep training!' },
    ],
    invitations: [
        { inviteId: 701, clubId: 4, clubName: 'Creekside FC', role: 'PLAYER', createdAt: null, expiresAt: null },
    ],
    tryouts: [
        { tryoutApplicationId: 801, tryoutId: 11, clubId: 2, clubName: 'Metro United Academy', title: 'U15 Open Tryout', tryoutDate: null, status: 'ACCEPTED', decisionMessage: 'Bring boots.' },
    ],
    affiliations: [
        { clubId: 2, clubName: 'Metro United Academy', status: 'TRIALIST', squadName: 'U15', trialEndsOn: '2026-09-01', consentStatus: 'PENDING', joinedAt: null, endedAt: null },
    ],
    recentDecisions: [
        { kind: 'APPLICATION' as const, clubName: 'Lakeside Athletic', status: 'DECLINED', decidedAt: null, message: 'This intake is full.' },
    ],
};

describe('ClubJourneyPanel — phase A4', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        auth.sessionId = 'journey-session';
        vi.mocked(fetchClubJourney).mockResolvedValue(journeyPayload);
        const receipts=journeyPayload.applications.map(app=>({...app,id:app.applicationId,applicantName:'Test player',jobId:null,jobTitle:null,message:null,canWithdraw:app.status==='PENDING',canRespond:false,canOffer:false,canCancelOffer:false,unavailableReason:null,offer:null}));
        vi.mocked(apiClient.get).mockImplementation(async url=>({data:String(url)==='/recruitment/applications'?receipts:String(url).startsWith('/recruitment/applications/')?receipts.find(r=>String(r.id)===String(url).split('/').pop()):[]}));
        vi.mocked(apiClient.post).mockImplementation(async()=>{receipts[0].status='CANCELLED';receipts[0].canWithdraw=false;return {data:{status:'CANCELLED'}};});
    });

    it('renders the status pills with counts', async () => {
        render(<MemoryRouter><ClubJourneyPanel /></MemoryRouter>);
        await waitFor(() => expect(screen.getByText(/On trial · 1/)).toBeInTheDocument());
        expect(screen.getByText(/Applied · 1/)).toBeInTheDocument();
        expect(screen.getByText(/Invited · 1/)).toBeInTheDocument();
        expect(screen.getByText(/Member · 0/)).toBeInTheDocument();
        expect(screen.getByText(/Not accepted · 1/)).toBeInTheDocument();
    });

    it('renders affiliations, applications, tryouts and decisions', async () => {
        render(<MemoryRouter><ClubJourneyPanel /></MemoryRouter>);
        await waitFor(() => expect(screen.getAllByText(/Metro United Academy/).length).toBeGreaterThanOrEqual(1));
        expect(screen.getByText('This intake is full — try again at our next tryouts. Keep training!')).toBeInTheDocument();
        expect(screen.getByText(/U15 Open Tryout/)).toBeInTheDocument();
        expect(screen.getByText(/Lakeside Athletic · Declined/)).toBeInTheDocument();
    });

    it('cancels a pending application and refreshes', async () => {
        render(<MemoryRouter><ClubJourneyPanel /></MemoryRouter>);
        await waitFor(() => expect(screen.getByText(/Applied · 1/)).toBeInTheDocument());
        fireEvent.click(await screen.findByRole('button', { name: 'Withdraw application' }));
        expect(apiClient.post).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
        await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/clubs/2/applications/601/cancel'));
        await waitFor(() => expect(fetchClubJourney).toHaveBeenCalledTimes(2)); // initial + refresh
    });

    it('sends an invitation to the Inbox, where it is answered', async () => {
        render(<MemoryRouter><ClubJourneyPanel /></MemoryRouter>);
        expect((await screen.findByRole('link', { name: 'Answer in your Inbox' })).getAttribute('href')).toBe('/requests?view=needs-you');
        expect(screen.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument();
    });

    it('shows the empty state when there is no activity', async () => {
        vi.mocked(fetchClubJourney).mockResolvedValue({
            applications: [], invitations: [], tryouts: [], affiliations: [], recentDecisions: [],
        });
        render(<MemoryRouter><ClubJourneyPanel /></MemoryRouter>);
        await waitFor(() => expect(screen.getByText(/No club activity yet/)).toBeInTheDocument());
    });

    it('drops an invitation cancelled elsewhere when the account panel regains focus', async () => {
        render(<MemoryRouter><ClubJourneyPanel /></MemoryRouter>);
        await screen.findByRole('link', { name: 'Answer in your Inbox' });
        vi.mocked(fetchClubJourney).mockResolvedValue({ ...journeyPayload, invitations: [] });
        await act(async () => { window.dispatchEvent(new Event('focus')); });
        await waitFor(() => expect(screen.queryByRole('link', { name: 'Answer in your Inbox' })).not.toBeInTheDocument());
    });
});
