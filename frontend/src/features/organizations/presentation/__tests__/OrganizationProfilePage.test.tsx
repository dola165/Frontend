import i18n from '../../../../i18n';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { OrganizationProfilePage, OrganizationProfileEditor } from '../../../../pages/OrganizationProfilePage';
import { OrganizationWorkspacePage } from '../../../../pages/OrganizationWorkspacePage';
import { apiClient } from '../../../../api/axiosConfig';
const auth = vi.hoisted(() => ({ sessionId: 'owner', refreshNavigationCapabilities: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), put: vi.fn() } }));
vi.mock('../OrganizationVenues', () => ({ OrganizationVenues: () => <section>Venue portfolio</section> }));
vi.mock('../../setup/OrganizationBranding', () => ({ OrganizationBranding: () => <p>Profile images</p> }));
const profile = (overrides = {}) => ({ id: 17, displayName: 'Community Partner', profileKind: 'SPONSOR', clubId: null, verificationStatus: 'UNVERIFIED', published: false,
  website: 'https://example.test', publicEmail: 'hello@example.test', publicPhone: '+995555010101', addressText: 'Tbilisi', description: 'Community football.', focus: 'Youth competitions', canEdit: true, canCreateTournament: true,
  capabilities: { enabledActivities: ['PROFILE', 'TOURNAMENT'], venueAvailable: false }, ...overrides });
