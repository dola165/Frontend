import { act, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MatchDetailPage } from '../../../pages/MatchDetailPage';
import { chatApi } from '../../../api/chat';
import { useAction, useClock, useLoad } from '../hooks';
import { getResultSuggestions, type Match } from '../api';
import { getScoreRecord, getScoreSummary, type ScoreSummary } from '../../scores/api';
import i18n from '../../../i18n';

vi.mock('../hooks', () => ({ useLoad: vi.fn(), useAction: vi.fn(), useClock: vi.fn() }));
vi.mock('../../../api/chat', () => ({ chatApi: { findConversationByContext: vi.fn() } }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ sessionId: 'session-a' }) }));
vi.mock('../api', async importOriginal => ({ ...(await importOriginal<typeof import('../api')>()), getResultSuggestions: vi.fn() }));
vi.mock('../../scores/api', () => ({ getScoreSummary: vi.fn(), getScoreRecord: vi.fn(), writeScore: vi.fn() }));

const summary = (value: Partial<ScoreSummary>): ScoreSummary => ({ eventId: 12, kind: 'EXCHANGE', oneSided: false, status: 'NONE', fixtureStatus: 'SCHEDULED', revision: 0, homeScore: null, awayScore: null, reported: null, disputed: null, official: false, legacy: false, scorePrivate: false, canReadAudit: false, ...value });

const match: Match = {
  event_id: 12, squad_id: 1, squad_name: 'U16', club_id: 10, club_name: 'Alpha FC', club_profile_kind: 'ACADEMY', club_logo_url: null, club_banner_url: null,
  title: 'Saturday friendly', description: 'Friendly match', starts_at: '2099-09-20T10:00:00', ends_at: '2099-09-20T12:00:00', starts_at_iso: '2099-09-20T10:00:00Z', ends_at_iso: '2099-09-20T12:00:00Z', timezone: 'Europe/London', city: 'London', location_name: 'Main pitch', location_lat: null, location_lng: null,
  age_group: 'U16', level: 'DEVELOPMENT', format: '11_A_SIDE', venue_preference: 'HOME', referee_required: true, venue_id: 7, booking_id: 8, booking: { id: 8, venue_id: 7, status: 'CONFIRMED', stored_status: 'CONFIRMED', starts_at: '2099-09-20T10:00:00Z', ends_at: '2099-09-20T12:00:00Z' }, external_venue_confirmed: false,
  revision: 4, listing_status: 'ARRANGED', event_status: 'SCHEDULED', venue_status: 'BOOKED', referee_status: 'ACCEPTED', opponent_name: 'Beta FC', opponent_club_id: 11, opponent_squad_name: 'U16', target_squad_id: 2, head_coach_id: 5, coach_name: 'Coach', can_manage: false, can_arrange: true, proposals: [], appointments: [], home_score: null, away_score: null,
};

function renderPage(value: Match = match) {
  vi.mocked(useLoad).mockImplementation((path: string) => path === '/match-exchange/12' ? { data: value, error: '', reload: vi.fn() } : { data: [], error: '', reload: vi.fn() });
  return render(<MemoryRouter initialEntries={['/match-exchange/12']}><Routes><Route path="/match-exchange/:eventId" element={<MatchDetailPage/>}/></Routes></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useClock).mockReturnValue(new Date('2099-01-01T00:00:00Z').getTime());
  vi.mocked(useAction).mockReturnValue({ busy: false, run: vi.fn(), feedback: <></> });
  vi.mocked(getScoreSummary).mockResolvedValue(summary({}));
  vi.mocked(getResultSuggestions).mockResolvedValue({ eventId: 12, resultRevision: 0, canSuggest: false, canReview: false, reviewableRoles: [], adoptableRoles: [], suggestions: [], ownSuggestions: [], pendingCount: 0, page: 0, hasMore: false });
});

it('shows only the public score state to an ordinary match viewer, with both disputed versions', async () => {
  vi.mocked(getScoreSummary).mockResolvedValue(summary({ status: 'DISPUTED', fixtureStatus: 'COMPLETED', revision: 2, reported: { home: 2, away: 1 }, disputed: { home: 1, away: 1 } }));
  const spectator = { ...match, can_arrange: false, home_score: null, away_score: null, result_status: 'DISPUTED' as const };
  await act(async () => { renderPage(spectator); });
  expect(await screen.findByText('Disputed')).toBeInTheDocument();
  expect(screen.getByText('2–1 / 1–1')).toBeInTheDocument();
  expect(getScoreRecord).not.toHaveBeenCalled();
});

