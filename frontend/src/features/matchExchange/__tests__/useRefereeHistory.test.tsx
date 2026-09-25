import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { apiClient } from '../../../api/axiosConfig';
import { useRefereeHistory } from '../useRefereeHistory';

const auth = vi.hoisted(() => ({ sessionId: 'first' }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: { get: vi.fn() } }));
beforeEach(() => { vi.clearAllMocks(); auth.sessionId = 'first'; });

it('hides the previous account immediately and ignores its delayed response', async () => {
  let resolveFirst!: (value: { data: string }) => void;
  vi.mocked(apiClient.get).mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; }));
  vi.mocked(apiClient.get).mockResolvedValueOnce({ data: 'second account' });
  const { result, rerender } = renderHook(() => useRefereeHistory<string>('/referees/me/offers'));
  auth.sessionId = 'second';
  rerender();
  expect(result.current.data).toBeUndefined();
  await waitFor(() => expect(result.current.data).toBe('second account'));
  await act(async () => resolveFirst({ data: 'private first account' }));
  expect(result.current.data).toBe('second account');
  expect(vi.mocked(apiClient.get).mock.calls[1][1]).toMatchObject({ _authSessionId: 'second' });
});

it('removes previously loaded private history when access is revoked', async () => {
  vi.mocked(apiClient.get).mockResolvedValueOnce({ data: 'private history' });
  const { result } = renderHook(() => useRefereeHistory<string>('/referees/me/offers/12'));
  await waitFor(() => expect(result.current.data).toBe('private history'));
  vi.mocked(apiClient.get).mockRejectedValueOnce({ isAxiosError: true, response: { status: 404 } });
  act(() => result.current.reload());
  await waitFor(() => expect(result.current.error).not.toBe(''));
  expect(result.current.data).toBeUndefined();
});
