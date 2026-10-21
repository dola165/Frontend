import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { PageRef, PageView } from '../../api';
import { makePage } from '../../__tests__/fixtures';
import { PageEditProvider } from '../PageEditProvider';
import { usePageEdit, type PageEdit } from '../context';

const auth = vi.hoisted(() => ({ id: 1, session: 'owner-a' }));
const api = vi.hoisted(() => ({ fetchPage: vi.fn(), saveIdentity: vi.fn(), saveBox: vi.fn(), saveLayout: vi.fn(), goLive: vi.fn() }));
const toasts = vi.hoisted(() => ({ calls: [] as { message: string; action?: { label: string; onClick: () => void } }[] }));
vi.mock('../../api', async original => ({ ...await original<typeof import('../../api')>(), ...api }));
vi.mock('../../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: auth.id }, sessionId: auth.session, status: 'authenticated' }) }));
vi.mock('../../../feed/feedEvents', () => ({ recordFunnelEvent: vi.fn() }));
vi.mock('sonner', () => {
  const record = (message: string, options?: { action?: { label: string; onClick: () => void } }) => toasts.calls.push({ message, action: options?.action });
  return { toast: Object.assign(record, { warning: record, error: record, success: record }) };
});
import { PageConflict } from '../../api';

let editor: PageEdit;
function Probe() {
  const value = usePageEdit();
  useLayoutEffect(() => { editor = value; }, [value]);
  return <><p>{value.page?.identity.name ?? 'Loading'}</p><span data-testid="pending">{value.pendingCount}</span></>;
}
const tree = (id = 7002) => <MemoryRouter><PageEditProvider pageRef={{ type: 'organization', id }}><Probe /></PageEditProvider></MemoryRouter>;
const key = (id = auth.id, page = 7002) => `gk.first-use.v1:${id}:page-pending:organization:${page}`;
const queue = [{ kind: 'identity', patch: { about: 'First private answer' }, id: 'first' }, { kind: 'identity', patch: { about: 'Latest private answer' }, id: 'second' }];
const remembered = (id = auth.id) => {
  const value = sessionStorage.getItem(key(id));
  return value ? JSON.parse(value).value : [];
};
function remember() { sessionStorage.setItem(key(), JSON.stringify({ accountId: auth.id, value: queue })); }
function switchAccount() { auth.id = 2; auth.session = 'owner-b'; localStorage.setItem('gk-session-id', auth.session); }
function named(name: string, ref: PageRef = { type: 'organization', id: 7002 }): PageView {
  const page = makePage();
  return { ...page, ref, identity: { ...page.identity, name } };
}
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
beforeEach(() => {
  vi.resetAllMocks(); toasts.calls.length = 0; sessionStorage.clear(); localStorage.clear();
  auth.id = 1; auth.session = 'owner-a'; localStorage.setItem('gk-session-id', auth.session);
  api.fetchPage.mockImplementation(async (ref: PageRef) => named(auth.id === 1 ? 'Page A' : 'Page B', ref));
});

it.each(['Try again', 'Keep mine', 'Undo'])('invalidates a retained %s action after unmount and account switch', async label => {
  if (label === 'Try again') api.saveIdentity.mockRejectedValueOnce(new Error('offline'));
  else if (label === 'Keep mine') api.saveIdentity.mockRejectedValueOnce(new PageConflict(named('Theirs')));
  else api.saveIdentity.mockResolvedValueOnce(named('Saved'));
  const first = render(tree()); await screen.findByText('Page A');
  await act(async () => { await editor.saveIdentity({ about: 'Private A' }, { label: 'Saved' }); });
  const action = toasts.calls.find(item => item.action?.label === label)?.action;
  expect(action).toBeDefined();
  first.unmount(); switchAccount();
  render(tree()); await screen.findByText('Page B');
  await act(async () => { action!.onClick(); });
  expect(api.saveIdentity).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('pending')).toHaveTextContent('0');
});

