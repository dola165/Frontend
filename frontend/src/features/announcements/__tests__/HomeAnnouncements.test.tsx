import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeTop } from '../../home/HomeTop';
import * as api from '../../squadCommunication/api';

vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 50 }, sessionId: 'home-test' }) }));
vi.mock('../../home/ThisWeek', () => ({ ThisWeek: () => <section aria-label="This week">This week</section> }));
vi.mock('../../squadCommunication/api', () => ({ spaces: vi.fn(), messages: vi.fn(), acknowledge: vi.fn(), receipts: vi.fn() }));

const soon = new Date(Date.now() + 3 * 86_400_000).toISOString();
const squad = { id: 105, club_id: 1, academy_name: 'Dinamo', name: 'U16 Boys', category: 'U16', can_manage: false, unread_count: 0 };
const message = (value: Partial<api.SquadMessage>): api.SquadMessage => ({
    id: 1, author_id: 7, author_name: 'Luka Gelashvili', thread_user_id: null, kind: 'ANNOUNCEMENT', title: 'Matchday: Didube Stars', body: 'Meet at 10:00.',
    important: true, created_at: new Date().toISOString(), acknowledgement_requested: true, acknowledged_at: null, acknowledged_by: [], expires_at: soon, ...value,
});

describe('pinned announcements on Home', () => {
    beforeEach(() => { vi.mocked(api.spaces).mockResolvedValue([squad]); vi.mocked(api.acknowledge).mockResolvedValue({} as never); });
    afterEach(() => { cleanup(); vi.clearAllMocks(); });

    it('puts an announcement for me above this week and marks it as read', async () => {
        vi.mocked(api.messages).mockResolvedValue([message({}), message({ id: 2, title: 'Expired kit note', expires_at: new Date(Date.now() - 1000).toISOString() })]);
        render(<MemoryRouter><HomeTop /></MemoryRouter>);
        const title = await screen.findByRole('link', { name: 'Matchday: Didube Stars' });
        expect(screen.queryByText('Expired kit note')).not.toBeInTheDocument();
        expect(title.compareDocumentPosition(screen.getByLabelText('This week')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(screen.getByText('1 to read')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Mark as read' }));
        expect(await screen.findByText('Read')).toBeInTheDocument();
        expect(api.acknowledge).toHaveBeenCalledWith(105, 1);
    });

    it('shows my own announcement after this week, with who has read it instead of a read button', async () => {
        vi.mocked(api.messages).mockResolvedValue([message({ author_id: 50, acknowledgement_requested: false })]);
        vi.mocked(api.receipts).mockResolvedValue([{ user_id: 1, full_name: 'Nino Lomidze', acknowledged_at: new Date().toISOString() }, { user_id: 2, full_name: 'Davit Arveladze', acknowledged_at: null }]);
        render(<MemoryRouter><HomeTop /></MemoryRouter>);
        expect(await screen.findByText(/of/, { selector: '.gk-receipts__summary' })).toHaveTextContent('1 of 2 families have read it');
        expect(screen.queryByRole('button', { name: 'Mark as read' })).not.toBeInTheDocument();
        expect(screen.getByLabelText('This week').compareDocumentPosition(screen.getByRole('link', { name: 'Matchday: Didube Stars' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Who hasn’t (1)' }));
        expect(screen.getByText('Davit Arveladze')).toBeInTheDocument();
    });

    it('shows nothing when no announcement is pinned', async () => {
        vi.mocked(api.messages).mockResolvedValue([]);
        render(<MemoryRouter><HomeTop /></MemoryRouter>);
        await screen.findByLabelText('This week');
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(screen.queryByText('Announcements')).not.toBeInTheDocument();
    });
});
