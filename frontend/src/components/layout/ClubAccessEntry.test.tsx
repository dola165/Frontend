import { render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { ClubAccessEntry } from './ClubAccessEntry';
import { accessibleClubs } from './clubAccess';
import i18n from '../../i18n';
const auth = vi.hoisted(() => ({ sessionId: 'luka', user: { navigationCapabilities: { version: 1 as const, workspaces: [] as { id: string; context: { id: number; type: string; label: string } }[] } } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('./ConnectedWork', () => ({ ConnectedWork: () => null }));
const club = (id: number, capability = 'club.workspace') => ({ id: capability, context: { type: 'club', id, label: id === 1 ? 'Dinamo' : 'Chveni' } });
function Destination() { return <p>{useLocation().pathname}</p>; }
const open = () => render(<MemoryRouter initialEntries={['/my-club']}><ClubAccessEntry><p>Existing entry</p></ClubAccessEntry><Destination /></MemoryRouter>);
beforeEach(() => { auth.sessionId = 'luka'; auth.user.navigationCapabilities.workspaces = [club(1), club(121)]; });
it('lists each club once and uses only club capabilities', () => {
  auth.user.navigationCapabilities.workspaces.push(club(1, 'club.player'), club(3, 'venue.workspace'), club(4, 'parent.hub'));
  expect(accessibleClubs(auth.user.navigationCapabilities)).toHaveLength(2);
});
it.each([[], [club(3, 'venue.workspace'), club(4, 'venue.workspace')], [club(3, 'parent.hub'), club(4, 'organization.workspace')]].map(entries => [entries] as const))('preserves the existing entry without a current club connection %#', entries => {
  auth.user.navigationCapabilities.workspaces = entries; open();
  expect(screen.getByText('Existing entry')).toBeInTheDocument();
});
it('lets someone still connected to several clubs choose, saying "Your clubs" rather than "My clubs"', () => {
  open();
  expect(screen.getByRole('heading', { name: 'Your clubs' })).toBeInTheDocument();
  expect(screen.queryByText(/My clubs/i)).not.toBeInTheDocument();
  expect(screen.getAllByRole('link', { name: 'View profile' })).toHaveLength(2);
});
it('provides workspace links only for approved workspace access', () => {
  auth.user.navigationCapabilities.workspaces = [club(1), club(121, 'club.player')]; open();
  expect(screen.getAllByRole('link', { name: 'Open workspace' })).toHaveLength(1);
});
it('renders the Georgian chooser heading', async () => {
  await i18n.changeLanguage('ka');
  try { open(); expect(screen.getByRole('heading', { name: 'თქვენი კლუბები' })).toBeInTheDocument(); }
  finally { await i18n.changeLanguage('en'); }
});
it('keeps a family-only connection in Parent Hub without creating My Club', () => {
  auth.user.navigationCapabilities.workspaces = [club(1, 'club.family')]; open();
  expect(accessibleClubs(auth.user.navigationCapabilities)).toEqual([]);
  expect(screen.getByText('Existing entry')).toBeInTheDocument();
});
it('opens a single own club directly and retains parent plus coach access', () => {
  auth.user.navigationCapabilities.workspaces = [club(1, 'club.family'), club(121, 'club.operations')]; open();
  expect(screen.getByText('/clubs/121')).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Your clubs' })).not.toBeInTheDocument();
});
