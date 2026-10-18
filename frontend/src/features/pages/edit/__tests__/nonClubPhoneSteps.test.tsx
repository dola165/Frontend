import { act, render, screen, waitFor, within } from '@testing-library/react';
import { useLayoutEffect } from 'react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import type { PageRef, PageView } from '../../api';
import { makePage } from '../../__tests__/fixtures';
import type { PageKind } from '../../model/kinds';
import { PageEditProvider } from '../PageEditProvider';
import { PagePanels } from '../PagePanels';
import { PhoneSteps } from '../PhoneSteps';
import { usePageEdit, type PageEdit } from '../context';

const api = vi.hoisted(() => ({ fetchPage: vi.fn(), goLive: vi.fn(), saveIdentity: vi.fn() }));
vi.mock('../../api', async original => ({ ...await original<typeof import('../../api')>(), ...api }));
vi.mock('../../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 9502 }, sessionId: 'nonclub-session', status: 'authenticated' }) }));
vi.mock('../../../world/useMediaQuery', () => ({ useMediaQuery: () => true }));

function mount(kind: PageKind) {
  const page = makePage({ kind });
  api.fetchPage.mockResolvedValue(page);
  api.goLive.mockResolvedValue({ ...page, status: 'LIVE' } satisfies PageView);
  return render(<MemoryRouter initialEntries={['/organizations/7002?edit=1&steps=posts']}><PageEditProvider pageRef={page.ref}><PhoneSteps /><PagePanels /></PageEditProvider></MemoryRouter>);
}
beforeEach(() => {
  vi.resetAllMocks(); sessionStorage.clear(); localStorage.clear();
  localStorage.setItem('gk-session-id', 'nonclub-session');
});

it.each(['FAN_CLUB', 'BUSINESS', 'PAGE'] as const)('%s first-post step opens the existing publication share card with only a name', async kind => {
  const user = userEvent.setup();
  mount(kind);
  const steps = await screen.findByRole('dialog', { name: 'Set-up steps' });
  expect(within(steps).getByRole('heading', { name: 'Write the first post' })).toBeVisible();
  expect(within(steps).getByText('Your first post is written for you when you go live.')).toBeVisible();
  expect(api.goLive).not.toHaveBeenCalled();
  await user.click(within(steps).getByRole('button', { name: 'Go live' }));
  const share = await screen.findByRole('dialog', { name: 'Your page is live' });
  expect(within(share).getByRole('textbox', { name: 'Your first post' })).toHaveValue('Rustavi Ultras joined GrassKickZ');
  expect(api.goLive).toHaveBeenCalledExactlyOnceWith({ type: 'organization', id: 7002 }, expect.stringMatching(/^[\da-f-]{36}$/));
  expect(api.saveIdentity).not.toHaveBeenCalled();
  expect(screen.queryByRole('dialog', { name: 'Name and town' })).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog', { name: 'Set-up steps' })).not.toBeInTheDocument();
});

it('retains the first-post step after an unanswered publication and lets an explicit retry finish it', async () => {
  const user = userEvent.setup();
  mount('BUSINESS');
  api.goLive.mockRejectedValueOnce(new Error('response lost'));
  const steps = await screen.findByRole('dialog', { name: 'Set-up steps' });
  await user.click(within(steps).getByRole('button', { name: 'Go live' }));
  await waitFor(() => expect(api.goLive).toHaveBeenCalledTimes(1));
  expect(screen.getByRole('dialog', { name: 'Set-up steps' })).toBeVisible();
  expect(screen.queryByRole('dialog', { name: 'Your page is live' })).not.toBeInTheDocument();
  await user.click(within(steps).getByRole('button', { name: 'Go live' }));
  expect(await screen.findByRole('dialog', { name: 'Your page is live' })).toBeVisible();
  expect(api.goLive.mock.calls[1]).toEqual(api.goLive.mock.calls[0]);
  expect(api.saveIdentity).not.toHaveBeenCalled();
});

it('recovers each page type draft only on that same organization page', async () => {
  const kinds = ['FAN_CLUB', 'BUSINESS', 'PAGE'] as const;
  const pages = new Map<number, PageView>(kinds.map((kind, index) => {
    const id = 7100 + index, original = makePage({ kind, organizationId: id, ref: { type: 'organization', id } });
    return [id, { ...original, identity: { ...original.identity, name: kind } }];
  }));
  const failOnce = new Set(pages.keys());
  api.fetchPage.mockImplementation(async (ref: PageRef) => pages.get(ref.id));
  api.saveIdentity.mockImplementation(async (ref: PageRef, version: number, patch: Partial<PageView['identity']>) => {
    if (failOnce.delete(ref.id)) throw new Error('unanswered edit');
    const before = pages.get(ref.id)!;
    const next = { ...before, identity: { ...before.identity, ...patch, version: version + 1 } };
    pages.set(ref.id, next);
    return next;
  });
  let editor: PageEdit | undefined;
  function RecoveryProbe() {
    const value = usePageEdit();
    useLayoutEffect(() => { editor = value; }, [value]);
    return <p>{value.page?.identity.name ?? 'Loading'}</p>;
  }
  const tree = (id: number) => <MemoryRouter><PageEditProvider pageRef={{ type: 'organization', id }}><RecoveryProbe /></PageEditProvider></MemoryRouter>;
  const view = render(tree(7100));
  for (const [index, kind] of kinds.entries()) {
    if (index) view.rerender(tree(7100 + index));
    await screen.findByText(kind);
    expect(editor!.pendingCount).toBe(0);
    await act(async () => { expect(await editor!.saveIdentity({ about: `Private ${kind}` })).toBe(false); });
    expect(api.saveIdentity).toHaveBeenCalledTimes(index + 1);
  }
  for (const [index, kind] of kinds.entries()) {
    view.rerender(tree(7100 + index));
    await screen.findByText(kind);
    await waitFor(() => expect(editor!.pendingCount).toBe(0));
    expect(api.saveIdentity).toHaveBeenCalledTimes(4 + index);
    expect(pages.get(7100 + index)!.identity.about).toBe(`Private ${kind}`);
  }
  expect(api.saveIdentity.mock.calls.map(args => args[0].id)).toEqual([7100, 7101, 7102, 7100, 7101, 7102]);
});
