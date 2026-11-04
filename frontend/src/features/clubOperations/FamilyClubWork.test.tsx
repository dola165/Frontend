import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FamilyClubWork } from './FamilyClubWork';

const ops = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('./api', async original => ({ ...await original<object>(), get: ops.get, post: ops.post }));
vi.mock('./money/FamilyMoneyConnections', () => ({ FamilyMoneyConnections: () => null }));

const place = { club_id: 1, club_name: 'Dinamo', user_id: 7, name: 'Teo Teen' };
const family = (over: object) => ({ connections: [], concernConnections: [], shared: [], schedule: [], reports: [], ...over });
const page = () => render(<MemoryRouter><FamilyClubWork staffClubs={[]} /></MemoryRouter>);

describe('FamilyClubWork after a parent’s no to a club', () => {
    beforeEach(() => {
        ops.get.mockReset(); ops.post.mockReset();
        ops.get.mockImplementation((path: string) => path.endsWith('/concerns/receiver')
            ? Promise.resolve({ kind: 'OWNER', name: 'Nino Owner' })
            : Promise.resolve(family({ concernConnections: [place] })));
    });

    it('still lists the club for a concern, and says who receives it', async () => {
        page();
        fireEvent.click(await screen.findByRole('button', { name: 'Raise a concern' }));
        const person = screen.getByRole('combobox');
        expect(within(person).getByRole('option', { name: 'Teo Teen · Dinamo' })).toBeInTheDocument();
        fireEvent.change(person, { target: { value: '1:7' } });
        expect(await screen.findByText(/It goes to Nino Owner, the club’s owner/)).toBeVisible();
    });

    it('offers nothing else for that club', async () => {
        page();
        await screen.findByRole('button', { name: 'Raise a concern' });
        expect(screen.queryByRole('button', { name: 'Report education absence' })).toBeNull();
    });
});
