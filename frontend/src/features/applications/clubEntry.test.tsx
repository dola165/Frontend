import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClubApplicationPanel } from './components/ClubApplicationPanel';
import { AdditionalResponsibility } from '../recruitment/AdditionalResponsibility';
import type { EntryDecision } from './clubEntry';

const state = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), create: vi.fn(), trial: vi.fn(), cancel: vi.fn(), session: 'account-a', listeners: new Set<() => void>(), language: 'en' }));
vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: state.get, post: state.post } }));
vi.mock('../../utils/authStorage', () => ({ getAuthSessionId: () => state.session, subscribeAuthSession: (fn: () => void) => { state.listeners.add(fn); return () => state.listeners.delete(fn); } }));
vi.mock('../clubs/api', () => ({ createClubApplication: state.create, selfRegisterClubPlayer: state.trial, cancelClubApplication: state.cancel }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: state.language } }) }));

const allowed: EntryDecision = { allowed: true, reason: null, message: null, pendingApplicationId: null, pendingInvitationId: null, eligibleFrom: null };
const props = { clubId: 1, clubName: 'FC Dinamo Tbilisi Academy', isAuthenticated: true, playerJoinPolicy: 'APPLICATION_REQUIRED' as const,
  onOpenInvites: vi.fn(), onSignIn: vi.fn(), onClose: vi.fn(), onStateChange: vi.fn() };
const panel = () => render(<MemoryRouter><ClubApplicationPanel {...props} /></MemoryRouter>);
const additional = () => render(<MemoryRouter><AdditionalResponsibility onChanged={vi.fn()} /></MemoryRouter>);
const answer = (decision = allowed) => state.get.mockImplementation((path: string) => Promise.resolve({ data: path === '/me/club-relationships' ? [{ clubId: 1, clubName: 'Dinamo' }, { clubId: 2, clubName: 'Other club' }] : decision }));
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); state.session = 'account-a'; state.language = 'en'; answer(); state.post.mockResolvedValue({ data: { applicationId: 50 } }); state.create.mockResolvedValue({ applicationId: 50 }); });

describe('club entry decisions', () => {
  it('blocks generic entry for an existing member even when profile props are stale', async () => {
    answer({ ...allowed, allowed: false, reason: 'ALREADY_CONNECTED' }); panel();
    expect(await screen.findByText(/already connected to this club/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'apply.requestEntryCta' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Review account and requests' })).toHaveAttribute('href', '/account?tab=profile');
    expect(state.create).not.toHaveBeenCalled();
  });
  it('keeps entry unavailable while eligibility fails and retries explicitly', async () => {
    state.get.mockRejectedValueOnce(new Error('offline')); panel();
    fireEvent.click(await screen.findByRole('button', { name: 'Retry eligibility' }));
    expect(await screen.findByRole('button', { name: 'apply.requestEntryCta' })).toBeEnabled();
  });
  it('binds an allowed submission to the displayed account and prevents double click writes', async () => {
    let finish!: (value: { applicationId: number }) => void;
    state.create.mockReturnValue(new Promise(resolve => { finish = resolve; })); panel();
    const button = await screen.findByRole('button', { name: 'apply.requestEntryCta' });
    fireEvent.click(button); fireEvent.click(button);
    expect(state.create).toHaveBeenCalledTimes(1);
    expect(state.create).toHaveBeenCalledWith(1, 'PLAYER', null, expect.any(Object), expect.objectContaining({ _authSessionId: 'account-a', signal: expect.any(AbortSignal) }));
    await act(async () => finish({ applicationId: 50 }));
  });
  it('renders a Georgian eligibility reason without relying on an English server message', async () => {
    state.language = 'ka'; answer({ ...allowed, allowed: false, reason: 'PENDING_APPLICATION', pendingApplicationId: 12 }); panel();
    expect(await screen.findByText(/ახალი მოთხოვნის გაგზავნამდე/)).toBeVisible();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/account?tab=profile&applicationId=12');
  });
});

describe('explicit additional responsibilities', () => {
  it('uses the explicit endpoint and grants no access optimistically', async () => {
    additional();
    fireEvent.click(await screen.findByText('Request another responsibility in your club'));
    fireEvent.change(screen.getByLabelText('Club'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Describe the responsibility'), { target: { value: '  Help the U14 goalkeepers  ' } });
    const button = screen.getByRole('button', { name: 'Request club approval' });
    await waitFor(() => expect(button).toBeEnabled()); fireEvent.click(button);
    await screen.findByText(/Request sent for club review/);
    expect(state.post).toHaveBeenCalledExactlyOnceWith('/clubs/1/responsibility-requests', { role: 'COACH', message: 'Help the U14 goalkeepers' }, expect.objectContaining({ _authSessionId: 'account-a', signal: expect.any(AbortSignal) }));
  });
  it('disables another request when pending work exists despite active membership', async () => {
    answer({ ...allowed, allowed: false, reason: 'PENDING_INVITATION', pendingInvitationId: 9 }); additional();
    fireEvent.click(await screen.findByText('Request another responsibility in your club'));
    fireEvent.change(screen.getByLabelText('Club'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Describe the responsibility'), { target: { value: 'Another responsibility' } });
    expect(await screen.findByText(/Review your current club invitation first/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Request club approval' })).toBeDisabled();
    expect(state.post).not.toHaveBeenCalled();
  });
  it('does not reuse permission from a previous club while new eligibility is loading', async () => {
    additional(); fireEvent.click(await screen.findByText('Request another responsibility in your club'));
    fireEvent.change(screen.getByLabelText('Club'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Describe the responsibility'), { target: { value: 'Another responsibility' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Request club approval' })).toBeEnabled());
    state.get.mockImplementation(() => new Promise(() => {}));
    fireEvent.change(screen.getByLabelText('Club'), { target: { value: '2' } });
    expect(screen.getByRole('button', { name: 'Request club approval' })).toBeDisabled();
  });
  it('discards drafts and late eligibility responses on an account change', async () => {
    let finish!: (value: { data: EntryDecision }) => void;
    additional(); fireEvent.click(await screen.findByText('Request another responsibility in your club'));
    state.get.mockImplementation((path: string) => path === '/me/club-relationships' ? Promise.resolve({ data: [{ clubId: 2, clubName: 'Other club' }] }) : new Promise(resolve => { finish = resolve; }));
    fireEvent.change(screen.getByLabelText('Club'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Describe the responsibility'), { target: { value: 'Private old account draft' } });
    act(() => { state.session = 'account-b'; state.listeners.forEach(fn => fn()); });
    await screen.findByText('Request another responsibility in your club');
    await act(async () => finish({ data: allowed }));
    expect(screen.queryByDisplayValue('Private old account draft')).toBeNull();
    fireEvent.click(screen.getByText('Request another responsibility in your club'));
    expect(screen.getByRole('button', { name: 'Request club approval' })).toBeDisabled();
    expect(state.post).not.toHaveBeenCalled();
  });
});
