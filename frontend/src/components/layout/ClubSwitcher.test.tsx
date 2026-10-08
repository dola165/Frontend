import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { ClubAccessEntry, ClubSwitcher } from './ClubSwitcher';
import { accessibleClubs } from './clubAccess';
import i18n from '../../i18n';
const auth = vi.hoisted(() => ({ sessionId: 'luka', user: { navigationCapabilities: { version: 1 as const, workspaces: [] as { id: string; context: { id: number; type: string; label: string } }[] } } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));
const club = (id: number, capability = 'club.workspace') => ({ id: capability, context: { type: 'club', id, label: id === 1 ? 'Dinamo' : 'Chveni' } });
function Destination() { return <p>{useLocation().pathname}</p>; }
const open = () => render(<MemoryRouter initialEntries={['/clubs/1']}><ClubSwitcher /><ClubAccessEntry><p>Existing entry</p></ClubAccessEntry><Destination /></MemoryRouter>);
beforeEach(() => { auth.sessionId = 'luka'; auth.user.navigationCapabilities.workspaces = [club(1), club(121)]; });
it('lists each club once and uses only club capabilities', () => {
  auth.user.navigationCapabilities.workspaces.push(club(1, 'club.player'), club(3, 'venue.workspace'), club(4, 'parent.hub'));
  expect(accessibleClubs(auth.user.navigationCapabilities)).toHaveLength(2);
});
it.each([[], [club(3, 'venue.workspace'), club(4, 'venue.workspace')], [club(3, 'parent.hub'), club(4, 'organization.workspace')]].map(entries => [entries] as const))('preserves the existing entry without a current club connection %#', entries => {
  auth.user.navigationCapabilities.workspaces = entries; open();
  expect(screen.queryByRole('button', { name: 'Switch club' })).not.toBeInTheDocument();
  expect(screen.getByText('Existing entry')).toBeInTheDocument();
});
it('opens either club profile and closes on navigation', () => {
  open(); fireEvent.click(screen.getByRole('button', { name: 'Switch club' }));
  const dialog = screen.getByRole('dialog');
  fireEvent.click(within(within(dialog).getByRole('region', { name: 'Chveni' })).getByRole('link', { name: 'View profile' }));
  expect(screen.getByText('/clubs/121')).toBeInTheDocument(); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('provides workspace links only for approved workspace access', () => {
  auth.user.navigationCapabilities.workspaces = [club(1), club(121, 'club.player')]; open();
  expect(screen.getAllByRole('link', { name: 'Open workspace' })).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Switch club' }));
  expect(within(screen.getByRole('dialog')).getAllByRole('link', { name: 'Open workspace' })).toHaveLength(1);
});
it('closes by Escape with keyboard focus restored and outside pointer', () => {
  open(); const trigger = screen.getByRole('button', { name: 'Switch club' }); fireEvent.click(trigger);
  expect(within(screen.getByRole('dialog')).getAllByRole('link')[0]).toHaveFocus();
  fireEvent.keyDown(document, { key: 'Escape' }); expect(trigger).toHaveFocus(); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(trigger); fireEvent.pointerDown(document.body); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('removes the chooser on revoked access without stale club links', () => {
  const result = open(); fireEvent.click(screen.getByRole('button', { name: 'Switch club' }));
  auth.user.navigationCapabilities.workspaces = [club(1)];
  result.rerender(<MemoryRouter><ClubSwitcher /><ClubAccessEntry>Existing entry</ClubAccessEntry></MemoryRouter>);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(screen.queryByText('Chveni')).not.toBeInTheDocument();
});
it('identifies the current club and current destination without granting extra workspace access', () => {
  open(); fireEvent.click(screen.getByRole('button', { name: 'Switch club' }));
  const dinamo = within(screen.getByRole('dialog')).getByRole('region', { name: 'Dinamo' });
  expect(within(dinamo).getByText('Current club')).toBeInTheDocument();
  expect(within(dinamo).getByRole('link', { name: 'View profile' })).toHaveAttribute('aria-current', 'page');
  expect(within(dinamo).getByRole('link', { name: 'Open workspace' })).not.toHaveAttribute('aria-current');
});
it('renders Georgian club selection labels', async () => {
  await i18n.changeLanguage('ka');
  try { open(); fireEvent.click(screen.getByRole('button', { name: 'კლუბის შეცვლა' })); expect(screen.getByRole('dialog', { name: 'აირჩიეთ თქვენი კლუბი' })).toBeInTheDocument(); }
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
  expect(screen.queryByRole('heading', {name: 'My clubs'})).not.toBeInTheDocument();
});
