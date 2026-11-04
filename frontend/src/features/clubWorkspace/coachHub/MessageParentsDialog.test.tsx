import '../../../i18n';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { MessageParentsDialog } from './MessageParentsDialog';
import type { CoachData } from './CoachWorkspace';

it('lists only parents, never the players of 13 and over who have a thread (N3)', () => {
    const data = {
        squads: [{ id: 2, overview: { threads: [
            { user_id: 10, full_name: 'Maia Parent', unread_count: 0, is_parent: true },
            { user_id: 11, full_name: 'Teo Teen', unread_count: 0, is_parent: false },
            { user_id: 12, full_name: 'Giorgi Adult', unread_count: 0, is_parent: false },
        ] } }],
        shown: [2],
        names: new Map([[2, 'U16 Boys']]),
    } as unknown as CoachData;
    render(<MemoryRouter><MessageParentsDialog data={data} onClose={vi.fn()} /></MemoryRouter>);
    expect(screen.getByText('Maia Parent')).toBeInTheDocument();
    expect(screen.queryByText('Teo Teen')).not.toBeInTheDocument();
    expect(screen.queryByText('Giorgi Adult')).not.toBeInTheDocument();
});
