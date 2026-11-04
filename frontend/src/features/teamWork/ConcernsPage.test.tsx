import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConcernsPage } from './ConcernsPage';
import { TeamWorkNav } from './TeamWorkNav';
import type { ConcernList } from './concernsApi';

vi.mock('../teamChat/TeamChatNavItem', () => ({ TeamChatNavItem: () => null }));

const list: ConcernList = { open: 1, closed: 1, rows: [
    { id: 4, clubId: 1, clubName: 'Dinamo', createdAt: '2026-11-04T10:00:00Z', status: 'OPEN' },
    { id: 3, clubId: 2, clubName: 'Rustavi', createdAt: '2026-11-03T10:00:00Z', status: 'CLOSED' },
] };
const page = (at = '/team-work?view=concerns') => render(<MemoryRouter initialEntries={[at]}><ConcernsPage list={list} /></MemoryRouter>);

describe('ConcernsPage', () => {
    it('opens on what is open, with counts and a link to the concern’s page', () => {
        page();
        expect(screen.getByRole('link', { name: 'Dinamo' })).toHaveAttribute('href', '/clubs/1/concerns/4');
        expect(screen.queryByRole('link', { name: 'Rustavi' })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: /Closed/ }));
        expect(screen.getByRole('link', { name: 'Rustavi' })).toHaveAttribute('href', '/clubs/2/concerns/3');
        expect(screen.queryByRole('link', { name: 'Dinamo' })).toBeNull();
    });

    it('keeps the view in the address', () => {
        page('/team-work?view=concerns&state=closed');
        expect(screen.getByRole('link', { name: 'Rustavi' })).toBeInTheDocument();
    });
});

describe('the Concerns entry', () => {
    const nav = (concerns?: number | null) => render(<MemoryRouter><TeamWorkNav current="overview" needsYou={0} fresh={0} waiting={0} concerns={concerns} onGo={() => undefined} /></MemoryRouter>);

    it('is there only for the reader', () => {
        const { unmount } = nav(null);
        expect(screen.queryByRole('button', { name: /Concerns/ })).toBeNull();
        unmount();
        nav(2);
        expect(screen.getByRole('button', { name: /Concerns/ })).toHaveTextContent('2');
    });
});
