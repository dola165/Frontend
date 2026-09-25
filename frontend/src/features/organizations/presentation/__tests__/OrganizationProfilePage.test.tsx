import '../../../../i18n';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { OrganizationProfilePage } from '../../../../pages/OrganizationProfilePage';
import { apiClient } from '../../../../api/axiosConfig';

const auth = vi.hoisted(() => ({ sessionId: 'organization-owner' }));
vi.mock('../../../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), put: vi.fn() } }));
vi.mock('../../activities/OrganizationActivitySettings', () => ({ OrganizationActivitySettings: () => <p>Activity settings mount</p> }));
vi.mock('../../activities/OrganizationDelegationPanel', () => ({ OrganizationDelegationPanel: () => <p>Delegation panel mount</p> }));

const capabilities = (overrides = {}) => ({ enabledActivities: ['PROFILE', 'VENUE', 'TOURNAMENT'], revision: 4, venueAvailable: true,
    canConfigureActivities: false, canEditProfile: true, canConfigureVenue: true, canManageVenueBookings: true, canCreateTournament: true, canInviteVenueOperator: false, ...overrides });
const profile = (overrides = {}) => ({ id: 17, displayName: 'Community Football Centre', kinds: ['VENUE'], profileKind: 'VENUE', clubId: null,
    verificationStatus: 'UNVERIFIED', published: false, website: 'https://example.test', publicEmail: 'hello@example.test', publicPhone: '+995 555 010 101', addressText: 'Tbilisi · Sport Street 12',
    description: 'Local football for every age.', focus: 'Training and matches', canEdit: true, canCreateTournament: true, capabilities: capabilities(), ...overrides });
const renderProfile = (entry = '/organizations/17') => render(<MemoryRouter initialEntries={[entry]}><Routes><Route path="/organizations/:organizationId" element={<OrganizationProfilePage />} /><Route path="*" element={<p>Redirected away</p>} /></Routes></MemoryRouter>);

beforeEach(() => { vi.resetAllMocks(); auth.sessionId = 'organization-owner'; });

it('makes the established venue primary while keeping tournament setup available for a mixed organization', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: profile() });
    renderProfile();
    const venue = await screen.findByRole('link', { name: 'Open venue workspace' });
    expect(venue).toHaveClass('org-profile-action--primary');
    expect(venue).toHaveAttribute('href', '/stadiums/17/manage');
    expect(screen.getByRole('link', { name: 'Create a tournament' })).toHaveAttribute('href', '/tournaments/setup?organizer=17');
    expect(screen.getByRole('link', { name: 'View venue page' })).toHaveAttribute('href', '/stadiums/17');
    expect(screen.getByRole('link', { name: /My organizations/ })).toHaveAttribute('href', '/my-organizations');
});

it('makes tournament setup primary when venue operations are unavailable', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: profile({ profileKind: 'TOURNAMENT_ORGANIZER', kinds: ['TOURNAMENT_ORGANIZER'], capabilities: capabilities({ enabledActivities: ['PROFILE', 'TOURNAMENT'], venueAvailable: false, canManageVenueBookings: false, canConfigureVenue: false }) }) });
    renderProfile();
    const tournament = await screen.findByRole('link', { name: 'Create a tournament' });
    expect(tournament).toHaveClass('org-profile-action--primary');
    expect(screen.queryByRole('link', { name: 'Open venue workspace' })).not.toBeInTheDocument();
});

