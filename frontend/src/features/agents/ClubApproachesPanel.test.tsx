import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClubApproachesPanel } from './ClubApproachesPanel';
import * as approaches from './clubApproachesApi';

vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ sessionId: 'session-a' }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'en', resolvedLanguage: 'en' } }) }));
vi.mock('./api', () => ({ searchClubs: vi.fn() }));
vi.mock('./clubApproachesApi', () => ({
    fetchClubApproaches: vi.fn(), fetchClubApproach: vi.fn(), fetchClubApproachOptions: vi.fn(), createClubApproach: vi.fn(),
    actOnClubApproach: vi.fn(), fetchClubApproachMessages: vi.fn(), postClubApproachMessage: vi.fn(),
}));

const item = (overrides: Partial<approaches.ClubApproach> = {}): approaches.ClubApproach => ({
    id: 11, agentId: 5, agentName: 'Ari Agent', playerId: 7, playerName: 'Pia Player', clubId: 9, clubName: 'North FC',
    scope: 'First-team opportunity', message: 'Please consider this player.', status: 'PENDING_PLAYER', version: 3,
    createdAt: '2026-09-01T10:00:00Z', updatedAt: '2026-09-01T10:00:00Z', allowedActions: ['APPROVE'], ...overrides,
});
const page = (items = [item()], total = items.length, currentPage = 0) => ({ items, total, page: currentPage, size: 20 });
const renderPanel = (mode: 'agent'|'participant'|'club' = 'participant', path = '/') => render(<MemoryRouter initialEntries={[path]}><ClubApproachesPanel mode={mode} clubId={mode === 'club' ? 9 : undefined} /></MemoryRouter>);

