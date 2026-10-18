import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SimilarPage } from '../../api';

const api = vi.hoisted(() => ({ fetchSimilar: vi.fn(), createPage: vi.fn() }));
const auth = vi.hoisted(() => ({ user: { id: 9500, dob: '1985-05-02' } as { id: number; dob: string }, refresh: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../api', () => ({ fetchSimilar: api.fetchSimilar, createPage: api.createPage }));
vi.mock('../../../../context/AuthContext', () => ({ useAuth: () => ({ user: auth.user, status: 'authenticated', refreshNavigationCapabilities: auth.refresh }) }));
vi.mock('../../../start/startApi', () => ({ fetchFeedPreferences: vi.fn().mockResolvedValue({ town: { name: 'Rustavi', latitude: 41.5495, longitude: 45.0012 }, topics: [], activity: null }) }));

import { StartSheet } from '../StartSheet';

const dinamo: SimilarPage = { ref: { type: 'club', id: 2 }, name: 'FC Dinamo Tbilisi', town: 'Tbilisi', kind: 'CLUB', crestUrl: null, status: 'LIVE', claim: null, mine: false, exact: false };
const unclaimed: SimilarPage = { ref: { type: 'club', id: 307 }, name: 'Rustavi Metallurgi Kids', town: 'Rustavi', kind: 'CLUB', crestUrl: null, status: 'LIVE', claim: 'UNCLAIMED', mine: false, exact: false };

function mount(props: Partial<Parameters<typeof StartSheet>[0]> = {}) {
  const onClose = vi.fn(), onClaim = vi.fn();
  render(
    <MemoryRouter initialEntries={['/home?create=any&from=home']}>
      <Routes>
        <Route path="/home" element={<StartSheet kind={null} from="home" draw={false} onClose={onClose} onClaim={onClaim} {...props} />} />
        <Route path="/clubs/:id" element={<p>The club page</p>} />
      </Routes>
    </MemoryRouter>,
  );
  return { onClose, onClaim };
}

describe('the start sheet', () => {
  beforeEach(() => { sessionStorage.clear(); api.fetchSimilar.mockReset().mockResolvedValue([]); api.createPage.mockReset(); auth.user = { id: 9500, dob: '1985-05-02' }; });

  it('asks what it is with four tiles, then only for a name with the town already filled in', async () => {
    const user = userEvent.setup();
    mount();
    expect(screen.getAllByRole('radio')).toHaveLength(4);
    expect(screen.queryByLabelText('Club name')).toBeNull();
    await user.click(screen.getByRole('radio', { name: /^Club/ }));
    expect(screen.getByLabelText('Club name')).toBeInTheDocument();
    await screen.findByRole('button', { name: 'Change town' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Change town' })).toHaveTextContent('Rustavi'));
  });

  it('starts on Club when the person came from a football entry point', () => {
    mount({ from: 'my-club' });
    expect(screen.getByRole('radio', { name: /^Club/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText('Club name')).toBeInTheDocument();
  });

  it('shows a known club that looks like the name, with Claim it for an unclaimed one', async () => {
    const user = userEvent.setup();
    api.fetchSimilar.mockResolvedValue([unclaimed, dinamo]);
    const { onClaim } = mount({ kind: 'CLUB' });
    await user.type(screen.getByLabelText('Club name'), 'Metalurgi');
    expect(await screen.findByText('Is this your club?')).toBeInTheDocument();
    expect(api.fetchSimilar).toHaveBeenCalledWith('Metalurgi', expect.any(String), expect.anything());
    await user.click(screen.getByRole('button', { name: 'Claim it' }));
    expect(onClaim).toHaveBeenCalledWith({ type: 'club', id: 307 });
    expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute('href', '/clubs/2');
  });

  it('never creates a copy of a known name: the button becomes Open it', async () => {
    const user = userEvent.setup();
    api.fetchSimilar.mockResolvedValue([{ ...dinamo, exact: true }]);
    mount({ kind: 'CLUB' });
    await user.type(screen.getByLabelText('Club name'), 'Dinamo Tbilisi');
    expect(await screen.findByText('This is already on GrassKickZ')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create club' })).toBeNull();
    expect(screen.getAllByRole('link', { name: 'Open' }).length).toBeGreaterThan(0);
    expect(api.createPage).not.toHaveBeenCalled();
  });

  it('creates the club with the name and town and lands on the page', async () => {
    const user = userEvent.setup();
    api.createPage.mockResolvedValue({ id: 7000, clubId: 400, profilePath: '/clubs/400', workspacePath: '/clubs/400/workspace' });
    mount({ kind: 'CLUB' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Change town' })).toHaveTextContent('Rustavi'));
    await user.type(screen.getByLabelText('Club name'), 'Rustavi Lions{Enter}');
    await waitFor(() => expect(api.createPage).toHaveBeenCalledTimes(1));
    expect(api.createPage.mock.calls[0][0]).toMatchObject({ displayName: 'Rustavi Lions', pageKind: 'CLUB', organizationType: 'CLUB', clubCategory: 'COMMUNITY_CLUB', location: { city: 'Rustavi' } });
    expect(api.createPage.mock.calls[0][0].requestId).toMatch(/^[\da-f-]{36}$/);
    expect(await screen.findByText('The club page')).toBeInTheDocument();
  });

  it('retries with the same request id, so a lost answer never makes two pages', async () => {
    const user = userEvent.setup();
    api.createPage.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ id: 7000, clubId: 400, profilePath: '/clubs/400', workspacePath: '/clubs/400/workspace' });
    mount({ kind: 'CLUB' });
    await user.type(screen.getByLabelText('Club name'), 'Rustavi Lions');
    await user.click(screen.getByRole('button', { name: 'Create club' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create club' }));
    await waitFor(() => expect(api.createPage).toHaveBeenCalledTimes(2));
    expect(api.createPage.mock.calls[0][0].requestId).toBe(api.createPage.mock.calls[1][0].requestId);
  });

  it('locks a club and a business for someone under 18, and lets them start a fan club', async () => {
    const user = userEvent.setup();
    auth.user = { id: 9501, dob: `${new Date().getFullYear() - 15}-05-02` };
    mount({ from: 'my-club' });
    const club = screen.getByRole('radio', { name: /^Club/ });
    expect(club).toHaveAttribute('aria-disabled', 'true');
    expect(club).toHaveTextContent('From 18');
    await user.click(club);
    expect(screen.getByRole('status')).toHaveTextContent('From 18');
    expect(screen.queryByLabelText('Club name')).toBeNull();
    await user.click(screen.getByRole('radio', { name: /^Fan club/ }));
    expect(screen.getByLabelText('Fan club name')).toBeInTheDocument();
  });
});