it('keeps legacy venue owners connected to their venue without unrelated tournament or team controls', async () => {
    const legacy = profile();
    Reflect.deleteProperty(legacy, 'capabilities');
    vi.mocked(apiClient.get).mockResolvedValue({ data: legacy });
    renderProfile('/organizations/17?settings=1');
    expect(await screen.findByRole('link', { name: 'Open venue workspace' })).toHaveAttribute('href', '/stadiums/17/manage');
    expect(screen.getByRole('link', { name: 'View venue page' })).toHaveAttribute('href', '/stadiums/17');
    expect(screen.getByRole('button', { name: 'Edit profile' })).toBeInTheDocument();
    expect(screen.getByText(/This is the organization behind your venue/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Create a tournament' })).not.toBeInTheDocument();
    expect(screen.queryByText('Activity settings mount')).not.toBeInTheDocument();
    expect(screen.queryByText('Delegation panel mount')).not.toBeInTheDocument();
});

it('preserves non-venue legacy tournament actions', async () => {
    const legacy = profile({ profileKind: 'TOURNAMENT_ORGANIZER', kinds: ['TOURNAMENT_ORGANIZER'] });
    Reflect.deleteProperty(legacy, 'capabilities');
    vi.mocked(apiClient.get).mockResolvedValue({ data: legacy });
    renderProfile();
    expect(await screen.findByRole('link', { name: 'Create a tournament' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open venue workspace' })).not.toBeInTheDocument();
});

it('never substitutes legacy venue rights for explicit capability denials', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: profile({ canCreateTournament: false, capabilities: capabilities({ venueAvailable: false, canConfigureVenue: false, canManageVenueBookings: false }) }) });
    renderProfile();
    expect(await screen.findByRole('button', { name: 'Edit profile' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open venue workspace' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'View venue page' })).not.toBeInTheDocument();
});

it('keeps a blocked private owner operational while suppressing redacted profile and promotional content', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: profile({ promotionBlocked: true, canEdit: false, description: 'REDACTED DESCRIPTION', focus: 'REDACTED FOCUS', addressText: 'REDACTED ADDRESS', website: 'https://redacted.example.test', publicEmail: 'redacted@example.test', publicPhone: '+995 555 999 999' }) });
    renderProfile();
    expect(await screen.findByText('Public promotion is restricted')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open venue workspace' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create a tournament' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit profile' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'View venue page' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Published profile/)).not.toBeInTheDocument();
    expect(screen.queryByText(/REDACTED/)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /About/ })).not.toBeInTheDocument();
});

it('keeps organization identity editing accessible without venue booking permissions', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: profile({ canCreateTournament: false, capabilities: capabilities({ canConfigureActivities: false, canConfigureVenue: false, canManageVenueBookings: false, canCreateTournament: false }) }) });
    renderProfile();
    expect(await screen.findByRole('button', { name: 'Edit profile' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open venue workspace' })).not.toBeInTheDocument();
    expect(screen.queryByText('Redirected away')).not.toBeInTheDocument();
});

it('keeps normal club navigation and exposes the explicit club settings entry only with settings=1', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: profile({ displayName: 'Riverside Academy', profileKind: 'CLUB', kinds: ['CLUB'], clubId: 44, canEdit: false, capabilities: capabilities({ canConfigureActivities: true, canEditProfile: false, canInviteVenueOperator: false }) }) });
    const normal = renderProfile();
    await waitFor(() => expect(screen.getByText('Redirected away')).toBeInTheDocument());
    normal.unmount();
    renderProfile('/organizations/17?settings=1');
    expect(await screen.findByRole('heading', { name: 'Organization settings' })).toBeInTheDocument();
    expect(screen.getByText('Activity settings mount')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Club workspace/ })).toHaveAttribute('href', '/clubs/44');
});

it('keeps an unreviewed non-operational member truthful and read-only without treating it as approval', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: profile({ profileKind: 'MEDIA', kinds: ['MEDIA'], contentClassification: 'UNREVIEWED', canEdit: false, canCreateTournament: false, capabilities: capabilities({ enabledActivities: ['PROFILE'], venueAvailable: false, canManageVenueBookings: false, canCreateTournament: false, canConfigureActivities: false, canEditProfile: false }) }) });
    renderProfile();
    await screen.findByRole('heading', { name: 'Community Football Centre' });
    expect(screen.queryByRole('link', { name: 'Open venue workspace' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Create a tournament' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit profile' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /About Community Football Centre/ })).toBeInTheDocument();
    expect(screen.getByText('Local football for every age.')).toBeInTheDocument();
    expect(screen.queryByText('Public promotion is restricted')).not.toBeInTheDocument();
});
