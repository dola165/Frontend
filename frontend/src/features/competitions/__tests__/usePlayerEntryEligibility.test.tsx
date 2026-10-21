import { act, renderHook, waitFor } from '@testing-library/react';
import { apiClient } from '../../../api/axiosConfig';
import { usePlayerEntryEligibility } from '../usePlayerEntryEligibility';

vi.mock('../../../api/axiosConfig', () => ({ apiClient: { get: vi.fn() } }));

describe('private individual entry eligibility', () => {
  beforeEach(() => vi.resetAllMocks());
  it('does not request a private hint for anonymous or closed entry', () => {
    const { rerender } = renderHook(({ actor, enabled }) => usePlayerEntryEligibility(actor, enabled),
      { initialProps: { actor: null as number | null, enabled: false } });
    rerender({ actor: 8, enabled: false });
    expect(apiClient.get).not.toHaveBeenCalled();
  });
  it('ignores a delayed previous account response after account switch', async () => {
    let answerFirst!: (value: { data: { eligible: boolean } }) => void;
    vi.mocked(apiClient.get).mockImplementationOnce(() => new Promise(resolve => { answerFirst = resolve; }))
      .mockResolvedValueOnce({ data: { eligible: false } });
    const { result, rerender } = renderHook(({ actor }) => usePlayerEntryEligibility(actor, true), { initialProps: { actor: 8 } });
    rerender({ actor: 9 });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => answerFirst({ data: { eligible: true } }));
    expect(result.current.eligible).toBe(false);
  });
  it('fails closed for a malformed read and recovers after retry', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: {} }).mockResolvedValueOnce({ data: { eligible: true } });
    const { result } = renderHook(() => usePlayerEntryEligibility(8, true));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.eligible).toBe(false);
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.eligible).toBe(true));
  });
  it('rechecks the same actor when individual entry becomes available again', async () => {
    let answer!: (value: { data: { eligible: boolean } }) => void;
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { eligible: true } })
      .mockImplementationOnce(() => new Promise(resolve => { answer = resolve; }));
    const { result, rerender } = renderHook(({ enabled }) => usePlayerEntryEligibility(8, enabled), { initialProps: { enabled: true } });
    await waitFor(() => expect(result.current.eligible).toBe(true));
    rerender({ enabled: false });rerender({ enabled: true });
    expect(result.current.status).toBe('pending');expect(result.current.eligible).toBe(false);
    await act(async () => answer({ data: { eligible: false } }));
    expect(result.current.status).toBe('ready');expect(result.current.eligible).toBe(false);
  });
});
