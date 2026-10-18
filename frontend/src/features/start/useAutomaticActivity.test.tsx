import { act, render, waitFor } from '@testing-library/react';
import { apiClient } from '../../api/axiosConfig';
import type { AuthUser } from '../../context/AuthContext';
import { applyActivity } from './applyActivity';
import { fetchFeedPreferences } from './startApi';
import { useAutomaticActivity } from './useAutomaticActivity';

const auth = vi.hoisted(() => ({ sessionId: 'session-one' }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: vi.fn() } }));
vi.mock('./startApi', () => ({ fetchFeedPreferences: vi.fn() }));
vi.mock('./applyActivity', async importOriginal => ({ ...await importOriginal<typeof import('./applyActivity')>(), applyActivity: vi.fn() }));

const person = (id: number) => ({ id, navigationCapabilities: { version: 1, workspaces: [{ id: 'squad.workspace', context: { type: 'squad', id: 105, label: 'U16' } }] } }) as AuthUser;
function Entrance({ user }: { user: AuthUser | null }) { useAutomaticActivity(user); return null; }

beforeEach(() => {
    vi.clearAllMocks();
    auth.sessionId = 'session-one';
    vi.mocked(fetchFeedPreferences).mockResolvedValue({ town: null, topics: [], activity: null });
});

it('does not replace existing roles when their read failed', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('offline'));
    render(<Entrance user={person(1)} />);
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledOnce());
    await act(async () => {});
    expect(applyActivity).not.toHaveBeenCalled();
});

it('preserves a public role the person already chose', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [{ role: 'REFEREE', primary: true, published: true }] });
    render(<Entrance user={person(1)} />);
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledOnce());
    await act(async () => {});
    expect(applyActivity).not.toHaveBeenCalled();
});

it('applies the confirmed link for a person who has no activity or public roles yet', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
    render(<Entrance user={person(1)} />);
    await waitFor(() => expect(applyActivity).toHaveBeenCalledWith(1, 'COACH', expect.any(Function)));
});

it('discards an old account’s delayed answers after a session change', async () => {
    let finishOld!: (answer: { data: never[] }) => void;
    vi.mocked(apiClient.get).mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }));
    const { rerender } = render(<Entrance user={person(1)} />);
    const signal = vi.mocked(apiClient.get).mock.calls[0][1]?.signal;
    auth.sessionId = 'session-two';
    vi.mocked(apiClient.get).mockResolvedValue({ data: [{ role: 'REFEREE' }] });
    rerender(<Entrance user={person(2)} />);
    await act(async () => { finishOld({ data: [] }); });
    expect(signal?.aborted).toBe(true);
    expect(applyActivity).not.toHaveBeenCalled();
});
