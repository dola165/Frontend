import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ConnectionsDialog } from '../ConnectionsDialog';
import { apiClient } from '../../../api/axiosConfig';

vi.mock('../../../api/axiosConfig', () => ({ apiClient: { get: vi.fn() } }));
vi.mock('../../ui/MediaImage', () => ({ MediaImage: () => null }));
const person = (id: number) => ({ id, username: `player${id}`, fullName: `Player ${id}`, avatarUrl: null });
const result = (ids: number[], page = 0, total = ids.length) => ({ data: { content: ids.map(person), pageNumber: page, pageSize: 20, totalElements: total } });
const get = vi.mocked(apiClient.get);
beforeEach(() => get.mockReset());
const show = (onClose = vi.fn()) => render(<MemoryRouter><ConnectionsDialog userId={9} kind="followers" onClose={onClose} /></MemoryRouter>);

it('loads another page and retains people when a later page fails, then retries it', async () => {
    get.mockResolvedValueOnce(result([1], 0, 21)).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(result([2], 1, 21));
    const user = userEvent.setup(); show();
    expect(await screen.findByRole('link', { name: /Player 1/ })).toHaveAttribute('href', '/profile/1');
    await user.click(screen.getByRole('button', { name: 'Load more people' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Connections could not load');
    expect(screen.getByRole('link', { name: /Player 1/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry connections' }));
    await screen.findByRole('link', { name: /Player 2/ });
    expect(get.mock.calls.at(-1)?.[1]?.params).toEqual({ page: 1, size: 20 });
    expect(screen.queryByRole('button', { name: 'Load more people' })).not.toBeInTheDocument();
});

it('retries an unavailable first page without presenting it as an empty list', async () => {
    get.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(result([]));
    const user = userEvent.setup(); show();
    await screen.findByRole('alert');
    expect(screen.queryByText('No followers to show yet.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry connections' }));
    await screen.findByText('No followers to show yet.');
});

it('aborts an old list so its late result cannot appear in a different profile', async () => {
    let resolveOld!: (value: ReturnType<typeof result>) => void;
    get.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
    const view = show();
    await waitFor(() => expect(get).toHaveBeenCalled());
    const signal = get.mock.calls[0][1]?.signal;
    get.mockResolvedValueOnce(result([2]));
    view.rerender(<MemoryRouter><ConnectionsDialog key="next" userId={10} kind="following" onClose={vi.fn()} /></MemoryRouter>);
    await screen.findByRole('link', { name: /Player 2/ });
    await act(async () => resolveOld(result([1])));
    expect(signal?.aborted).toBe(true);
    expect(screen.queryByRole('link', { name: /Player 1/ })).not.toBeInTheDocument();
});

it('supports Escape and profile navigation without a social mutation', async () => {
    get.mockResolvedValue(result([1]));
    const close = vi.fn(); const user = userEvent.setup(); const first = show(close);
    await screen.findByRole('link', { name: /Player 1/ });
    await user.keyboard('{Escape}');
    await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
    first.unmount(); show(close);
    await user.click(await screen.findByRole('link', { name: /Player 1/ }));
    await waitFor(() => expect(close).toHaveBeenCalledTimes(2));
});

it('filters the visible list and presents Instagram-style following status', async () => {
    get.mockResolvedValue(result([1, 2]));
    const user = userEvent.setup();
    render(<MemoryRouter><ConnectionsDialog userId={9} kind="following" showFollowingStatus onClose={vi.fn()} /></MemoryRouter>);
    await screen.findByText('Player 1');
    expect(screen.getAllByText('Following')).toHaveLength(3);
    await user.type(screen.getByRole('searchbox', { name: 'Search connections' }), 'player2');
    expect(screen.queryByText('Player 1')).not.toBeInTheDocument();
    expect(screen.getByText('Player 2')).toBeInTheDocument();
    await user.clear(screen.getByRole('searchbox', { name: 'Search connections' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search connections' }), 'missing');
    expect(screen.getByRole('status')).toHaveTextContent('No connections match “missing”.');
});
