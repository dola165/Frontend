import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PageView } from '../../api';
import { makePage } from '../../__tests__/fixtures';

const api = vi.hoisted(() => ({ fetchPage: vi.fn(), saveIdentity: vi.fn(), saveBox: vi.fn(), saveLayout: vi.fn(), goLive: vi.fn(), PageConflict: class PageConflict extends Error { current: unknown; constructor(current: unknown) { super('conflict'); this.current = current; } } }));
const toasts = vi.hoisted(() => ({ calls: [] as { message: string; action?: { label: string; onClick: () => void } }[] }));
vi.mock('../../api', async original => ({ ...await original<typeof import('../../api')>(), fetchPage: api.fetchPage, saveIdentity: api.saveIdentity, saveBox: api.saveBox, saveLayout: api.saveLayout, goLive: api.goLive, PageConflict: api.PageConflict }));
vi.mock('sonner', () => {
  const record = (message: string, options?: { action?: { label: string; onClick: () => void } }) => { toasts.calls.push({ message, action: options?.action }); };
  return { toast: Object.assign(record, { warning: record, error: record, success: record }) };
});
vi.mock('../../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 9500 }, sessionId: 's1', status: 'authenticated' }) }));
vi.mock('../../../feed/feedEvents', () => ({ recordFunnelEvent: vi.fn() }));

import { PageEditProvider } from '../PageEditProvider';
import { usePageEdit } from '../context';

/** A stand-in for the name field: one button per name, and the name as the page has it. */
function Probe() {
  const { page, saveIdentity } = usePageEdit();
  return <>
    <p>{page?.identity.name}</p>
    <button type="button" onClick={() => void saveIdentity({ name: 'Name A' })}>Save A</button>
    <button type="button" onClick={() => void saveIdentity({ name: 'Name B' })}>Save B</button>
  </>;
}
const mount = () => render(<MemoryRouter initialEntries={['/organizations/7002?edit=1']}><PageEditProvider pageRef={{ type: 'organization', id: 7002 }}><Probe /></PageEditProvider></MemoryRouter>);
const named = (page: PageView, name: string, version: number): PageView => ({ ...page, identity: { ...page.identity, name, version } });
const offline = () => Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' });

describe('recovering edits the network dropped (F01)', () => {
  beforeEach(() => { toasts.calls.length = 0; vi.clearAllMocks(); sessionStorage.clear(); localStorage.setItem('gk-session-id', 's1'); });

  it('retires a failed edit once its retry succeeds, so a newer edit is never overwritten on return', async () => {
    const user = userEvent.setup();
    const page = makePage();
    api.fetchPage.mockResolvedValue(page);
    api.saveIdentity.mockRejectedValueOnce(offline()).mockResolvedValueOnce(named(page, 'Name A', 2)).mockResolvedValueOnce(named(page, 'Name B', 3));
    const first = mount();
    await user.click(await screen.findByRole('button', { name: 'Save A' }));
    const failed = await waitFor(() => { const call = toasts.calls.find(item => item.action?.label === 'Try again'); expect(call).toBeDefined(); return call!; });
    failed.action!.onClick();
    expect(await screen.findByText('Name A')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save B' }));
    expect(await screen.findByText('Name B')).toBeInTheDocument();
    first.unmount();

    api.fetchPage.mockResolvedValue(named(page, 'Name B', 3));
    mount();
    expect(await screen.findByText('Name B')).toBeInTheDocument();
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(api.saveIdentity).toHaveBeenCalledTimes(3);
  });

  it('keeps a failed edit nothing newer replaced, and sends it when the page opens next', async () => {
    const user = userEvent.setup();
    const page = makePage();
    api.fetchPage.mockResolvedValue(page);
    api.saveIdentity.mockRejectedValueOnce(offline()).mockResolvedValueOnce(named(page, 'Name A', 2));
    const first = mount();
    await user.click(await screen.findByRole('button', { name: 'Save A' }));
    await waitFor(() => expect(toasts.calls.some(item => item.action?.label === 'Try again')).toBe(true));
    first.unmount();

    mount();
    await waitFor(() => expect(api.saveIdentity).toHaveBeenCalledTimes(2));
    expect(api.saveIdentity.mock.calls[1][2]).toEqual({ name: 'Name A' });
    expect(await screen.findByText('Name A')).toBeInTheDocument();
  });
});