it('does not replay an edit made as the initial page becomes available', async () => {
  const sentBy: number[] = [];
  api.saveIdentity.mockImplementation(() => {
    sentBy.push(auth.id);
    return Promise.reject(new PageConflict(named('Theirs')));
  });
  function ImmediateEdit() {
    const value = usePageEdit();
    const started = useRef(false);
    useEffect(() => {
      if (!value.page || started.current) return;
      started.current = true;
      void value.saveIdentity({ about: 'Immediate private answer' });
    }, [value]);
    return null;
  }
  const first = render(<MemoryRouter><PageEditProvider pageRef={{ type: 'organization', id: 7002 }}><Probe /><ImmediateEdit /></PageEditProvider></MemoryRouter>);
  await screen.findByText('Theirs');
  const action = toasts.calls.find(item => item.action?.label === 'Keep mine')?.action;
  expect(action).toBeDefined();
  expect(sentBy).toEqual([1]);
  expect(remembered(1)).toHaveLength(1);
  first.unmount(); switchAccount();
  render(tree()); await screen.findByText('Page B');
  await act(async () => { action!.onClick(); });
  expect(sentBy).toEqual([1]);
  expect(api.saveIdentity).toHaveBeenCalledTimes(1);
});

it('blocks old actions when storage retires the session before React receives the switch', async () => {
  api.saveIdentity.mockRejectedValueOnce(new Error('offline'));
  render(tree()); await screen.findByText('Page A');
  await act(async () => { await editor.saveIdentity({ about: 'Private A' }); });
  const action = toasts.calls.find(item => item.action?.label === 'Try again')!.action!;
  localStorage.setItem('gk-session-id', 'owner-b');
  await act(async () => { action.onClick(); });
  expect(api.saveIdentity).toHaveBeenCalledTimes(1);
  expect(remembered(1)).toHaveLength(1);
});

it.each(['resolve', 'reject'] as const)('stops an old replay queue after a late %s and preserves its unsent tail', async outcome => {
  remember();
  const firstReply = deferred<PageView>();
  const sentBy: number[] = [];
  api.saveIdentity.mockImplementation(() => { sentBy.push(auth.id); return firstReply.promise; });
  const view = render(tree());
  await waitFor(() => expect(api.saveIdentity).toHaveBeenCalledTimes(1));
  switchAccount(); view.rerender(tree());
  await screen.findByText('Page B');
  const noticeCount = toasts.calls.length;
  await act(async () => {
    if (outcome === 'resolve') firstReply.resolve(named('Obsolete A response'));
    else firstReply.reject(new Error('Obsolete session response'));
  });
  expect(sentBy).toEqual([1]);
  expect(remembered(1)).toEqual(queue);
  expect(remembered(2)).toEqual([]);
  expect(toasts.calls).toHaveLength(noticeCount);
  expect(screen.getByText('Page B')).toBeInTheDocument();
  expect(screen.getByTestId('pending')).toHaveTextContent('0');
});

it('returns false for an obsolete in-flight save without showing its response in the new account', async () => {
  const reply = deferred<PageView>();
  api.saveIdentity.mockReturnValue(reply.promise);
  const view = render(tree()); await screen.findByText('Page A');
  let save!: Promise<boolean>;
  act(() => { save = editor.saveIdentity({ name: 'Private A' }, { label: 'Saved private A' }); });
  switchAccount(); view.rerender(tree()); await screen.findByText('Page B');
  let result: boolean | undefined;
  await act(async () => { reply.resolve(named('Private A')); result = await save; });
  expect(result).toBe(false);
  expect(screen.getByText('Page B')).toBeInTheDocument();
  expect(toasts.calls).toEqual([]);
  expect(remembered(1)).toHaveLength(1);
});