it('keeps both teams and the result in the fixture band ahead of readiness and secondary match details', async () => {
  vi.mocked(getScoreSummary).mockResolvedValue(summary({ status: 'CONFIRMED', fixtureStatus: 'COMPLETED', revision: 2, homeScore: 3, awayScore: 1, official: true }));
  renderPage({ ...match, can_arrange: false, starts_at_iso: '2098-09-20T10:00:00Z', ends_at_iso: '2098-09-20T12:00:00Z' });
  const fixture = screen.getByRole('region', { name: 'Fixture' });
  expect(await within(fixture).findByText('Confirmed')).toBeInTheDocument();
  expect(fixture).toHaveTextContent('3–1');
  expect(fixture).toHaveTextContent('Alpha FC');
  expect(fixture).toHaveTextContent('Beta FC');
  const readiness = screen.getByRole('heading', { name: 'Match readiness' });
  expect(fixture.compareDocumentPosition(readiness) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it('shows no score and no placeholder for a private under-11 result', async () => {
  vi.mocked(getScoreSummary).mockResolvedValue(summary({ status: 'FINAL', fixtureStatus: 'COMPLETED', revision: 3, official: true, scorePrivate: true }));
  renderPage({ ...match, can_arrange: false, starts_at_iso: '2098-09-20T10:00:00Z', ends_at_iso: '2098-09-20T12:00:00Z', score_private: true });
  const fixture = screen.getByRole('region', { name: 'Fixture' });
  expect(await within(fixture).findByText('Final')).toBeInTheDocument();
  expect(fixture).not.toHaveTextContent('—');
  expect(fixture.querySelector('.result-summary-score')).toBeNull();
});

it('opens with the proposal form for an eligible visiting squad, before the match-day plan', async () => {
  const open = { ...match, can_arrange: false, opponent_name: null, opponent_club_id: null, listing_status: 'OPEN' as const };
  vi.mocked(useLoad).mockImplementation((path: string) => ({ data: path === '/match-exchange/12' ? open : path === '/match-exchange/squads' ? [{ id: 2, club_id: 11, club_name: 'Beta FC', name: 'U16' }] : [], error: '', reload: vi.fn() }));
  render(<MemoryRouter initialEntries={['/match-exchange/12']}><Routes><Route path="/match-exchange/:eventId" element={<MatchDetailPage/>}/></Routes></MemoryRouter>);
  expect(await screen.findByText('Opponent to be agreed')).toBeInTheDocument();
  const send = screen.getByRole('button', { name: 'Send proposal' });
  const plan = screen.getByRole('heading', { name: 'Plan your match day' });
  expect(send.compareDocumentPosition(plan) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Propose to play' })).toHaveAttribute('href', '#match-proposal');
  expect(screen.queryByText('Broadcast and filming')).not.toBeInTheDocument();
});

it('summarizes opponent, venue, officials and communication and opens the exact durable conversation', async () => {
  vi.mocked(chatApi.findConversationByContext).mockResolvedValue({ id: 77, name: 'Match: Saturday friendly', contextType: 'MATCH_CHALLENGE', contextId: 12, lastMessage: null, lastMessageSenderId: null, lastMessageSenderName: null, lastMessageAt: null, unreadCount: 0, participantCount: 2, participants: [] });
  renderPage();
  expect(await screen.findByRole('heading', { name: 'Match readiness' })).toBeInTheDocument();
  expect(screen.getByText('Opponent')).toBeInTheDocument();
  expect(screen.getByText('Pitch / venue')).toBeInTheDocument();
  expect(screen.getByText('Officials')).toBeInTheDocument();
  expect(screen.getByText(/^Communication:/)).toBeInTheDocument();
  expect(await screen.findByText('Opponent, venue and required referee are confirmed. Coaching teams can coordinate matchday details.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Open the exact match conversation' })).toHaveAttribute('href', '/messages?conversationId=77');
  expect(chatApi.findConversationByContext).toHaveBeenCalledWith('MATCH_CHALLENGE', 12, expect.any(AbortSignal));
});

it('uses a truthful Messages fallback when the conversation lookup exposes no ID', async () => {
  vi.mocked(chatApi.findConversationByContext).mockResolvedValue(null);
  renderPage();
  expect(await screen.findByText('Available in Messages')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Open Messages to find this match conversation' })).toHaveAttribute('href', '/messages');
});

it('distinguishes same-name squads and opens the exact visiting squad', () => {
  renderPage();
  expect(screen.getByRole('link', { name: 'U16 (Alpha FC)' })).toHaveAttribute('href', '/clubs/10?tab=teams&squad=1');
  expect(screen.getByRole('link', { name: 'U16 (Beta FC)' })).toHaveAttribute('href', '/clubs/11?tab=teams&squad=2');
});

it('renders the match-day plan in Georgian, including dates, ground and referee states', async () => {
  await i18n.changeLanguage('ka');
  try {
    renderPage({ ...match, can_arrange: false });
    expect(screen.getByRole('heading', { name: 'დაგეგმეთ მატჩის დღე' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'გუნდის განრიგი' })).toHaveAttribute('href', '/calendar?scope=squad&squadId=1');
    expect(screen.getByText(/დაჯავშნილია/)).toBeInTheDocument();
    expect(screen.getAllByText('დანიშნულია').length).toBeGreaterThan(0);
    expect(screen.getByText(/120 წუთი/)).toBeInTheDocument();
    expect(screen.getAllByText(/სექ/).length).toBeGreaterThan(0);
    expect(screen.queryByText('Reserved')).not.toBeInTheDocument();
    expect(screen.queryByText('Sun, 20 Sept')).not.toBeInTheDocument();
  } finally { await act(async () => { await i18n.changeLanguage('en'); }); }
});