const presentation = (overrides = {}, extras = {}) => ({ profile: profile(overrides), branding: { revision: 0 }, portfolio: { venues: [] }, competitions: [], canOpenWorkspace: true, membershipRole: 'OWNER', ...extras });
function Destination() { const location = useLocation(); return <p>Destination: {location.pathname}{location.search}</p>; }
const open = (entry = '/organizations/17') => render(<MemoryRouter initialEntries={[entry]}><Routes><Route path="/organizations/:organizationId" element={<OrganizationProfilePage />} /><Route path="/organizations/:organizationId/workspace" element={<OrganizationWorkspacePage />} /><Route path="*" element={<Destination />} /></Routes></MemoryRouter>);
beforeEach(() => { vi.resetAllMocks(); auth.sessionId = 'owner'; });
it('opens the canonical club profile without a second organization profile', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: presentation({ clubId: 1, profileKind: 'CLUB' }) }); open();
  expect(await screen.findByText('Destination: /clubs/1')).toBeInTheDocument(); expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
});
it.each([['', '/clubs/1/workspace'], ['?tab=imports', '/clubs/1/workspace?tab=settings&section=imports'], ['?tab=facilities', '/clubs/1/workspace?tab=settings&section=facilities'], ['?tab=team', '/clubs/1/workspace?tab=personnel'], ['?tab=profile', '/clubs/1/profile-settings'], ['?tab=settings', '/clubs/1/workspace?tab=settings']])('retains old club workspace links %s', async (query, destination) => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { clubId: 1 } }); open('/organizations/17/workspace' + query);
  expect(await screen.findByText('Destination: ' + destination)).toBeInTheDocument();
});
it('gives tournament-only sponsors one heading and relevant tabs', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: presentation() }); open();
  expect(await screen.findByRole('heading', { name: 'Community Partner', level: 1 })).toBeInTheDocument(); expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  expect(screen.getByRole('tab', { name: 'Partnerships' })).toBeInTheDocument(); expect(screen.queryByRole('tab', { name: 'Venues' })).not.toBeInTheDocument(); expect(screen.queryByText('Verified organization')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Open workspace' })).toHaveAttribute('href', '/organizations/17/workspace');
  fireEvent.click(screen.getByRole('tab', { name: 'Tournaments' })); expect(screen.getByRole('link', { name: 'Create a tournament' })).toHaveAttribute('href', '/tournaments/setup?organizer=17');
});
it.each([['MEDIA', 'Coverage'], ['HEALTHCARE', 'Services']])('uses the shared layout with %s content', async (profileKind, label) => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: presentation({ profileKind, capabilities: { enabledActivities: ['PROFILE'], venueAvailable: false } }) }); open();
  expect(await screen.findByRole('tab', { name: label })).toBeInTheDocument(); expect(screen.queryByRole('tab', { name: 'Tournaments' })).not.toBeInTheDocument();
});
it('shows owned facilities even when the organization has no venue activity', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: presentation({}, { portfolio: { venues: [{ id: 7 }] } }) }); open();
  fireEvent.click(await screen.findByRole('tab', { name: 'Venues' })); expect(screen.getByText('Venue portfolio')).toBeInTheDocument(); expect(screen.queryByRole('link', { name: 'View venue details' })).not.toBeInTheDocument();
});
it('shows permitted tournaments without inventing staff or feeds', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: presentation({}, { competitions: [{ id: 55, name: 'Community cup', status: 'DRAFT' }] }) }); open('/organizations/17?tab=tournaments');
  expect(await screen.findByRole('link', { name: /Community cup/ })).toHaveAttribute('href', '/tournaments/55'); expect(screen.queryByRole('tab', { name: 'Team' })).not.toBeInTheDocument();
});
it('keeps restricted profiles operational and hides promotional content', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: presentation({ promotionBlocked: true, description: 'REDACTED', focus: 'REDACTED' }, { branding: { bannerUrl: '/uploads/restricted.png' } }) }); open();
  expect(await screen.findByText('Public promotion is restricted')).toBeInTheDocument(); expect(screen.getByRole('link', { name: 'Open workspace' })).toBeInTheDocument(); expect(screen.queryByText(/REDACTED/)).not.toBeInTheDocument(); expect(screen.queryByRole('link', { name: 'Edit profile' })).not.toBeInTheDocument(); expect(screen.queryByRole('img')).not.toBeInTheDocument();
});
it('keeps visitors read-only and rejects unsafe website links', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: presentation({ canEdit: false, canCreateTournament: false, website: 'javascript:alert(1)', published: true }, { canOpenWorkspace: false, membershipRole: '' }) }); open(); await screen.findByRole('heading', { level: 1 });
  for (const name of ['Edit profile', 'Open workspace', 'Visit website']) expect(screen.queryByRole('link', { name })).not.toBeInTheDocument();
});
it('does not render private information after a refused request', async () => {
  vi.mocked(apiClient.get).mockRejectedValue({ response: { status: 404 } }); open(); expect(await screen.findByRole('alert')).toBeInTheDocument(); expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
});
it('edits directly without embedding a second profile header', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: profile() }); vi.mocked(apiClient.put).mockResolvedValue({ data: profile({ description: 'Updated introduction' }) });
  render(<MemoryRouter><OrganizationProfileEditor id="17" /></MemoryRouter>);
  fireEvent.change(await screen.findByRole('textbox', { name: 'About' }), { target: { value: 'Updated introduction' } }); fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
  await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/organizations/17', expect.objectContaining({ description: 'Updated introduction' })));
  expect(await screen.findByText('Profile saved.')).toBeInTheDocument(); expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
});
it('supports keyboard section navigation and preserves unrelated query context', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: presentation() });
  render(<MemoryRouter initialEntries={['/organizations/17?from=requests']}><Routes><Route path="/organizations/:organizationId" element={<><OrganizationProfilePage /><Destination /></>} /></Routes></MemoryRouter>);
  const user = userEvent.setup(), overview = await screen.findByRole('tab', { name: 'Our organization' });
  overview.focus(); await user.keyboard('{End}');
  expect(screen.getByRole('tab', { name: 'Contact' })).toHaveFocus();
  expect(screen.getByRole('tab', { name: 'Contact' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Contact');
  expect(screen.getByText('Destination: /organizations/17?from=requests&tab=contact')).toBeInTheDocument();
  await user.keyboard('{Home}'); expect(overview).toHaveFocus();
  expect(screen.getByText('Destination: /organizations/17?from=requests')).toBeInTheDocument();
});
it('shows an owner the actual publication status and localized profile sections', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: presentation({ published: true }) });
  await act(async () => { await i18n.changeLanguage('ka'); });
  try {
    open(); expect(await screen.findByText('გამოქვეყნებული პროფილი')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'პარტნიორობა' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'მოედნები' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'სამუშაო სივრცის გახსნა' })).toHaveAttribute('href', '/organizations/17/workspace');
  } finally { await act(async () => { await i18n.changeLanguage('en'); }); }
});
it('keeps a venue workspace linked to My venues and supports keyboard section changes', async () => {
  const workspace = { id: 17, clubId: null, displayName: 'Sports Park', organizationType: 'COMPANY', membershipRole: 'OPERATOR', canManage: false, venueCount: 0, tournaments: [], capabilities: { venueAvailable: true, enabledActivities: ['PROFILE', 'VENUE'] } };
  vi.mocked(apiClient.get).mockImplementation(async url => ({ data: String(url).endsWith('/portfolio') ? { canManageRelationships: false, venues: [] } : String(url).endsWith('/workspace') ? workspace : profile({ canEdit: false }) }));
  open('/organizations/17/workspace');
  const overview = await screen.findByRole('button', { name: 'Overview' });
  expect(screen.getByRole('link', { name: '← My venues' })).toHaveAttribute('href', '/my-organizations?kind=VENUE');
  expect(screen.queryByRole('button', { name: 'Settings' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Team' })).toBeInTheDocument();
  overview.focus(); await userEvent.setup().keyboard('{ArrowRight}');
  const profileSection = screen.getByRole('button', { name: 'Profile' });
  expect(profileSection).toHaveFocus(); expect(profileSection).toHaveAttribute('aria-current', 'page');
  expect(await screen.findByText('Only current owners and administrators can edit this profile.')).toBeInTheDocument();
});
