import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { get } from '../api';
import { usePrivateCare, type CareRecord, type PlayerCare } from './usePrivateCare';

vi.mock('../api', async original => ({ ...await original<typeof import('../api')>(), get: vi.fn() }));
const note: CareRecord = { id: 11, club_id: 1, squad_id: 2, subject_user_id: 3, assigned_user_id: 5, related_record_id: 10,
  module: 'MEDICAL', kind: 'CLINICAL_NOTE', title: 'Original case', status: 'OPEN', data: { notes: 'Private original body' },
  event_id: null, session_id: null, due_on: null, revision: 0, canEdit: true, transitions: [], created_at: '2026-10-30T10:00:00Z', updated_at: '2026-10-30T10:00:00Z' };
const context: PlayerCare = { module: 'MEDICAL', decisionMakers: [{ id: 3, name: 'Adult self' }], records: [note], usableConsents: [], historyLimit: 'Retained and sealed without original authority.' };
interface Scope { club: number; squad: number; person: number; module: string; record: number | null }
const scope: Scope = { club: 1, squad: 2, person: 3, module: 'MEDICAL', record: 11 };
function pending<T>() {
  let resolve!: (value: T) => void;
  let reject!: (failure: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function hook(initialProps = scope) {
  return renderHook(p => usePrivateCare(p.club, p.squad, p.person, p.module, p.record), { initialProps });
}
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear(); localStorage.setItem('gk-session-id', 'care-hook-session');
  vi.mocked(get).mockImplementation(async path => path.includes('/care/players/') ? context : note);
});
afterEach(cleanup);

it.each([403, 404])('a context %i retains only the independently authorized original record', async status => {
  vi.mocked(get).mockImplementation(async path => { if (path.includes('/care/players/')) throw { response: { status } }; return note; });
  const { result } = hook();
  await waitFor(() => expect(result.current.selected).toEqual(note));
  expect(result.current.data).toBeNull(); expect(result.current.error).toBe('');
});

it('does not wait for the current-player context to authorize an existing detail', async () => {
  const delayed = pending<PlayerCare>();
  vi.mocked(get).mockImplementation(async path => path.includes('/care/players/') ? delayed.promise : note);
  const { result } = hook();
  await waitFor(() => expect(result.current.selected).toEqual(note));
  expect(result.current.data).toBeNull();
  await act(async () => delayed.resolve(context));
  await waitFor(() => expect(result.current.data).toEqual(context));
});

it.each([401, 403, 404])('a direct record %i never borrows a stale body or authority from successful context', async status => {
  vi.mocked(get).mockImplementation(async path => { if (path.includes('/care/players/')) return context; throw { response: { status } }; });
  const { result } = hook();
  await waitFor(() => expect(result.current.error).toContain('This record is unavailable'));
  expect(result.current.selected).toBeNull(); expect(result.current.data).toBeNull();
});

it('authentication loss on context clears even a just-authorized record', async () => {
  vi.mocked(get).mockImplementation(async path => { if (path.includes('/care/players/')) throw { response: { status: 401 } }; return note; });
  const { result } = hook();
  await waitFor(() => expect(result.current.error).toContain('This record is unavailable'));
  expect(result.current.selected).toBeNull(); expect(result.current.data).toBeNull();
});

it.each([undefined, 500, 503])('context failure %s is reported honestly rather than classified as roster loss', async status => {
  vi.mocked(get).mockImplementation(async path => {
    if (path.includes('/care/players/')) throw status ? { response: { status, data: { detail: 'Context service unavailable' } } } : new Error('Offline context');
    return note;
  });
  const { result } = hook();
  await waitFor(() => expect(result.current.error).not.toBe(''));
  expect(result.current.selected).toEqual(note); expect(result.current.data).toBeNull();
  expect(result.current.error).not.toContain('This record is unavailable');
  vi.mocked(get).mockImplementation(async path => { if (path.includes('/care/players/')) throw { response: { status: 403 } }; return note; });
  await act(async () => result.current.load());
  expect(result.current.error).toBe(''); expect(result.current.data).toBeNull();
});

it.each([
  { id: 12 }, { club_id: 9 }, { squad_id: 9 }, { subject_user_id: 9 }, { module: 'WELLBEING' },
  { module: 'AVAILABILITY', kind: 'CLINICAL_NOTE' },
])('rejects a direct record with mismatched identity %j', async mismatch => {
  vi.mocked(get).mockImplementation(async path => path.includes('/care/players/') ? context : { ...note, ...mismatch });
  const { result } = hook();
  await waitFor(() => expect(result.current.error).toContain('This record is unavailable'));
  expect(result.current.selected).toBeNull(); expect(result.current.data).toBeNull();
});

