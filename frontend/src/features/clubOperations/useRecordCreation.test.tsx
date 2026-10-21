import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useRecordCreation } from './useRecordCreation';
import { setStoredAccessToken } from '../../utils/authStorage';
const api = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('../../api/axiosConfig', () => ({ apiClient: api }));
const scope = { clubId: 400, actorId: 9500 }, body = { kind: 'CLINICAL_NOTE', title: 'Private health details', subjectUserId: 42, data: { note: 'Confidential synthetic note' } };
beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); localStorage.clear(); api.post.mockResolvedValue({ data: { id: 81, revision: 1 } }); });
afterEach(cleanup);
it('retains an unknown request identity even if a replay loses current permission', async () => {
  api.post.mockRejectedValueOnce(new Error('Lost response')).mockRejectedValueOnce({ response: { status: 403 } });
  const { result } = renderHook(() => useRecordCreation(scope, body.kind));
  await act(async () => { await expect(result.current.create(body)).rejects.toThrow(); });
  await act(async () => { await expect(result.current.create(body)).rejects.toEqual({ response: { status: 403 } }); });
  expect(result.current.uncertain).toBe(true);
  await act(async () => { await result.current.create(body); });
  expect(api.post.mock.calls[1]).toEqual(api.post.mock.calls[0]); expect(api.post.mock.calls[2]).toEqual(api.post.mock.calls[0]);
});
it('keeps sensitive payloads out of the reload marker and refuses changed answers after an unknown save', async () => {
  api.post.mockRejectedValueOnce(new Error('Lost response'));
  const { result } = renderHook(() => useRecordCreation(scope, body.kind));
  await act(async () => { await expect(result.current.create(body)).rejects.toThrow(); });
  const value = sessionStorage.getItem('gk-record-create:9500:400:CLINICAL_NOTE');
  expect(value).toMatch(/^[0-9a-f-]{36}$/); expect(JSON.stringify(sessionStorage)).not.toContain(body.title); expect(JSON.stringify(sessionStorage)).not.toContain(body.data.note);
  await act(async () => { await expect(result.current.create({ ...body, title: 'Changed' })).rejects.toThrow('unresolved'); });
  expect(api.post).toHaveBeenCalledTimes(1);
});
it('an unresolved marker never blocks a different account or club', async () => {
  sessionStorage.setItem('gk-record-create:9500:400:CLINICAL_NOTE', crypto.randomUUID());
  const own = renderHook(() => useRecordCreation(scope, body.kind));
  const differentAccount = renderHook(() => useRecordCreation({ ...scope, actorId: 9501 }, body.kind));
  const differentClub = renderHook(() => useRecordCreation({ ...scope, clubId: 401 }, body.kind));
  expect(own.result.current.blocked).toBe(true); expect(differentAccount.result.current.blocked).toBe(false); expect(differentClub.result.current.blocked).toBe(false);
});
it('a retained callback cannot submit after its editor unmounts', async () => {
  const { result, unmount } = renderHook(() => useRecordCreation(scope, body.kind));
  const retained = result.current.create; unmount();
  await expect(retained(body)).rejects.toThrow('no longer active');
  expect(api.post).not.toHaveBeenCalled();
});
it('an account session change refuses the old callback before any HTTP request', async () => {
  const { result } = renderHook(() => useRecordCreation(scope, body.kind));
  const retained = result.current.create;
  act(() => setStoredAccessToken('synthetic-next-account-token'));
  await expect(retained(body)).rejects.toThrow('session changed');
  expect(api.post).not.toHaveBeenCalled();
});

