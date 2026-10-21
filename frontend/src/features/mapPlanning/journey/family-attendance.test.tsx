import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FamilyReply } from './FamilyReply';
import { planPost, type FamilyPlan } from '../api';

vi.mock('../api', async original => ({ ...await original<typeof import('../api')>(), planPost: vi.fn().mockResolvedValue({ recorded: true }) }));

it.each(['GUARDIAN', 'PLAYER'] as const)('keeps READ available for a %s when current attendance capability is closed', async viewer => {
    vi.mocked(planPost).mockClear();
    const journey = { plan_id: 8, club_id: 3, version: 2, child_id: 42, child_name: 'Own child', viewer, canRespond: false,
        response: { status: 'PENDING' }, permission_id: null, permission: null, acknowledged_at: null,
        itinerary: { timezone: 'Asia/Tbilisi' }, travel: { status: 'NOT_RECORDED' } } as FamilyPlan;
    render(<FamilyReply journey={journey} busy={false} act={async run => { await run(); }} />);
    expect(screen.queryByRole('button', { name: viewer === 'PLAYER' ? 'I’m going' : 'Going' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: viewer === 'PLAYER' ? 'I can’t go' : 'Can’t go' })).not.toBeInTheDocument();
    expect(screen.getByText(/Replies are closed for this version/)).toBeVisible();
    const read = screen.getByRole('button', { name: 'I have read this itinerary' }); expect(read).toBeEnabled(); fireEvent.click(read);
    await waitFor(() => expect(planPost).toHaveBeenCalledExactlyOnceWith(viewer === 'PLAYER' ? '/8/my-response' : '/8/acknowledge',
        viewer === 'PLAYER' ? { version: 2, response: 'READ' } : { version: 2, childId: 42 }));
});
