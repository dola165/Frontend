import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PageView } from '../../api';
import { makePage, withSetup } from '../../__tests__/fixtures';

const api = vi.hoisted(() => ({ fetchPage: vi.fn(), saveIdentity: vi.fn(), saveBox: vi.fn(), saveLayout: vi.fn(), goLive: vi.fn(), fetchPitches: vi.fn(), PageConflict: class PageConflict extends Error { current: unknown; constructor(current: unknown) { super('conflict'); this.current = current; } } }));
const toasts = vi.hoisted(() => ({ calls: [] as { message: string; action?: { label: string; onClick: () => void } }[] }));
vi.mock('../../api', () => ({ fetchPage: api.fetchPage, saveIdentity: api.saveIdentity, saveBox: api.saveBox, saveLayout: api.saveLayout, goLive: api.goLive, fetchPitches: api.fetchPitches, PageConflict: api.PageConflict, pageBase: () => '', sameRef: () => false }));
vi.mock('sonner', () => {
  const record = (message: string, options?: { action?: { label: string; onClick: () => void } }) => { toasts.calls.push({ message, action: options?.action }); };
  return { toast: Object.assign(record, { warning: record, error: record, success: record }) };
});
vi.mock('../../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 9500 }, sessionId: 's1', status: 'authenticated' }) }));
vi.mock('../../../feed/feedEvents', () => ({ recordFunnelEvent: vi.fn() }));
vi.mock('../../../profiles/useProfilePostFeed', () => ({ useProfilePostFeed: () => ({ posts: [], pages: { loading: false, error: null, refresh: vi.fn(), more: false, loadMore: vi.fn() } }) }));
vi.mock('../../../profiles/ProfilePosts', () => ({ ProfilePosts: ({ empty }: { empty: { title: string } }) => <p>{empty.title}</p> }));

import { PageEditProvider } from '../PageEditProvider';
import { OrganizationPage } from '../../OrganizationPage';

function mount(path = '/organizations/7002?edit=1') {
  return render(<MemoryRouter initialEntries={[path]}><PageEditProvider pageRef={{ type: 'organization', id: 7002 }}><OrganizationPage /></PageEditProvider></MemoryRouter>);
}
const filledContact = (page: PageView): PageView => withSetup({ ...page, identity: { ...page.identity, version: page.identity.version + 1, contact: { phone: '+995 599 12 34 56', email: 'ultras@rustavi.ge' } } });

describe('edit mode on a page', () => {
  beforeEach(() => { toasts.calls.length = 0; api.fetchPage.mockReset(); api.saveIdentity.mockReset(); api.saveBox.mockReset(); api.goLive.mockReset(); sessionStorage.clear(); });

  it('never shows edit mode to someone who may not edit, whatever the address says', async () => {
    api.fetchPage.mockResolvedValue(makePage({ status: 'LIVE', viewer: { role: null, canEdit: false, editable: [], canClaim: false }, identity: { about: 'Supporters of Rustavi' } as never }));
    mount('/organizations/7002?edit=1&panel=contact');
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Rustavi Ultras');
    expect(screen.queryByRole('button', { name: 'Edit page' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
    expect(screen.queryByText('How to reach you')).toBeNull();
    expect(screen.queryByText('Draft · only you see this')).toBeNull();
  });

  it('shows the owner the draft strip, the setup ring and ghost boxes, and fills a box in place with autosave', async () => {
    const user = userEvent.setup();
    const page = makePage();
    api.fetchPage.mockResolvedValue(page);
    api.saveIdentity.mockImplementation(async () => filledContact(page));
    mount();
    expect(await screen.findByText('Draft · only you see this')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /1 of 7 done\. Next: Add your crest/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go live' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /How to reach you/ }));
    await user.type(screen.getByLabelText('Phone'), '+995 599 12 34 56');
    await user.click(screen.getByRole('button', { name: 'Use giorgi@example.org' }));
    // The bar has its own Done (edit mode off); the box's Done comes after it in the page.
    await user.click(screen.getAllByRole('button', { name: 'Done' }).at(-1)!);
    await waitFor(() => expect(api.saveIdentity).toHaveBeenCalledTimes(1));
    expect(api.saveIdentity.mock.calls[0][1]).toBe(1);
    expect(api.saveIdentity.mock.calls[0][2]).toMatchObject({ contact: { phone: '+995 599 12 34 56', email: 'giorgi@example.org' } });
    expect(await screen.findByText('ultras@rustavi.ge')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: '' })).toHaveTextContent('Saved');
    expect(screen.getByRole('button', { name: /2 of 7 done/ })).toBeInTheDocument();
    expect(toasts.calls.map(call => call.message)).toContain('Contact saved');
  });

  it('offers Undo on the toast, which saves the earlier values back with the version it reads then', async () => {
    const user = userEvent.setup();
    const page = makePage();
    const filled = filledContact(page);
    api.fetchPage.mockResolvedValue(page);
    api.saveIdentity.mockResolvedValueOnce(filled).mockResolvedValueOnce(page);
    mount();
    await user.click(await screen.findByRole('button', { name: /How to reach you/ }));
    await user.type(screen.getByLabelText('Phone'), '+995 599 12 34 56{Enter}');
    await waitFor(() => expect(toasts.calls.some(call => call.message === 'Contact saved')).toBe(true));
    const saved = toasts.calls.find(call => call.message === 'Contact saved');
    expect(saved?.action?.label).toBe('Undo');
    saved?.action?.onClick();
    await waitFor(() => expect(api.saveIdentity).toHaveBeenCalledTimes(2));
    expect(api.saveIdentity.mock.calls[1][1]).toBe(filled.identity.version);
    expect(api.saveIdentity.mock.calls[1][2]).toMatchObject({ contact: { phone: '', email: '' } });
  });

  it('shows theirs when someone else changed the same thing first, with Keep mine', async () => {
    const user = userEvent.setup();
    const page = makePage();
    const theirs = withSetup({ ...page, identity: { ...page.identity, version: 3, contact: { phone: '+995 555 00 00 00', email: '' } } });
    api.fetchPage.mockResolvedValue(page);
    api.saveIdentity.mockRejectedValueOnce(new api.PageConflict(theirs)).mockResolvedValueOnce(withSetup({ ...theirs, identity: { ...theirs.identity, version: 4, contact: { phone: '+995 599 12 34 56', email: '' } } }));
    mount();
    await user.click(await screen.findByRole('button', { name: /How to reach you/ }));
    await user.type(screen.getByLabelText('Phone'), '+995 599 12 34 56{Enter}');
    expect(await screen.findByText('+995 555 00 00 00')).toBeInTheDocument();
    const conflict = toasts.calls.find(call => call.message === 'Someone just changed this.');
    expect(conflict?.action?.label).toBe('Keep mine');
    conflict?.action?.onClick();
    await waitFor(() => expect(api.saveIdentity).toHaveBeenCalledTimes(2));
    expect(api.saveIdentity.mock.calls[1][1]).toBe(3);
    expect(await screen.findByText('+995 599 12 34 56')).toBeInTheDocument();
  });

  it('goes live once the page has a crest and a contact, and opens the share card', async () => {
    const user = userEvent.setup();
    const ready = filledContact(makePage({ identity: { crest: { kind: 'generated', design: { shape: 'shield', primary: 'red', secondary: 'white', initials: 'RU' }, kept: true, url: '/x.svg' } } as never }));
    api.fetchPage.mockResolvedValue(ready);
    api.goLive.mockResolvedValue({ ...ready, status: 'LIVE', liveAt: '2026-10-15T11:00:00Z' });
    mount();
    const live = await screen.findByRole('button', { name: 'Go live' });
    expect(live).toBeEnabled();
    await user.click(live);
    await waitFor(() => expect(api.goLive).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('dialog', { name: 'Your page is live' })).toBeInTheDocument();
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
    expect(screen.queryByText('Draft · only you see this')).toBeNull();
  });
});