describe('ClubApproachesPanel', () => {
    afterEach(cleanup);
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.setItem('gk-session-id', 'session-a');
        vi.mocked(approaches.fetchClubApproaches).mockResolvedValue(page());
        vi.mocked(approaches.fetchClubApproachMessages).mockResolvedValue({ items: [], total: 0, page: 0, size: 20 });
        vi.mocked(approaches.fetchClubApproach).mockResolvedValue(item());
        vi.mocked(approaches.actOnClubApproach).mockResolvedValue(item({status:'PENDING_CLUB',version:4,allowedActions:['REVOKE']}));
    });

    it('shows a loading failure without claiming the inbox is empty', async () => {
        vi.mocked(approaches.fetchClubApproaches).mockRejectedValue(new Error('Request failed'));
        renderPanel('club');
        expect(await screen.findByRole('alert')).toBeInTheDocument();
        expect(screen.queryByText('No approaches here yet.')).not.toBeInTheDocument();
    });

    it('requires confirmation before player approval and sends the current version', async () => {
        renderPanel();
        await screen.findByText('North FC');
        fireEvent.click(screen.getByText('North FC'));
        fireEvent.click(await screen.findByText('Approve'));
        expect(approaches.actOnClubApproach).not.toHaveBeenCalled();
        fireEvent.click(screen.getByText('Confirm'));
        await waitFor(() => expect(approaches.actOnClubApproach).toHaveBeenCalledWith(11, { action: 'APPROVE', version: 3, note: undefined }, expect.objectContaining({ _authSessionId: 'session-a' })));
    });

    it('loads a focused approach directly when it is outside the list page', async () => {
        vi.mocked(approaches.fetchClubApproaches).mockResolvedValue(page([], 0));
        vi.mocked(approaches.fetchClubApproach).mockResolvedValue(item({ id: 99, playerName: 'Focused Player' }));
        renderPanel('participant', '/profile/7?approach=99');
        expect(await screen.findByText(/Focused Player/)).toBeInTheDocument();
        expect(approaches.fetchClubApproach).toHaveBeenCalledWith(99, expect.objectContaining({ _authSessionId: 'session-a' }));
    });

    it('does not expose agent proposal controls to club leadership and only enables server-authorized messages', async () => {
        vi.mocked(approaches.fetchClubApproaches).mockResolvedValue(page([item({ allowedActions: [] })]));
        vi.mocked(approaches.fetchClubApproachMessages).mockResolvedValue({ items: [{ id: 1, authorId: 7, authorName: 'Pia', kind: 'PROPOSED', body: '', createdAt: '2026-09-01T10:00:00Z' }], total: 1, page: 0, size: 20 });
        renderPanel('club');
        expect(screen.queryByText('New approach')).not.toBeInTheDocument();
        fireEvent.click(await screen.findByText('Pia Player'));
        expect(await screen.findByText('Approach proposed')).toBeInTheDocument();
        expect(screen.queryByPlaceholderText('Write a message')).not.toBeInTheDocument();
    });

    it('requests the next bounded page', async () => {
        vi.mocked(approaches.fetchClubApproaches).mockResolvedValue(page([item()], 41));
        renderPanel();
        await screen.findByText('North FC');
        fireEvent.click(screen.getByLabelText('Next page'));
        await waitFor(() => expect(approaches.fetchClubApproaches).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, size: 20 }), expect.anything()));
    });

    it('ignores a list response after the current account changes', async () => {
        let resolve!: (value: ReturnType<typeof page>) => void;
        const deferred = new Promise<ReturnType<typeof page>>((complete) => { resolve = complete; });
        vi.mocked(approaches.fetchClubApproaches).mockReturnValue(deferred);
        renderPanel();
        await waitFor(() => expect(approaches.fetchClubApproaches).toHaveBeenCalled());
        await act(async () => { localStorage.setItem('gk-session-id', 'session-b'); resolve(page([item({ playerName: 'Stale Player' })])); });
        expect(screen.queryByText('North FC')).not.toBeInTheDocument();
    });

    it('keeps the newly selected discussion when an earlier decision completes late', async () => {
        const second = item({id:12,clubName:'South FC',scope:'Second approach',allowedActions:[]});
        let finish!: (value:approaches.ClubApproach)=>void;
        vi.mocked(approaches.actOnClubApproach).mockReturnValue(new Promise(resolve=>{finish=resolve;}));
        vi.mocked(approaches.fetchClubApproaches).mockResolvedValue(page([item(),second]));
        vi.mocked(approaches.fetchClubApproach).mockImplementation(async id=>id===12?second:item());
        renderPanel();
        fireEvent.click(await screen.findByText('North FC'));
        fireEvent.click(await screen.findByText('Approve'));
        fireEvent.click(screen.getByText('Confirm'));
        await waitFor(()=>expect(approaches.actOnClubApproach).toHaveBeenCalled());
        fireEvent.click(screen.getByText('South FC'));
        expect(await screen.findByRole('heading',{name:'Pia Player · South FC'})).toBeInTheDocument();
        await act(async()=>finish(item({status:'PENDING_CLUB',version:4})));
        expect(screen.getByRole('heading',{name:'Pia Player · South FC'})).toBeInTheDocument();
        expect(screen.queryByRole('heading',{name:'Pia Player · North FC'})).not.toBeInTheDocument();
        expect(screen.queryByText('Confirm')).not.toBeInTheDocument();
    });

    it('loads focused detail through the StrictMode cleanup and setup cycle', async () => {
        render(<StrictMode><MemoryRouter initialEntries={['/?approach=11']}><ClubApproachesPanel mode="participant" /></MemoryRouter></StrictMode>);
        expect(await screen.findByRole('heading',{name:'Pia Player · North FC'})).toBeInTheDocument();
    });

    it('loads earlier discussion pages instead of dropping messages after the first twenty', async () => {
        vi.mocked(approaches.fetchClubApproachMessages).mockResolvedValue({items:[],total:25,page:0,size:20});
        renderPanel('participant','/?approach=11');
        fireEvent.click(await screen.findByRole('button',{name:'Next discussion page'}));
        await waitFor(()=>expect(approaches.fetchClubApproachMessages).toHaveBeenLastCalledWith(11,1,20,expect.anything()));
    });
});
