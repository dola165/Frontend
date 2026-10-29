import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import type { CoachData } from './CoachWorkspace';
import { CoachMatches } from './CoachMatches';

// What the page reads, each answering as the test says: the arrange check, the signed-in person, the match history.
const allowed = vi.hoisted(() => ({ answer: { pending: true, subject: null as `squad:${number}` | null } }));
vi.mock('../../../hooks/useCan', () => ({ useFirstAllowed: () => allowed.answer }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 9 }, sessionId: 'fixture' }) }));
vi.mock('../../matchHistory/api', () => ({ getMatchHistory: async () => ({ items: [], total: 0, page: 0, pageSize: 100 }) }));
vi.mock('../../matchExchange/arrange/ArrangeMatchForm', () => ({ ArrangeMatchForm: ({ squadId }: { squadId: number }) => <p>Arrange form for {squadId}</p> }));

afterEach(cleanup);
const data = { clubId: 1, clubName: 'Club', clubLogo: null, now: Date.parse('2026-10-29T10:00:00Z'), focus: null, shown: [103, 105], cards: new Map(), cardsFailed: [],
    mine: [{ id: 103, name: 'U14 Boys' }, { id: 105, name: 'U16 Boys' }], names: new Map([[103, 'U14 Boys'], [105, 'U16 Boys']]), refresh: vi.fn(), retryCards: vi.fn() } as unknown as CoachData;
const show = () => render(<MemoryRouter initialEntries={['/my-squads?tab=matches&arrange=1']}><CoachMatches data={data} /></MemoryRouter>);

it('opens Arrange a match only once the answer is in, on the first squad shown that allows it', async () => {
    // While the answer is on its way the form waits, rather than opening on the first squad's draft.
    show();
    expect(screen.queryByText(/Arrange form for/)).not.toBeInTheDocument();
    cleanup();
    allowed.answer = { pending: false, subject: 'squad:105' };
    show();
    expect(await screen.findByText('Arrange form for 105')).toBeInTheDocument();
    cleanup();
    allowed.answer = { pending: false, subject: null };
    show();
    expect(screen.queryByText(/Arrange form for/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Arrange a match/ })).not.toBeInTheDocument();
});