it('keeps medical short participation in Body but does not borrow it into Life', async () => {
  const restriction = { ...note, module: 'AVAILABILITY', kind: 'RESTRICTION', summaryOnly: true, canEdit: false };
  vi.mocked(get).mockImplementation(async path => { if (path.includes('/care/players/')) throw { response: { status: 403 } }; return restriction; });
  const { result, rerender } = hook();
  await waitFor(() => expect(result.current.selected).toEqual(restriction));
  rerender({ ...scope, module: 'WELLBEING' });
  await waitFor(() => expect(result.current.error).toContain('This record is unavailable'));
  expect(result.current.selected).toBeNull();
});

it('aborts an old scope and ignores its late direct and context responses', async () => {
  const oldRecord = pending<CareRecord>(), oldContext = pending<PlayerCare>();
  const replacement = { ...note, id: 12, club_id: 2, squad_id: 4, subject_user_id: 6, data: { notes: 'Current scope body' } };
  vi.mocked(get).mockImplementation(async path => path.startsWith('/clubs/1/') ? path.includes('/care/players/') ? oldContext.promise : oldRecord.promise : path.includes('/care/players/') ? { ...context, records: [replacement] } : replacement);
  const { result, rerender } = hook();
  await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  const signal = vi.mocked(get).mock.calls[0][1];
  rerender({ ...scope, club: 2, squad: 4, person: 6, record: 12 });
  expect(result.current.selected).toBeNull();
  await waitFor(() => expect(result.current.selected?.id).toBe(12));
  await act(async () => { oldRecord.resolve(note); oldContext.resolve(context); });
  expect(signal?.aborted).toBe(true); expect(result.current.selected).toEqual(replacement);
});

it('clears the prior account immediately and ignores its late authorized result', async () => {
  const old = pending<CareRecord>();
  vi.mocked(get).mockImplementation(async path => path.includes('/care/players/') ? context : old.promise);
  const { result } = hook();
  await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  vi.mocked(get).mockImplementation(async path => { if (path.includes('/care/players/')) return context; throw { response: { status: 403 } }; });
  await act(async () => { localStorage.setItem('gk-session-id', 'another-account'); window.dispatchEvent(new Event('gk-auth-changed')); });
  await waitFor(() => expect(result.current.error).toContain('This record is unavailable'));
  await act(async () => old.resolve(note));
  expect(result.current.selected).toBeNull(); expect(result.current.data).toBeNull();
});

it('a same-record retry denial cannot be overwritten by an earlier successful response', async () => {
  const old = pending<CareRecord>();
  vi.mocked(get).mockImplementation(async path => path.includes('/care/players/') ? context : old.promise);
  const { result } = hook();
  await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  vi.mocked(get).mockImplementation(async path => { if (path.includes('/care/players/')) return context; throw { response: { status: 403 } }; });
  await act(async () => result.current.load());
  await act(async () => old.resolve(note));
  expect(result.current.selected).toBeNull(); expect(result.current.error).toContain('This record is unavailable');
});

it('late successful context cannot restore a directly denied record', async () => {
  const delayed = pending<PlayerCare>();
  vi.mocked(get).mockImplementation(async path => { if (path.includes('/care/players/')) return delayed.promise; throw { response: { status: 403 } }; });
  const { result } = hook();
  await waitFor(() => expect(result.current.error).toContain('This record is unavailable'));
  await act(async () => delayed.resolve(context));
  expect(result.current.data).toBeNull(); expect(result.current.selected).toBeNull();
});

it.each(['retry', 'scope', 'account'] as const)('C5 ignores an old context 401 after newer %s authority loads', async change => {
  const { result, rerender } = hook();
  await waitFor(() => expect(result.current.selected).toEqual(note));
  const oldContext = pending<PlayerCare>();
  vi.mocked(get).mockImplementation(async path => {
    if (path.includes('/care/players/')) return oldContext.promise;
    throw { response: { status: 503 } };
  });
  await act(async () => result.current.load());
  expect(result.current.selected).toEqual(note);
  const replacement = { ...note, revision: 1, data: { notes: 'Newly authorized private body' },
    ...(change === 'scope' ? { id: 12, club_id: 2, squad_id: 4, subject_user_id: 6 } : {}) };
  vi.mocked(get).mockImplementation(async path => path.includes('/care/players/') ? { ...context, records: [replacement] } : replacement);
  if (change === 'scope') rerender({ ...scope, club: 2, squad: 4, person: 6, record: 12 });
  else if (change === 'account') await act(async () => {
    localStorage.setItem('gk-session-id', 'new-authorized-account'); window.dispatchEvent(new Event('gk-auth-changed'));
  });
  else await act(async () => result.current.load());
  await waitFor(() => expect(result.current.selected).toEqual(replacement));
  await act(async () => oldContext.reject({ response: { status: 401 } }));
  expect(result.current.selected).toEqual(replacement); expect(result.current.error).toBe('');
});
