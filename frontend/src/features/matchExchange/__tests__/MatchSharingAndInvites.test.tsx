import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MatchShare } from '../MatchShare';
import { RefereeInvite } from '../../../pages/MatchDetailPage';
import { useAction, useLoad } from '../hooks';
import { post, type Match, type Referee } from '../api';

// This fixture has no club squad; keep the independent club-referee lookup empty.
vi.mock('../useRefereeHistory', () => ({ useRefereeHistory: () => ({ data: [], error: '', reload: vi.fn() }) }));
vi.mock('../hooks', () => ({ useLoad: vi.fn(), useAction: vi.fn(), useClock: vi.fn() }));
vi.mock('../api', async importOriginal => ({ ...await importOriginal<typeof import('../api')>(), post: vi.fn() }));
const retry = vi.fn();
const referee = { user_id: 7, full_name: 'Alex Official', service_area: 'Tbilisi', accepts_paid: true, accepts_volunteer: false, fee: 80, currency: 'GEL' } as Referee;
const match = { event_id: 12, revision: 5, starts_at_iso: '2099-10-01T12:00:00Z', ends_at_iso: '2099-10-01T14:00:00Z' } as Match;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useLoad).mockReturnValue({ data: { items: [referee], total: 25 }, error: '', reload: retry });
  vi.mocked(useAction).mockReturnValue({ busy: false, feedback: <></>, run: async action => { await action(); } });
});

it('copies a canonical match destination and explains private invitation access', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  render(<MatchShare eventId={12} privateMatch />);
  fireEvent.click(screen.getByRole('button', { name: 'Copy match link' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Match link copied');
  expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/match-exchange/12`);
  expect(screen.getByText(/Invite the referee first/)).toBeInTheDocument();
});

it('provides a selectable URL if clipboard access fails', async () => {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
  render(<MatchShare eventId={15} privateMatch={false} />);
  fireEvent.click(screen.getByRole('button', { name: 'Copy match link' }));
  expect(await screen.findByRole('textbox', { name: 'Select and copy this match link' })).toHaveValue(`${window.location.origin}/match-exchange/15`);
  expect(screen.getByText(/does not appoint a referee/)).toBeInTheDocument();
});

it('sends the selected referee and terms with the fixture revision', async () => {
  render(<MemoryRouter><RefereeInvite match={match} reload={retry} /></MemoryRouter>);
  fireEvent.click(screen.getByText('Invite a referee or assistant'));
  fireEvent.change(screen.getByLabelText('Referee'), { target: { value: '7' } });
  expect(screen.getByRole('link', { name: /Review referee profile/ })).toHaveAttribute('href', '/profile/7');
  fireEvent.click(screen.getByRole('button', { name: 'Send invitation' }));
  await waitFor(() => expect(post).toHaveBeenCalledWith('/match-exchange/12/referees', { refereeId: 7, duty: 'REFEREE', volunteer: false, fee: 80, currency: 'GEL', revision: 5 }));
});

it('clears selection on pagination, availability filtering, and changed terms', () => {
  render(<MemoryRouter><RefereeInvite match={match} reload={retry} /></MemoryRouter>);
  fireEvent.click(screen.getByText('Invite a referee or assistant'));
  fireEvent.change(screen.getByLabelText('Referee'), { target: { value: '7' } });
  fireEvent.click(screen.getByRole('button', { name: 'Next referees' }));
  expect(screen.getByRole('button', { name: 'Send invitation' })).toBeDisabled();
  expect(vi.mocked(useLoad).mock.lastCall?.[0]).toContain('page=1');
  fireEvent.click(screen.getByLabelText('Only referees with availability covering this match'));
  const query = new URLSearchParams(vi.mocked(useLoad).mock.lastCall?.[0].split('?')[1]);
  expect(query.get('page')).toBe('0');
  expect(query.get('from')).toBe(match.starts_at_iso);
  expect(query.get('to')).toBe(match.ends_at_iso);
  fireEvent.change(screen.getByLabelText('Referee'), { target: { value: '7' } });
  fireEvent.click(screen.getByLabelText('Volunteer invitation'));
  expect(screen.getByRole('button', { name: 'Send invitation' })).toBeDisabled();
  expect(screen.getByRole('option', { name: /Does not accept these terms/ })).toBeDisabled();
});

it('shows a retry when referee search fails instead of an empty selector', () => {
  vi.mocked(useLoad).mockReturnValue({ data: undefined, error: 'Search unavailable', reload: retry });
  render(<MemoryRouter><RefereeInvite match={match} reload={retry} /></MemoryRouter>);
  fireEvent.click(screen.getByText('Invite a referee or assistant'));
  expect(screen.getByRole('alert')).toHaveTextContent('Search unavailable');
  fireEvent.click(screen.getByRole('button', { name: 'Retry referee search' }));
  expect(retry).toHaveBeenCalledOnce();
  expect(screen.getByRole('button', { name: 'Send invitation' })).toBeDisabled();
});
