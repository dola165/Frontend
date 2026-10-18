import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import caseJson from './__fixtures__/place_offered.json?raw';
import homeJson from './__fixtures__/home.json?raw';
import inquiryJson from './__fixtures__/inquiry.json?raw';
import opportunitiesJson from './__fixtures__/opportunities.json?raw';
import type { AdmissionCase, AdmissionHome, AdmissionInquiry, OpportunityPage } from '../types';
import { claimAdmissionInvitation, fetchAdmissionCase, fetchAdmissionGroupSchedule, fetchAdmissionHome, fetchAdmissionInquiry, fetchOpportunity, submitAdmission } from '../api';
import { readSelectedPlayer, rememberSelectedPlayer } from '../../parents/playerSelection';
import { AdmissionCasePage } from './AdmissionCasePage';
import { AdmissionGroupSchedulePage } from './AdmissionGroupSchedulePage';
import { AdmissionHomePage } from './AdmissionHomePage';
import { AdmissionInvitationCard } from './AdmissionInvitationCard';
import { AdmissionInquiryPage } from './AdmissionInquiryPage';
import { OpportunityDetailPage } from './OpportunityDetailPage';

const auth = vi.hoisted(() => ({ user: { id: 77 }, sessionId: 'child-handoff-session', isAuthenticated: true }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../../utils/authStorage', () => ({ getAuthSessionId: () => auth.sessionId, isCurrentAuthSession: (id: string) => id === auth.sessionId }));
vi.mock('../../squadCommunication/journeyCopy', () => ({ useJourneyCopy: () => ((en: string) => en) }));
vi.mock('../../squadCommunication/useClubCrest', () => ({ useClubCrest: () => null }));
vi.mock('../../parents/AddChild', () => ({ AddChild: () => null }));
vi.mock('../api', () => ({
    fetchAdmissionCase: vi.fn(), fetchAdmissionGroupSchedule: vi.fn(), fetchAdmissionHome: vi.fn(), fetchAdmissionInquiry: vi.fn(),
    fetchOpportunity: vi.fn(), submitAdmission: vi.fn(), claimAdmissionInvitation: vi.fn(), commandAdmission: vi.fn(),
    commandAdmissionInquiry: vi.fn(), submitAdmissionInquiry: vi.fn(), reportAdmissionGuardianReview: vi.fn(),
    fetchLifecycleDates: vi.fn((caseId: number) => Promise.resolve({ caseId, caseVersion: 1, reviewDueAt: null, reviewTimezone: 'Asia/Tbilisi',
        reviewSource: 'NONE', reviewOverdue: false, reviewOwner: 'Admissions queue', departure: null,
        seasonCaseId: null, seasonGroupName: null, seasonDestination: null, actions: [] })),
}));

const home = () => {
    const value = JSON.parse(homeJson) as AdmissionHome;
    value.cases = [];
    value.participants.push({ ...value.participants[0], id: 102, name: 'Second child' });
    return value;
};
const record = (): AdmissionCase => ({ ...(JSON.parse(caseJson) as AdmissionCase), playerId: 102, playerName: 'Second child', actions: [] });
function Destination() {
    const location = useLocation();
    return <output data-testid="destination">{location.pathname}{location.search}</output>;
}
const workspaceLink = (name: string) => within(screen.getByRole('navigation', { name: 'Football workspace' })).getByRole('link', { name });
const showCase = (path: string) => render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/admissions/cases/:caseId" element={<AdmissionCasePage />} /></Routes></MemoryRouter>);

beforeEach(() => {
    vi.clearAllMocks(); sessionStorage.clear();
    rememberSelectedPlayer(auth.user.id, auth.sessionId, 101);
    vi.mocked(fetchAdmissionHome).mockResolvedValue(home());
    vi.mocked(fetchAdmissionCase).mockResolvedValue(record());
    const opportunity = (JSON.parse(opportunitiesJson) as OpportunityPage).items[0];
    vi.mocked(fetchOpportunity).mockResolvedValue(opportunity);
});
afterEach(cleanup);

describe('Selected child across joining handoffs', () => {
    it('uses the authorized case child for workspace links and tabs instead of a remembered sibling or stale URL', async () => {
        const c = record(); showCase(`/admissions/cases/${c.id}?player=101`);
        await screen.findByRole('heading', { name: c.groupName, level: 1 });
        expect(workspaceLink('Parent Hub')).toHaveAttribute('href', '/parent?player=102');
        expect(workspaceLink('Joining football')).toHaveAttribute('href', '/admissions?player=102');
        expect(screen.getByRole('link', { name: 'Agreement' })).toHaveAttribute('href', `/admissions/cases/${c.id}?player=102&tab=agreement`);
        expect(screen.getByRole('link', { name: 'Family connections' })).toHaveAttribute('href', '/parent?tab=connections&player=102');
        await waitFor(() => expect(readSelectedPlayer(auth.user.id, auth.sessionId)).toBe(102));
    });

    it('opens the enrolled child’s squad calendar with the exact player context', async () => {
        const c = record(); c.stage = 'ENROLLED';
        c.enrollment = { id: 400, groupId: c.groupId, groupName: c.groupName, startDate: '2099-09-01', endDate: null,
            status: 'ACTIVE', matchEligibility: 'NOT_GRANTED', squadId: 11, scheduleDestination: '/squads/11?tab=sessions' };
        vi.mocked(fetchAdmissionCase).mockResolvedValue(c); showCase(`/admissions/cases/${c.id}`);
        expect(await screen.findByRole('link', { name: 'Open group schedule' })).toHaveAttribute('href', '/squads/11?tab=schedule&player=102');
    });

    it('keeps the enrollment schedule’s playerId in its return and section links', async () => {
        const c = record(), o = (JSON.parse(opportunitiesJson) as OpportunityPage).items[0];
        vi.mocked(fetchAdmissionGroupSchedule).mockResolvedValue({ groupId: c.groupId, playerId: 102, groupName: c.groupName,
            schedule: 'Thursday at 17:00', timezone: 'Asia/Tbilisi', location: o.location, terms: o.terms, sessions: [] });
        render(<MemoryRouter initialEntries={[`/admissions/groups/${c.groupId}/schedule?playerId=102`]}><Routes>
            <Route path="/admissions/groups/:groupId/schedule" element={<AdmissionGroupSchedulePage />} />
        </Routes></MemoryRouter>);
        await screen.findByText(/Thursday at 17:00/);
        expect(workspaceLink('Parent Hub')).toHaveAttribute('href', '/parent?player=102');
        expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/admissions?player=102');
        expect(within(screen.getByRole('navigation', { name: 'Page sections' })).getByRole('link', { name: /^Sessions/ })).toHaveAttribute('href', `/admissions/groups/${c.groupId}/schedule?playerId=102&player=102&tab=sessions`);
    });

    it('carries the saved request’s child in the case destination', async () => {
        const o = (JSON.parse(opportunitiesJson) as OpportunityPage).items[0];
        vi.mocked(submitAdmission).mockResolvedValue(record());
        render(<MemoryRouter initialEntries={[`/admissions/opportunities/${o.id}?player=102`]}><Routes>
            <Route path="/admissions/opportunities/:opportunityId" element={<OpportunityDetailPage />} />
            <Route path="/admissions/cases/:caseId" element={<Destination />} />
        </Routes></MemoryRouter>);
        fireEvent.click(await screen.findByRole('button', { name: 'Request an introduction' }));
        await waitFor(() => expect(screen.getByTestId('destination')).toHaveTextContent(`/admissions/cases/${record().id}?player=102`));
        expect(submitAdmission).toHaveBeenCalledWith(expect.objectContaining({ playerId: 102, requestId: expect.any(String) }), auth.sessionId);
    });

    it('never remembers an unauthorized playerId from a rejected schedule link', async () => {
        vi.mocked(fetchAdmissionGroupSchedule).mockRejectedValue(new Error('This player is not available to you.'));
        render(<MemoryRouter initialEntries={['/admissions/groups/1/schedule?playerId=999']}><Routes>
            <Route path="/admissions/groups/:groupId/schedule" element={<AdmissionGroupSchedulePage />} />
        </Routes></MemoryRouter>);
        await screen.findByRole('alert');
        expect(readSelectedPlayer(auth.user.id, auth.sessionId)).toBe(101);
        expect(workspaceLink('Parent Hub')).toHaveAttribute('href', '/parent?player=101');
    });

    it('keeps an offline invitation’s chosen child when opening family connections and the saved case', async () => {
        vi.mocked(claimAdmissionInvitation).mockResolvedValue(record());
        render(<MemoryRouter><Routes><Route path="/" element={<AdmissionInvitationCard invitation={{ id: 41, version: 3, organizationId: 1,
            organizationName: 'Synthetic club', groupId: 1, groupName: 'Beginner group', intendedPlayerId: 102,
            message: 'Synthetic invitation', expiresAt: '2099-10-11T00:00:00Z', status: 'PENDING' }} participants={home().participants} onChanged={vi.fn()} />} />
            <Route path="/admissions/cases/:caseId" element={<Destination />} /></Routes></MemoryRouter>);
        expect(screen.getByRole('link', { name: 'Review secure family invitations' })).toHaveAttribute('href', '/parent?tab=connections&player=102');
        fireEvent.click(screen.getByLabelText('I confirm the named player and want to continue this recorded inquiry.'));
        fireEvent.click(screen.getByRole('button', { name: 'Continue this inquiry' }));
        await waitFor(() => expect(screen.getByTestId('destination')).toHaveTextContent(`/admissions/cases/${record().id}?player=102`));
    });

    it('uses the inquiry’s linked child when opening its routed case', async () => {
        const inquiry = { ...(JSON.parse(inquiryJson) as AdmissionInquiry), playerId: 102, playerName: 'Second child', status: 'ROUTED' as const, caseId: 42, actions: [] };
        vi.mocked(fetchAdmissionInquiry).mockResolvedValue(inquiry);
        render(<MemoryRouter initialEntries={['/admissions/inquiries/1?player=101&details=1']}><Routes>
            <Route path="/admissions/inquiries/:inquiryId" element={<AdmissionInquiryPage />} />
        </Routes></MemoryRouter>);
        expect(await screen.findByRole('link', { name: 'Review the proposed group' })).toHaveAttribute('href', '/admissions/cases/42?player=102');
        expect(workspaceLink('Parent Hub')).toHaveAttribute('href', '/parent?player=102');
    });

    it('keeps a general inquiry unbound to a remembered child', async () => {
        vi.mocked(fetchAdmissionInquiry).mockResolvedValue({ ...(JSON.parse(inquiryJson) as AdmissionInquiry), playerId: null, playerName: null, actions: [] });
        render(<MemoryRouter initialEntries={['/admissions/inquiries/1?details=1']}><Routes>
            <Route path="/admissions/inquiries/:inquiryId" element={<AdmissionInquiryPage />} />
        </Routes></MemoryRouter>);
        await screen.findByRole('heading', { name: 'General question' });
        expect(workspaceLink('Parent Hub')).toHaveAttribute('href', '/parent');
        expect(readSelectedPlayer(auth.user.id, auth.sessionId)).toBe(101);
    });

    it('opens family connections directly from the selected player’s requests', async () => {
        render(<MemoryRouter initialEntries={['/admissions?player=102']}><AdmissionHomePage /></MemoryRouter>);
        expect(await screen.findByRole('link', { name: 'Family connections' })).toHaveAttribute('href', '/parent?tab=connections&player=102');
    });
});
