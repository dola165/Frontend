import '../../i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import * as api from './api';
import { NotifySquadButton } from './NotifySquad';

vi.mock('./api', async importOriginal => ({ ...await importOriginal<typeof api>(), noticeReach: vi.fn(), notifySquad: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

it('shows who each choice reaches, sends the line to the parents, and says how many heard it', async () => {
    const user = userEvent.setup();
    vi.mocked(api.noticeReach).mockResolvedValue({ everyone: 31, parents: 22, players: 6, staff: 3 });
    vi.mocked(api.notifySquad).mockResolvedValue({ id: 9, told: 22 });
    render(<NotifySquadButton squads={[{ id: 4, name: 'U12' }, { id: 5, name: 'U14' }]} focus={5} />);
    await user.click(screen.getByRole('button', { name: 'Notify' }));
    expect(api.noticeReach).toHaveBeenCalledWith(5, expect.anything());
    expect(screen.getByRole('button', { name: 'U14' })).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByRole('button', { name: /Whole squad\s*31/ })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: /Parents\s*22/ }));
    await user.type(screen.getByLabelText('What should they know, in one line'), 'Training moves to 18:00.');
    await user.click(screen.getByRole('button', { name: 'Send to 22' }));
    expect(api.notifySquad).toHaveBeenCalledWith(5, { requestId: expect.any(String), audience: 'PARENTS', line: 'Training moves to 18:00.' });
    expect(await screen.findByText('Sent to 22 people in U14.')).toBeInTheDocument();
});

it('asks for the line before sending anything', async () => {
    const user = userEvent.setup();
    vi.mocked(api.noticeReach).mockResolvedValue({ everyone: 3, parents: 2, players: 1, staff: 0 });
    render(<NotifySquadButton squads={[{ id: 4, name: 'U12' }]} focus={null} />);
    await user.click(screen.getByRole('button', { name: 'Notify' }));
    expect(screen.queryByRole('button', { name: 'U12' })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Send to 3' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Write what they should know.');
    expect(api.notifySquad).not.toHaveBeenCalled();
});
