import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MyOrganizationsPage } from '../MyOrganizationsPage';
import { hasClubNavigation, organizationNavigation } from '../../components/layout/organizationNavigation';
import type { NavigationCapabilities } from '../../context/navigationCapabilities';

const auth = vi.hoisted(() => ({ user: { navigationCapabilities: { version: 1, workspaces: [] } as NavigationCapabilities } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));
const entry = (id: string, number: number, label = 'Sports Park') => ({ id, context: { type: id.startsWith('club.') ? 'club' : 'organization', id: number, label } });

it('deduplicates venue organizations and separates public, management and settings links', () => {
  auth.user.navigationCapabilities = { version: 1, workspaces: [entry('venue.workspace', 133), entry('organization.workspace', 133), entry('organization.settings', 133), entry('venue.workspace', 134, 'Other ground')] };
  const { rerender } = render(<MemoryRouter initialEntries={['/my-organizations?kind=VENUE']}><MyOrganizationsPage /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: 'My venues' })).toBeInTheDocument();
  expect(screen.getAllByRole('article')).toHaveLength(2);
  const card = within(screen.getAllByRole('article')[0]);
  expect(card.getByRole('link', { name: 'Manage venue' })).toHaveAttribute('href', '/stadiums/133/manage');
  expect(card.getByRole('link', { name: 'View public page' })).toHaveAttribute('href', '/stadiums/133');
  expect(card.getByRole('link', { name: 'Organization settings' })).toHaveAttribute('href', '/organizations/133/workspace?tab=settings');
  expect(screen.queryByRole('link', { name: 'Add organization' })).not.toBeInTheDocument();
  auth.user.navigationCapabilities = { version: 1, workspaces: [] };
  rerender(<MemoryRouter initialEntries={['/my-organizations?kind=VENUE']}><MyOrganizationsPage /></MemoryRouter>);
  expect(screen.queryByRole('article')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('don’t currently have');
});

it('supports other organization types and preserves mixed-role club navigation', () => {
  const capabilities: NavigationCapabilities = { version: 1, workspaces: [entry('organization.workspace', 15, 'Organizer'), entry('venue.workspace', 133), entry('club.workspace', 19)] };
  expect(organizationNavigation(capabilities)?.label).toBe('My organizations');
  expect(hasClubNavigation(capabilities)).toBe(true);
  expect(organizationNavigation(undefined)).toBeNull();
  expect(organizationNavigation({ version: 1, workspaces: [] })).toBeNull();
});

it('keeps the first venue creation scoped to venues and offers a route back to every organization', () => {
  auth.user.navigationCapabilities = { version: 1, workspaces: [{ id: 'organization.create', context: { type: 'user', id: 1, label: 'Owner' } }, entry('organization.workspace', 15, 'Organizer')] };
  render(<MemoryRouter initialEntries={['/my-organizations?kind=VENUE']}><MyOrganizationsPage /></MemoryRouter>);
  expect(screen.getByRole('link', { name: 'Add venue' })).toHaveAttribute('href', '/organizations/create?kind=VENUE');
  expect(screen.getByRole('status')).toHaveTextContent('Create a venue organization');
  expect(screen.getByRole('link', { name: 'All my organizations' })).toHaveAttribute('href', '/my-organizations');
  expect(screen.queryByRole('article')).not.toBeInTheDocument();
});
