import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SimilarPage } from '../../api';

const api = vi.hoisted(() => ({ fetchSimilar: vi.fn(), createPage: vi.fn() }));
const auth = vi.hoisted(() => ({ user: { id: 9500, dob: '1985-05-02' } as { id: number; dob: string }, refresh: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../api', () => ({ fetchSimilar: api.fetchSimilar, createPage: api.createPage }));
vi.mock('../../../../context/AuthContext', () => ({ useAuth: () => ({ user: auth.user, status: 'authenticated', refreshNavigationCapabilities: auth.refresh }) }));
vi.mock('../../../start/startApi', () => ({ fetchSavedTown: vi.fn().mockResolvedValue({ name: 'Rustavi', latitude: 41.5495, longitude: 45.0012 }) }));

import { CreatePageHost } from '../CreatePageHost';
import { StartSheet } from '../StartSheet';

const dinamo: SimilarPage = { ref: { type: 'club', id: 2 }, name: 'FC Dinamo Tbilisi', town: 'Tbilisi', kind: 'CLUB', crestUrl: null, status: 'LIVE', mine: false, exact: false };
const listing: SimilarPage = { ref: { type: 'club', id: 307 }, name: 'Rustavi Metallurgi Kids', town: 'Rustavi', kind: 'CLUB', crestUrl: null, status: 'LIVE', mine: false, exact: false };

function mount(props: Partial<Parameters<typeof StartSheet>[0]> = {}) {
  const onClose = vi.fn();
  render(
    <MemoryRouter initialEntries={['/home?create=any&from=home']}>
      <Routes>
        <Route path="/home" element={<StartSheet kind={null} from="home" draw={false} onClose={onClose} {...props} />} />
        <Route path="/clubs/:id" element={<p>The club page</p>} />
      </Routes>
    </MemoryRouter>,
  );
  return { onClose };
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

  it('shows known pages that look like the name as listings to open', async () => {
    const user = userEvent.setup();
    api.fetchSimilar.mockResolvedValue([listing, dinamo]);
    mount({ kind: 'CLUB' });
    await user.type(screen.getByLabelText('Club name'), 'Metalurgi');
    expect(await screen.findByText('Looking for one of these?')).toBeInTheDocument();
    expect(api.fetchSimilar).toHaveBeenCalledWith('Metalurgi', expect.any(String), expect.anything());
    expect(screen.queryByRole('button', { name: 'Claim it' })).toBeNull();
    expect(screen.getAllByRole('link', { name: 'Open' }).map(link => link.getAttribute('href'))).toEqual(['/clubs/307', '/clubs/2']);
    expect(screen.getByRole('button', { name: 'Create club' })).toBeEnabled();
  });

  it('says an exact name is already on GrassKickZ and still lets the person start their own', async () => {
    const user = userEvent.setup();
    api.fetchSimilar.mockResolvedValue([{ ...dinamo, exact: true }]);
    api.createPage.mockResolvedValue({ id: 7002, clubId: 401, profilePath: '/clubs/401', workspacePath: '/clubs/401/workspace' });
    mount({ kind: 'CLUB' });
    await user.type(screen.getByLabelText('Club name'), 'Dinamo Tbilisi');
    expect(await screen.findByText('This is already on GrassKickZ')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute('href', '/clubs/2');
    await user.click(screen.getByRole('button', { name: 'Create club' }));
    await waitFor(() => expect(api.createPage).toHaveBeenCalledTimes(1));
  });

  it('staff means one club: starting a club while staff elsewhere asks to leave that club first', async () => {
    const user = userEvent.setup();
    api.createPage.mockRejectedValue({ isAxiosError: true, response: { status: 409, data: { code: 'STAFF_OF_ANOTHER_CLUB', message: 'You are staff at Saburtalo.', otherClubId: 3, otherClubName: 'Saburtalo' } } });
    mount({ kind: 'CLUB' });
    await user.type(screen.getByLabelText('Club name'), 'Rustavi Juniors');
    await user.click(screen.getByRole('button', { name: 'Create club' }));
    expect(await screen.findByText('You’re staff at Saburtalo. Leave Saburtalo first.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Leave Saburtalo' })).toBeInTheDocument();
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

  it('starts a business page with the kind of business the person already picked', async () => {
    const user = userEvent.setup();
    api.createPage.mockResolvedValue({ id: 7001, clubId: null, profilePath: '/organizations/7001', workspacePath: '/organizations/7001/workspace' });
    mount({ kind: 'BUSINESS', business: 'SPONSOR' });
    await user.type(screen.getByLabelText('Business name'), 'Kartuli Sponsor{Enter}');
    await waitFor(() => expect(api.createPage).toHaveBeenCalledTimes(1));
    expect(api.createPage.mock.calls[0][0]).toMatchObject({ pageKind: 'BUSINESS', organizationType: 'COMPANY', businessKind: 'SPONSOR' });
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

  it('asks an account without a birth date for it before the sheet', async () => {
    auth.user = { id: 9503, dob: '' };
    render(<MemoryRouter initialEntries={['/home?create=club&from=link']}><Routes><Route path="/home" element={<CreatePageHost />} /></Routes></MemoryRouter>);
    expect(await screen.findByRole('dialog', { name: 'Your date of birth' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Club name')).toBeNull();
  });

  it('tells someone under 18 that pages are for adults, whatever kind the link asks for', async () => {
    auth.user = { id: 9501, dob: `${new Date().getFullYear() - 17}-01-01` };
    render(<MemoryRouter initialEntries={['/home?create=fan-club&from=link']}><Routes><Route path="/home" element={<CreatePageHost />} /></Routes></MemoryRouter>);
    expect(await screen.findByRole('dialog', { name: 'Pages are for adults' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Fan club name')).toBeNull();
  });
});
