import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import '../../i18n';
import TryoutDetailPage from './TryoutDetailPage';
import { apiClient } from '../../api/axiosConfig';
import { requestDestination } from '../requests/api';

const auth = vi.hoisted(() => ({ status: 'authenticated', sessionId: 'first', user: { id: 8 }, refreshNavigationCapabilities: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
const posting = { id: 12, title: 'Dinamo open trial', clubId: 1, clubName: 'FC Dinamo Tbilisi Academy', status: 'OPEN',
  tryoutDate: '2099-10-01T16:00:00', deadline: '2099-09-30T16:00:00', description: 'Bring boots.', position: 'STRIKER', ageGroup: 'U17', location: 'Tbilisi' };
const eligible = { canApply: true, reason: null, application: null, postingStatus: 'OPEN', canManage: false, minorConsentRequired: false };
const receipt = { id: 33, tryoutId: 12, tryoutTitle: posting.title, status: 'PENDING', appliedAt: '2026-09-27T10:00:00', message: 'Interested', decisionMessage: null, tryoutLifecycleStatus: 'PUBLISHED' };
function tree() { return <MemoryRouter initialEntries={['/tryouts/12']}><Routes><Route path="/tryouts/:tryoutId" element={<TryoutDetailPage />} /></Routes></MemoryRouter>; }
beforeEach(() => {
  vi.clearAllMocks(); auth.status = 'authenticated'; auth.sessionId = 'first'; auth.user = { id: 8 };
  vi.mocked(apiClient.get).mockImplementation(async path => ({ data: String(path).endsWith('/application') ? eligible : posting }));
  vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
});
afterEach(cleanup);
it('serves anonymous detail without reading private application state', async () => {
  auth.status = 'anonymous'; render(tree());
  await screen.findByRole('heading', { name: posting.title });
  expect(screen.getByRole('link', { name: posting.clubName })).toHaveAttribute('href', '/clubs/1');
  expect(screen.getByRole('link', { name: 'Sign in to view your application' })).toHaveAttribute('href', '/login?next=%2Ftryouts%2F12');
  expect(vi.mocked(apiClient.get).mock.calls.some(([path]) => String(path).endsWith('/application'))).toBe(false);
});
it('reviews a secondary-player application and posts with the captured account session', async () => {
  render(tree()); fireEvent.click(await screen.findByRole('button', { name: 'Review application' }));
  expect(apiClient.post).not.toHaveBeenCalled();
  expect(screen.getByRole('group', { name: 'Confirm your action' })).toHaveFocus();
  expect(screen.getByText(/Applying does not join the club/)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Send application' }));
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/tryouts/12/apply', { message: undefined }, expect.objectContaining({ _authSessionId: 'first' })));
});
it.each(['CLOSED', 'FILLED', 'EXPIRED', 'CANCELLED'])('retains %s detail without an apply button', async state => {
  vi.mocked(apiClient.get).mockImplementation(async path => ({ data: String(path).endsWith('/application') ? { ...eligible, canApply: false, reason: 'NOT_OPEN', postingStatus: state } : { ...posting, status: state } }));
  render(tree()); await screen.findByRole('heading', { name: 'Your application' });
  await waitFor(() => expect(screen.queryByText('Checking your current application…')).not.toBeInTheDocument());
  expect(screen.queryByRole('button', { name: 'Review application' })).not.toBeInTheDocument();
});
it('preserves an own receipt after the public posting becomes unavailable', async () => {
  vi.mocked(apiClient.get).mockImplementation(async path => {
    if (String(path).endsWith('/application')) return { data: { ...eligible, canApply: false, application: { ...receipt, status: 'WITHDRAWN' } } };
    throw { response: { status: 404 } };
  });
  render(tree()); await screen.findByRole('heading', { name: 'Tryout not available' });
  expect(await screen.findByText('Withdrawn by you')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Review application' })).not.toBeInTheDocument();
});
it('explains a dissolved-club receipt without offering another application or withdrawal', async () => {
  vi.mocked(apiClient.get).mockImplementation(async path => {
    if (String(path).endsWith('/application')) return { data: { ...eligible, canApply: false, postingStatus: 'UNAVAILABLE', application: { ...receipt, status: 'DECLINED', decisionMessage: 'Club dissolved.' } } };
    throw { response: { status: 404 } };
  });
  render(tree()); await screen.findByRole('heading', { name: 'Tryout not available' });
  expect(await screen.findByText('Application closed')).toBeVisible();
  expect(screen.getByText('Club dissolved.')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Review application' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Withdraw application' })).not.toBeInTheDocument();
});
it('requires confirmation before withdrawing and preserves the terminal receipt', async () => {
  let state = 'PENDING';
  vi.mocked(apiClient.get).mockImplementation(async path => ({ data: String(path).endsWith('/application') ? { ...eligible, canApply: false, application: { ...receipt, status: state } } : posting }));
  vi.mocked(apiClient.post).mockImplementation(async () => { state = 'WITHDRAWN'; return { data: {} }; });
  render(tree()); fireEvent.click(await screen.findByRole('button', { name: 'Withdraw application' }));
  expect(apiClient.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
  expect(await screen.findByText('Withdrawn by you')).toBeVisible();
  expect(apiClient.post).toHaveBeenCalledWith('/tryouts/applications/33/withdraw', {}, expect.objectContaining({ _authSessionId: 'first' }));
  expect(screen.queryByRole('button', { name: 'Withdraw application' })).not.toBeInTheDocument();
});
it('keeps guardian consent separate from submission and trial acceptance', async () => {
  vi.mocked(apiClient.get).mockImplementation(async path => ({ data: String(path).endsWith('/application') ? { ...eligible, minorConsentRequired: true } : posting }));
  render(tree()); expect(await screen.findByText(/An application does not give permission to participate/)).toBeVisible();
});
it('discards a previous account receipt when an in-flight account switch completes', async () => {
  let resolve!: (value: unknown) => void;
  vi.mocked(apiClient.get).mockImplementation(path => String(path).endsWith('/application') && auth.sessionId === 'first'
    ? new Promise(done => { resolve = done; }) : Promise.resolve({ data: String(path).endsWith('/application') ? eligible : posting }));
  const view = render(tree()); await screen.findByRole('heading', { name: posting.title });
  auth.sessionId = 'second'; auth.user = { id: 9 }; view.rerender(tree());
  await screen.findByRole('button', { name: 'Review application' });
  await act(async () => resolve({ data: { ...eligible, application: { ...receipt, message: 'Private old message' } } }));
  expect(screen.queryByText('Private old message')).not.toBeInTheDocument();
});
it('closes new entry only after an owner explicitly reviews a filled posting', async () => {
  vi.mocked(apiClient.get).mockImplementation(async path => ({ data: String(path).endsWith('/application') ? { ...eligible, canManage: true, canApply: false, reason: 'PLAYER_IDENTITY_REQUIRED' } : posting }));
  render(tree()); fireEvent.click(await screen.findByText('Manage applications')); fireEvent.click(screen.getByRole('button', { name: 'Mark places filled' }));
  expect(apiClient.post).not.toHaveBeenCalled(); expect(screen.getByText(/Existing applicants remain available for review/)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/tryouts/12/close', { reason: 'FILLED' }, expect.objectContaining({ _authSessionId: 'first' })));
});
it('only accepts the canonical bare Requests tryout destination', () => {
  expect(requestDestination('/tryouts/12')).toBe('/tryouts/12');
  for (const path of ['/tryouts/12?applicationId=3', '/tryouts/12#offer-3', '/tryouts/9007199254740993', '/tryouts/../12', '/tryouts/0']) expect(requestDestination(path)).toBeNull();
});
