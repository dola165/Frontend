import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { RecordMatchLines } from './RecordMatchLines';
import type { RecordPost } from './postTopics';
vi.mock('../squadCommunication/journeyCopy', () => ({ useJourneyCopy: () => (en: string) => en }));
afterEach(cleanup);
const record = { kind: 'RESULTS', matches: [{ eventId: 41, homeClub: 'Dinamo', awayClub: 'Torpedo', homeCrest: '/home.svg', awayCrest: '/away.svg', homeSquad: 'U14', awaySquad: 'U14', homeScore: 2, awayScore: 1, startsAt: '2026-10-31T12:00:00Z', state: 'SCHEDULED' }] } as RecordPost;
it('renders the canonical score, both supplied crests, and the same match link', () => {
    const { container } = render(<MemoryRouter><RecordMatchLines record={record} /></MemoryRouter>);
    expect(screen.getByText('2 : 1')).toBeInTheDocument(); expect(screen.getByRole('link')).toHaveAttribute('href', '/matches/41?from=home#result');
    expect([...container.querySelectorAll('img')].map(img => img.getAttribute('src'))).toEqual(expect.arrayContaining([expect.stringContaining('/home.svg'), expect.stringContaining('/away.svg')]));
});
it('never invents a missing score and updates a cancelled weekend fixture', () => {
    const view = render(<MemoryRouter><RecordMatchLines record={{ ...record, matches: [{ ...record.matches![0], awayScore: null }] }} /></MemoryRouter>);
    expect(screen.queryByText('2 : 1')).toBeNull(); expect(screen.getByText('–')).toBeInTheDocument();
    view.rerender(<MemoryRouter><RecordMatchLines record={{ ...record, kind: 'WEEKEND', matches: [{ ...record.matches![0], state: 'CANCELLED' }] }} /></MemoryRouter>);
    expect(screen.getByText('Cancelled')).toBeInTheDocument(); expect(screen.queryByText('2 : 1')).toBeNull();
});
