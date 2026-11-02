import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ParentHubPage } from '../../../pages/ParentHubPage';
import { fetchJoiningChildren } from '../api';
import type { ChildDirectory, JoiningChild } from '../../joining-contract/types';
import type * as api from '../../squadCommunication/api';
import { apiClient } from '../../../api/axiosConfig';
const auth = vi.hoisted(() => ({ user: { id: 7, dob: '1988-04-12' }, sessionId: 'parent-session', isAuthenticated: true }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../../api/axiosConfig', async original => ({ ...await original<object>(), apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
/** The doors ask the rule-checker (tested in features/actions); here the adult parent may add a child and join. */
vi.mock('../../actions/useAction', () => ({ useAction: () => ({ allowed: true, loading: false, reason: null, needsBirthDate: false, askAdmin: false, href: '/parent?do=add_child' }) }));
vi.mock('../../actions/ActionButton', () => ({ ActionButton: () => null }));
vi.mock('../api', async original => ({ ...await original<object>(), fetchJoiningChildren: vi.fn() }));
vi.mock('../FamilyRelationships', () => ({ FamilyRelationships: () => <p>Guardian tools</p> }));
vi.mock('../AddChild', () => ({ AddChild: ({ onCreated }: { onCreated: (id: number) => void }) => <button onClick={() => onCreated(63)}>Create synthetic child</button> }));
vi.mock('../PlayerLinkCode', () => ({ PlayerLinkCode: () => null }));
vi.mock('../../players/PlayerIdentityEditor', () => ({ PlayerIdentityEditor: () => null }));
vi.mock('../FamilySchedule', () => ({ FamilySchedule: () => <p>Calendar</p> }));
vi.mock('../../clubOperations/PersonalClubWork', () => ({ GuardianClubWork: () => null }));
// The squads are the child's own (their loading is tested in ParentSquadRecovery); the boxes show what they are given.
const squad = (id: number, name: string): api.SquadOverview => ({ id, club_id: 1, name, academy_name: 'Dinamo', category: 'U11', can_manage: false, unread_count: 0, viewer_id: 7, member_count: 1,
    notify_chat: true, head_coach_id: null, can_assign_coach: false, available_coaches: [], players: [], coaches: [], threads: [] });
vi.mock('../hub/useChildSquads', () => ({
    useChildSquads: (child?: JoiningChild) => ({ loading: false, error: '', failedSquads: [], retry: vi.fn(), squads: child?.clubs.length ? [squad(900, 'U11')] : [] }),
    useFamilySquads: () => ({ loading: false, error: '', failedSquads: [], retry: vi.fn(), squads: new Map() }),
}));
vi.mock('../hub/ThisWeek', () => ({ ThisWeek: ({ child }: { child: JoiningChild }) => <section aria-label="This week">{child.identity.fullName} this week</section> }));
vi.mock('../hub/CoachUpdates', () => ({ CoachUpdates: () => <section aria-label="From the coaches" />, useUpdatesToRead: () => [] }));
vi.mock('../hub/ChildChats', () => ({ ChildChats: () => <section aria-label="Chat" /> }));
vi.mock('../../squadCommunication/useClubCrest', () => ({ useClubCrest: () => null }));
vi.mock('../../../utils/authStorage', async original => ({ ...await original<object>(), getAuthSessionId: () => auth.sessionId, isCurrentAuthSession: (id: string) => id === auth.sessionId }));
vi.mock('../../squadCommunication/journeyCopy', () => ({ useJourneyCopy: () => ((en: string) => en) }));
const child = (playerId: number, name: string): JoiningChild => ({ playerId, identity: { playerId, version: 1, fullName: name, dateOfBirth: '2016-01-01', gender: null, photoUrl: null, positions: [], dominantFoot: null, heightCm: null, weightKg: null, canEdit: true, minor: true }, clubs: [], cases: [], inquiries: [] });
const fixture = (): ChildDirectory => ({ children: [child(61, 'Nika'), child(62, 'Saba')] });
function Where() { const location = useLocation(); return <output data-testid="where">{location.search}</output>; }
const show = (path = '/parent') => render(<MemoryRouter initialEntries={[path]}><ParentHubPage /><Where /></MemoryRouter>);
const dinamo = { clubId: 1, clubName: 'Dinamo', cardId: 501, affiliationStatus: 'ACTIVE', consentStatus: 'CONFIRMED', squadNames: ['U11'], squads: [{ id: 900, name: 'U11', price: null }] };
const playing = (clubs: JoiningChild['clubs'] = [dinamo]) => { const data = fixture(); data.children[0].clubs = clubs; vi.mocked(fetchJoiningChildren).mockResolvedValue(data); };
beforeEach(() => { vi.clearAllMocks(); vi.mocked(apiClient.get).mockReset().mockResolvedValue({ data: [] }); sessionStorage.clear(); auth.user = { id: 7, dob: '1988-04-12' }; auth.sessionId = 'parent-session'; vi.mocked(fetchJoiningChildren).mockResolvedValue(fixture()); });
afterEach(cleanup);
describe('Parent Hub (step 5)', () => {
    it('CR1: returning to the actual parent journey reloads canonical money/history; a refused refresh hides the old balance', async () => {
        let receipt = false, failed = false;
        vi.mocked(apiClient.get).mockImplementation(async () => {
            if (failed) throw new Error('current family access refused');
            return { data: [{ id: 5, title: 'October dues', subjectUserId: 61, squadId: 900, dueOn: '2026-10-01', period: 'October', revision: receipt ? 1 : 0, canRecord: false,
                balance: { agreed: '100.00', received: receipt ? '30.10' : '0.00', waived: '0.00', remaining: receipt ? '69.90' : '100.00', currency: 'GEL', status: 'OVERDUE', reminderCandidate: true },
                history: receipt ? [{ id: 1, type: 'RECEIPT', amount: '30.10', currency: 'GEL', happenedOn: '2026-10-30', reference: 'cash-12', reason: 'Recorded while the family was away', reverses: null, recordedAt: '2026-10-30T00:00:00Z' }] : [] }] };
        });
        playing(); show('/parent?player=61'); await screen.findByText('100.00 GEL', { selector: 'strong' }); receipt = true;
        await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
        await screen.findByText('69.90 GEL', { selector: 'strong' });
        fireEvent.click(screen.getByText('Receipts and corrections · 1')); expect(screen.getByText('Recorded while the family was away')).toBeVisible();
        expect(apiClient.get).toHaveBeenCalledTimes(2); failed = true;
        await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
        await screen.findByText('Money records could not load. The current balance is unavailable.');
        expect(screen.queryByText('69.90 GEL')).toBeNull();
    });
    it('opens on everyone with two children, and on the child’s own page with one', async () => {
        show(); expect(await screen.findByRole('button', { name: /^Everyone/ })).toHaveAttribute('aria-pressed', 'true');
        cleanup(); vi.mocked(fetchJoiningChildren).mockResolvedValue({ children: [child(61, 'Nika')] }); show();
        expect(await screen.findByRole('heading', { name: 'Nika has no club yet' })).toBeVisible();
        expect(screen.queryByRole('button', { name: /^Everyone/ })).not.toBeInTheDocument();
    });
    it('S16: puts the only child in the finder’s link, also when the address names nobody yet', async () => {
        vi.mocked(fetchJoiningChildren).mockResolvedValue({ children: [child(61, 'Nika')] }); show('/parent');
        expect(await screen.findByRole('link', { name: 'Find a club near you' })).toHaveAttribute('href', '/parent?player=61&find=club');
    });
    it('gives a child with no club the club finder and the coach’s link, keeping who it is for', async () => {
        show('/parent?player=61'); expect(await screen.findByRole('button', { name: 'Nika, No club yet' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('link', { name: 'Find a club near you' })).toHaveAttribute('href', '/parent?player=61&find=club');
        expect(screen.getByText('Got a link or code from a coach? Paste it here')).toBeVisible();
        expect(screen.queryByRole('region', { name: 'This week' })).not.toBeInTheDocument();
    });
    it.each(['ACTIVE', 'ENROLLED'])('shows a %s child the four things: this week, the coaches, chat and money', async affiliationStatus => {
        playing([{ ...dinamo, affiliationStatus }]); show('/parent?player=61');
        expect(await screen.findByRole('region', { name: 'This week' })).toHaveTextContent('Nika this week');
        for (const box of ['From the coaches', 'Chat']) expect(screen.getByRole('region', { name: box })).toBeInTheDocument();
        expect(screen.getByText('Money')).toBeVisible();
        expect(screen.queryByRole('link', { name: 'Find a club near you' })).not.toBeInTheDocument();
    });
    it('says the club set no fee rather than inventing one, and shows the club’s own price', async () => {
        playing(); show('/parent?player=61'); expect(await screen.findByText(/No fee set by the club/)).toBeVisible();
        cleanup(); playing([{ ...dinamo, squads: [{ id: 900, name: 'U11', price: { type: 'FIXED', amount: 120, currency: 'GEL', period: 'MONTH', programme: 'U11' } }] }]); show('/parent?player=61');
        expect(await screen.findByText(/120 GEL a month/)).toBeVisible();
    });
    it('keeps an unknown amount honest even when a partial fee record exists', async () => {
        playing([{ ...dinamo, fees: { status: 'DUE', amount: null, currency: 'GEL', dueDate: null, period: null } }]); show('/parent?player=61');
        await screen.findByText('Money'); expect(screen.queryByText(/0 GEL/)).not.toBeInTheDocument(); expect(screen.queryByText(/Paid up/)).not.toBeInTheDocument();
    });
    it('immediately selects a newly created child after directory refresh', async () => {
        vi.mocked(fetchJoiningChildren).mockResolvedValueOnce(fixture()).mockResolvedValue({ children: [...fixture().children, child(63, 'New child')] }); show(); await screen.findByRole('button', { name: 'Nika, No club yet' });
        fireEvent.click(screen.getByRole('link', { name: 'Add a child' })); fireEvent.click(screen.getByRole('button', { name: 'Create synthetic child' }));
        expect(await screen.findByRole('button', { name: 'New child, No club yet' })).toHaveAttribute('aria-pressed', 'true');
    });
    it('keeps siblings separate, each child’s page in the address', async () => {
        show(); fireEvent.click(await screen.findByRole('button', { name: 'Saba, No club yet' }));
        expect(screen.getByTestId('where')).toHaveTextContent('?player=62');
        expect(screen.getByRole('link', { name: 'Find a club near you' })).toHaveAttribute('href', '/parent?player=62&find=club');
        fireEvent.click(screen.getByRole('button', { name: /^Everyone/ })); expect(screen.getByTestId('where')).toBeEmptyDOMElement();
    });
    it('does not turn several club contexts into duplicate children', async () => {
        playing([dinamo, { clubId: 2, clubName: 'Extra training', cardId: 502, affiliationStatus: 'ACTIVE', consentStatus: 'CONFIRMED', squadNames: ['Skills'] }]); show();
        await screen.findByRole('button', { name: 'Nika, U11 · Skills' }); expect(screen.getAllByRole('button', { name: /^Nika/ })).toHaveLength(1);
    });
    it('puts a pending consent first in what waits for the parent', async () => {
        playing([{ ...dinamo, affiliationStatus: 'TRIALIST', consentStatus: 'PENDING' }]); show('/parent?player=61');
        expect(await screen.findByRole('link', { name: /asks for your consent/ })).toHaveAttribute('href', '/parent?tab=connections&player=61');
    });
    it('rejects an unauthorized child from a stale URL', async () => {
        show('/parent?player=999'); expect(await screen.findByRole('button', { name: /^Everyone/ })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.queryByRole('button', { name: /, No club yet/, pressed: true })).not.toBeInTheDocument();
    });
    it('distinguishes an empty directory from a failed request and supports retry', async () => {
        vi.mocked(fetchJoiningChildren).mockRejectedValueOnce(new Error('Failed')).mockResolvedValueOnce({ children: [] }); show(); await screen.findByRole('alert');
        expect(screen.queryByText('Add your child')).not.toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'Try again' })); expect(await screen.findByText('Add your child')).toBeVisible();
    });
    it('ignores a response from a previous account', async () => {
        let finish!: (data: ChildDirectory) => void; vi.mocked(fetchJoiningChildren).mockReturnValueOnce(new Promise(resolve => { finish = resolve; })).mockResolvedValueOnce({ children: [] });
        const first = show(); auth.user = { id: 8, dob: '1990-02-03' }; auth.sessionId = 'other-session'; first.rerender(<MemoryRouter><ParentHubPage /></MemoryRouter>);
        await screen.findByText('Add your child'); await act(async () => finish(fixture())); expect(screen.queryByRole('button', { name: 'Nika, No club yet' })).not.toBeInTheDocument();
    });
});
