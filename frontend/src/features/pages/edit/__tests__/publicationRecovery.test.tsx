import { act, render, screen } from '@testing-library/react';
import { useLayoutEffect } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import type { PageView } from '../../api';
import { makePage } from '../../__tests__/fixtures';
import { PageEditProvider } from '../PageEditProvider';
import { usePageEdit, type PageEdit } from '../context';

const auth = vi.hoisted(() => ({ id: 1, session: 'owner-a' }));
const api = vi.hoisted(() => ({ fetchPage: vi.fn(), goLive: vi.fn() }));
const toasts = vi.hoisted(() => ({ calls: [] as { action?: { label: string; onClick: () => void } }[] }));
const funnel = vi.hoisted(() => vi.fn());
vi.mock('../../api', async original => ({ ...await original<typeof import('../../api')>(), ...api }));
vi.mock('../../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: auth.id }, sessionId: auth.session, status: 'authenticated' }) }));
vi.mock('../../../feed/feedEvents', () => ({ recordFunnelEvent: funnel }));
vi.mock('sonner', () => {
  const record = (_message: string, options?: { action?: { label: string; onClick: () => void } }) => toasts.calls.push(options ?? {});
  return { toast: Object.assign(record, { warning: record, error: record }) };
});

let editor: PageEdit;
function Probe() {
  const value = usePageEdit();
  useLayoutEffect(() => { editor = value; }, [value]);
  return <><p>{value.page?.identity.name ?? 'Loading'}</p><span data-testid="panel">{value.panel}</span></>;
}
const tree = () => <MemoryRouter><PageEditProvider pageRef={{ type: 'organization', id: 7002 }}><Probe /></PageEditProvider></MemoryRouter>;
const page = (status: 'DRAFT' | 'LIVE' = 'DRAFT'): PageView => {
  const result = makePage({ status });
  return { ...result, identity: { ...result.identity, name: auth.id === 1 ? 'Page A' : 'Page B' } };
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
}
function switchAccount() { auth.id = 2; auth.session = 'owner-b'; localStorage.setItem('gk-session-id', auth.session); }
beforeEach(() => {
  vi.resetAllMocks(); toasts.calls.length = 0; sessionStorage.clear(); localStorage.clear();
  auth.id = 1; auth.session = 'owner-a'; localStorage.setItem('gk-session-id', auth.session);
  api.fetchPage.mockImplementation(async () => page());
});

it('reuses the publication receipt after an unknown reply and opens the share card when its toast retry succeeds', async () => {
  api.goLive.mockRejectedValueOnce(new Error('response lost')).mockImplementation(async () => page('LIVE'));
  render(tree()); await screen.findByText('Page A');
  await act(async () => { expect(await editor.goLive()).toBe(false); });
  const retry = toasts.calls.find(item => item.action?.label === 'Try again')!.action!;
  await act(async () => { retry.onClick(); });
  expect(api.goLive).toHaveBeenCalledTimes(2);
  expect(api.goLive.mock.calls[1]).toEqual(api.goLive.mock.calls[0]);
  expect(editor.page?.status).toBe('LIVE');
  expect(screen.getByTestId('panel')).toHaveTextContent('live');
  expect(funnel).toHaveBeenCalledExactlyOnceWith('PAGE_LIVE', { pageRef: 'organization-7002' });
});

it('coalesces repeated publication while pending and does not republish an acknowledged page', async () => {
  const reply = deferred<PageView>();
  api.goLive.mockReturnValueOnce(reply.promise);
  render(tree()); await screen.findByText('Page A');
  let first!: Promise<boolean>, second!: Promise<boolean>;
  act(() => { first = editor.goLive(); second = editor.goLive(); });
  expect(api.goLive).toHaveBeenCalledTimes(1);
  await act(async () => { reply.resolve(page('LIVE')); expect(await first).toBe(true); expect(await second).toBe(true); });
  expect(funnel).toHaveBeenCalledTimes(1);
  await act(async () => { expect(await editor.goLive()).toBe(true); });
  expect(api.goLive).toHaveBeenCalledTimes(1);
});

it('uses the same receipt for an ordinary retry after an unknown reply', async () => {
  api.goLive.mockRejectedValueOnce(new Error('unknown reply')).mockImplementation(async () => page('LIVE'));
  render(tree()); await screen.findByText('Page A');
  await act(async () => { await editor.goLive(); });
  await act(async () => { await editor.goLive(); });
  expect(api.goLive.mock.calls[1]).toEqual(api.goLive.mock.calls[0]);
  expect(screen.getByTestId('panel')).toHaveTextContent('live');
});

it('cannot retry an old publication as another account', async () => {
  api.goLive.mockRejectedValueOnce(new Error('unknown reply'));
  const view = render(tree()); await screen.findByText('Page A');
  await act(async () => { await editor.goLive(); });
  const retry = toasts.calls.find(item => item.action?.label === 'Try again')!.action!;
  switchAccount(); view.rerender(tree()); await screen.findByText('Page B');
  await act(async () => { retry.onClick(); });
  expect(api.goLive).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('panel')).toBeEmptyDOMElement();
  expect(funnel).not.toHaveBeenCalled();
});

it('does not complete a late publication in the next account', async () => {
  const reply = deferred<PageView>();
  const oldResult = page('LIVE');
  api.goLive.mockReturnValue(reply.promise);
  const view = render(tree()); await screen.findByText('Page A');
  let save!: Promise<boolean>;
  act(() => { save = editor.goLive(); });
  switchAccount(); view.rerender(tree()); await screen.findByText('Page B');
  await act(async () => { reply.resolve(oldResult); expect(await save).toBe(false); });
  expect(editor.page?.status).toBe('DRAFT');
  expect(screen.getByTestId('panel')).toBeEmptyDOMElement();
  expect(funnel).not.toHaveBeenCalled();
});
