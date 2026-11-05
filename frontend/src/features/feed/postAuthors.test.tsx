import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { refreshAccess } from '../../hooks/useCan';

const answers: unknown[][] = [];
const get = vi.fn(async () => ({ data: answers.shift() ?? [] }));
vi.mock('../../utils/authStorage', () => ({ getAuthSessionId: () => 'session-A', subscribeAuthSession: () => () => {} }));
vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: (...args: unknown[]) => get(...(args as [])) } }));

const { usePostAuthors } = await import('./postAuthors');
afterEach(() => { cleanup(); get.mockClear(); });

function Choices() {
    const { authors, loaded } = usePostAuthors();
    return <p>{loaded ? authors.map(author => author.name).join(', ') || 'nobody' : 'asking'}</p>;
}
const club = { clubId: 1, clubName: 'FC Dinamo Tbilisi Academy', squadId: null, name: 'FC Dinamo Tbilisi Academy' };
const squad = { ...club, squadId: 105, name: 'U16 Boys' };
it('asks again when access is explicitly refreshed in the same session', async () => {
    answers.push([], [squad]);
    render(<Choices />);
    expect(await screen.findByText('nobody')).toBeInTheDocument();
    // Accepting a squad job refreshes access: the choices follow.
    act(() => refreshAccess());
    expect(await screen.findByText('U16 Boys')).toBeInTheDocument();
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
});