it('invalidates an old page action when the same mounted provider changes its page', async () => {
  api.saveIdentity.mockRejectedValueOnce(new Error('offline'));
  api.fetchPage.mockImplementation(async (ref: PageRef) => named(`Page ${ref.id}`, ref));
  const view = render(tree()); await screen.findByText('Page 7002');
  await act(async () => { await editor.saveIdentity({ about: 'Private old page' }); });
  const retry = toasts.calls.find(item => item.action?.label === 'Try again')!.action!;
  const oldEditor = editor;
  view.rerender(tree(7003)); await screen.findByText('Page 7003');
  await act(async () => {
    retry.onClick();
    await oldEditor.saveIdentity({ name: 'Old name' });
    await oldEditor.saveBox('squads', { items: [] });
    await oldEditor.saveLayout(oldEditor.page!.layout);
    await oldEditor.goLive();
  });
  expect(api.saveIdentity).toHaveBeenCalledTimes(1);
  expect(api.saveBox).not.toHaveBeenCalled();
  expect(api.saveLayout).not.toHaveBeenCalled();
  expect(api.goLive).not.toHaveBeenCalled();
});

it('keeps a conflicted receipt and tail durable, stops, and resumes in order on the next visit', async () => {
  remember();
  let server = named('Page A');
  const theirs = { ...server, identity: { ...server.identity, version: 3 } };
  api.fetchPage.mockImplementation(async () => server);
  api.saveIdentity.mockRejectedValueOnce(new PageConflict(theirs)).mockImplementation(async (_ref: PageRef, version: number, patch: Partial<PageView['identity']>) => {
    server = { ...server, identity: { ...server.identity, ...patch, version: version + 1 } }; return server;
  });
  const first = render(tree());
  await waitFor(() => expect(toasts.calls.some(item => item.action?.label === 'Keep mine')).toBe(true));
  expect(api.saveIdentity).toHaveBeenCalledTimes(1);
  expect(remembered()).toEqual(queue);
  expect(screen.getByTestId('pending')).toHaveTextContent('2');
  first.unmount(); server = theirs;
  render(tree());
  await waitFor(() => expect(api.saveIdentity).toHaveBeenCalledTimes(3));
  await waitFor(() => expect(remembered()).toEqual([]));
  expect(api.saveIdentity.mock.calls.map(args => args[2])).toEqual([queue[0].patch, queue[0].patch, queue[1].patch]);
  expect(server.identity.about).toBe('Latest private answer');
});

it('does not retire a later edit of the same field when retrying the first failed receipt', async () => {
  remember();
  let server = named('Page A');
  api.fetchPage.mockImplementation(async () => server);
  api.saveIdentity.mockRejectedValueOnce(new Error('offline')).mockImplementation(async (_ref: PageRef, version: number, patch: Partial<PageView['identity']>) => {
    server = { ...server, identity: { ...server.identity, ...patch, version: version + 1 } }; return server;
  });
  const first = render(tree());
  await waitFor(() => expect(toasts.calls.some(item => item.action?.label === 'Try again')).toBe(true));
  expect(api.saveIdentity).toHaveBeenCalledTimes(1);
  expect(remembered()).toEqual(queue);
  const retry = toasts.calls.find(item => item.action?.label === 'Try again')!.action!;
  await act(async () => { retry.onClick(); });
  await waitFor(() => expect(remembered()).toEqual([queue[1]]));
  expect(server.identity.about).toBe('First private answer');
  first.unmount(); render(tree());
  await waitFor(() => expect(remembered()).toEqual([]));
  expect(server.identity.about).toBe('Latest private answer');
});

it('invalidates an older failed-save toast after a newer acknowledged answer supersedes it', async () => {
  api.saveIdentity.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(named('Newer answer'));
  render(tree()); await screen.findByText('Page A');
  await act(async () => { await editor.saveIdentity({ name: 'Old answer' }); });
  const retry = toasts.calls.find(item => item.action?.label === 'Try again')!.action!;
  await act(async () => { await editor.saveIdentity({ name: 'Newer answer' }); });
  await act(async () => { retry.onClick(); });
  expect(api.saveIdentity).toHaveBeenCalledTimes(2);
  expect(remembered()).toEqual([]);
});

