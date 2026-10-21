import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ParentHubPage } from '../../../pages/ParentHubPage';
import { fetchJoiningChildren } from '../api';
import type { ChildDirectory, JoiningChild } from '../../joining-contract/types';
const auth = vi.hoisted(() => ({ user: { id: 7 }, sessionId: 'parent-session', isAuthenticated: true }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../api', () => ({ fetchJoiningChildren: vi.fn() }));
vi.mock('../FamilyRelationships', () => ({ FamilyRelationships: () => <p>Guardian tools</p> }));
vi.mock('../AddChild', () => ({ AddChild: ({ onCreated }: { onCreated: (id: number) => void }) => <button onClick={() => onCreated(63)}>Create synthetic child</button> }));
vi.mock('../PlayerLinkCode', () => ({ PlayerLinkCode: () => null }));
vi.mock('../../players/PlayerIdentityEditor', () => ({ PlayerIdentityEditor: () => null }));
vi.mock('../FamilySchedule', () => ({ FamilySchedule: () => <p>Week</p> }));
vi.mock('../hub/useChildSquads', () => ({ useChildSquads: (child?: JoiningChild) => ({ loading: false, error: '', squads: child?.clubs.length ? [{ id: 900, club_id: child.clubs[0].clubId, name: 'U11', coaches: [], players: [] }] : [] }) }));
vi.mock('../hub/NextUp', () => ({ NextUp: ({ childName }: { childName: string }) => <p>{childName} next session</p> }));
vi.mock('../hub/LatestUpdate', () => ({ LatestUpdate: () => <p>Latest update</p> }));
vi.mock('../../squadCommunication/useClubCrest', () => ({ useClubCrest: () => null }));
vi.mock('../../../utils/authStorage', () => ({ getAuthSessionId: () => auth.sessionId, isCurrentAuthSession: (id: string) => id === auth.sessionId }));
vi.mock('../../squadCommunication/journeyCopy', () => ({ useJourneyCopy: () => ((en: string) => en) }));
const child = (playerId: number, name: string): JoiningChild => ({ playerId, identity: { playerId, version: 1, fullName: name, dateOfBirth: '2016-01-01', gender: null, photoUrl: null, positions: [], dominantFoot: null, heightCm: null, weightKg: null, canEdit: true, minor: true }, clubs: [], cases: [], inquiries: [] });
const fixture = (): ChildDirectory => ({ children: [child(61, 'Nika'), child(62, 'Saba')] });
const show = (path = '/parent') => render(<MemoryRouter initialEntries={[path]}><ParentHubPage /></MemoryRouter>);
const dinamo = { clubId: 1, clubName: 'Dinamo', cardId: 501, affiliationStatus: 'ACTIVE', consentStatus: 'CONFIRMED', squadNames: ['U11'] };
const playing = (clubs = [dinamo]) => { const data = fixture(); data.children[0].clubs = clubs; vi.mocked(fetchJoiningChildren).mockResolvedValue(data); };
beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); auth.user = { id: 7 }; auth.sessionId = 'parent-session'; vi.mocked(fetchJoiningChildren).mockResolvedValue(fixture()); });
afterEach(cleanup);
describe('Parent Hub', () => {
    it('shows a child with no club and keeps their identity through the group link', async () => {
        show(); expect(await screen.findByRole('button', { name: 'Nika, No club yet' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('link', { name: 'Find a group' })).toHaveAttribute('href', '/world/opportunities?tab=groups&player=61');
        expect(screen.queryByText(/next session/)).not.toBeInTheDocument();
    });
    it('leads a playing child with the next session and the latest update, then their squads', async () => {
        playing(); show();
        expect(await screen.findByText('Nika next session')).toBeVisible(); expect(screen.getByText('Latest update')).toBeVisible();
        expect(screen.getAllByRole('link', { name: /U11/ })[0]).toHaveAttribute('href', '/squads/900?player=61');
        expect(screen.queryByRole('link', { name: 'Find a group' })).not.toBeInTheDocument();
    });
    it('says fees are not recorded rather than zero', async () => {
        playing(); show(); expect(await screen.findByText('Not recorded')).toBeVisible();
    });
    it('keeps an unknown amount honest even when a partial fee record exists', async () => {
        const data = fixture(); data.children[0].clubs = [{ ...dinamo, fees: { status: 'DUE', amount: null, currency: 'GEL', dueDate: null, period: null } }];
        vi.mocked(fetchJoiningChildren).mockResolvedValue(data); show();
        expect(await screen.findByText('Not recorded')).toBeVisible(); expect(screen.queryByText('Paid up')).not.toBeInTheDocument();
    });
    it('immediately selects a newly created child after directory refresh', async () => {
        vi.mocked(fetchJoiningChildren).mockResolvedValueOnce(fixture()).mockResolvedValue({ children: [...fixture().children, child(63, 'New child')] }); show(); await screen.findByRole('button', { name: 'Nika, No club yet' });
        fireEvent.click(screen.getByRole('link', { name: 'Add a child' })); fireEvent.click(screen.getByRole('button', { name: 'Create synthetic child' }));
        fireEvent.click(await screen.findByRole('link', { name: 'Parent Hub' }));
        expect(await screen.findByRole('button', { name: 'New child, No club yet' })).toHaveAttribute('aria-pressed', 'true');
    });
    it('keeps siblings separate and restores the selected identity after reload', async () => {
        const first = show(); fireEvent.click(await screen.findByRole('button', { name: 'Saba, No club yet' }));
        expect(screen.getByRole('link', { name: 'Find a group' })).toHaveAttribute('href', '/world/opportunities?tab=groups&player=62');
        first.unmount(); show(); expect(await screen.findByRole('button', { name: 'Saba, No club yet' })).toHaveAttribute('aria-pressed', 'true');
    });
    it('does not turn several club contexts into duplicate children', async () => {
        playing([dinamo, { clubId: 2, clubName: 'Extra training', cardId: 502, affiliationStatus: 'ACTIVE', consentStatus: 'CONFIRMED', squadNames: ['Skills'] }]); show();
        await screen.findByRole('button', { name: 'Nika, U11 · Skills' }); expect(screen.getAllByRole('button', { name: /^Nika/ })).toHaveLength(1);
    });
    it('puts a pending consent first', async () => {
        playing([{ ...dinamo, affiliationStatus: 'TRIALIST', consentStatus: 'PENDING' }]); show();
        expect(await screen.findByRole('link', { name: /asks for your consent/ })).toHaveAttribute('href', '/parent?tab=connections&player=61');
        expect(screen.queryByRole('link', { name: 'Find a group' })).not.toBeInTheDocument();
    });
    it('rejects an unauthorized selected identity from a stale URL', async () => {
        show('/parent?player=999'); expect(await screen.findByRole('button', { name: 'Nika, No club yet' })).toHaveAttribute('aria-pressed', 'true');
    });
    it('distinguishes an empty directory from a failed request and supports retry', async () => {
        vi.mocked(fetchJoiningChildren).mockRejectedValueOnce(new Error('Failed')).mockResolvedValueOnce({ children: [] }); show(); await screen.findByRole('alert');
        expect(screen.queryByText('Add your child')).not.toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'Try again' })); expect(await screen.findByText('Add your child')).toBeVisible();
    });
    it('ignores a response from a previous account', async () => {
        let finish!: (data: ChildDirectory) => void; vi.mocked(fetchJoiningChildren).mockReturnValueOnce(new Promise(resolve => { finish = resolve; })).mockResolvedValueOnce({ children: [] });
        const first = show(); auth.user = { id: 8 }; auth.sessionId = 'other-session'; first.rerender(<MemoryRouter><ParentHubPage /></MemoryRouter>);
        await screen.findByText('Add your child'); await act(async () => finish(fixture())); expect(screen.queryByRole('button', { name: 'Nika, No club yet' })).not.toBeInTheDocument();
    });
});
