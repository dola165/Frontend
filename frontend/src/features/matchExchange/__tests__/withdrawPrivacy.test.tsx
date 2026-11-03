import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { OpponentRecovery } from '../OfficialRequests';
import type { Match } from '../api';

/** Fix round 2, W4: the withdraw form says who reads the reason, like the cancel form. */
describe('withdrawing our squad', () => {
    it('says the reason stays with the host’s coaching team', () => {
        const match = { event_id: 5, revision: 3, can_arrange: true, can_manage: false, listing_status: 'ARRANGED' } as unknown as Match;
        render(<MemoryRouter><OpponentRecovery match={match} reload={() => {}} /></MemoryRouter>);
        fireEvent.click(screen.getByRole('button', { name: 'Withdraw our squad' }));
        expect(screen.getByText(/Only the host’s coaching team reads your reason/)).toBeInTheDocument();
        expect(screen.getByText(/Families are told only that your squad can’t play/)).toBeInTheDocument();
    });
});
