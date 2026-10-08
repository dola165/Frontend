import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAction } from '../hooks';
describe('match action recovery', () => {
  it('sends only one mutation for same-frame duplicate clicks', async () => {
    const reload = vi.fn(); const { result } = renderHook(() => useAction(reload));
    let resolve!: () => void;
    const action = vi.fn(() => new Promise<void>(r => { resolve = r; }));
    await act(async () => { void result.current.run(action); void result.current.run(action); });
    expect(action).toHaveBeenCalledOnce();
    await act(async () => { resolve(); });
    expect(reload).toHaveBeenCalledOnce();
  });
  it('refreshes a stale screen after a version conflict so the user can retry', async () => {
    const reload = vi.fn(); const { result } = renderHook(() => useAction(reload));
    await act(async () => { await result.current.run(async () => { throw { isAxiosError: true, response: { status: 409, data: { error: 'Match changed' } } }; }); });
    expect(reload).toHaveBeenCalledOnce(); expect(result.current.busy).toBe(false);
  });
});
