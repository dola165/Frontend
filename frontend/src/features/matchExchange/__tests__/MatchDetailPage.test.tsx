import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MatchDetailPage } from '../../../pages/MatchDetailPage';
import { chatApi } from '../../../api/chat';
import { useAction, useClock, useLoad } from '../hooks';
import { getPublicMatchResult, getResultSuggestions, getMatchResult, type Match } from '../api';

vi.mock('../hooks', () => ({ useLoad: vi.fn(), useAction: vi.fn(), useClock: vi.fn() }));
vi.mock('../../../api/chat', () => ({ chatApi: { findConversationByContext: vi.fn() } }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ sessionId: 'session-a' }) }));
vi.mock('../api', async importOriginal => ({ ...(await importOriginal<typeof import('../api')>()), getPublicMatchResult: vi.fn(), getResultSuggestions: vi.fn(), getMatchResult: vi.fn() }));

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
  vi.mocked(getPublicMatchResult).mockResolvedValue({ eventId: 12, status: 'NONE', fixtureStatus: 'SCHEDULED', revision: 0, homeScore: null, awayScore: null, official: false, legacy: false, canReadAudit: false });
  vi.mocked(getResultSuggestions).mockResolvedValue({ eventId: 12, resultRevision: 0, canSuggest: false, canReview: false, reviewableRoles: [], adoptableRoles: [], suggestions: [], ownSuggestions: [], pendingCount: 0, page: 0, hasMore: false });
});

it('shows only the public result state to an ordinary match viewer', async () => {
  vi.mocked(getPublicMatchResult).mockResolvedValue({ eventId: 12, status: 'DISPUTED', fixtureStatus: 'COMPLETED', revision: 2, homeScore: 2, awayScore: 1, official: false, legacy: false, canReadAudit: false });
  const spectator = { ...match, can_arrange: false, home_score: null, away_score: null, result_status: 'DISPUTED' as const };
  renderPage(spectator);
  expect(await screen.findByText('Disputed · under review')).toBeInTheDocument();
  expect(getMatchResult).not.toHaveBeenCalled();
});

it('keeps both teams and the result ahead of readiness and secondary match details', async () => {
  const {container}=renderPage({...match,can_arrange:false});
  const result=await screen.findByRole('heading',{name:'Match result'});
  const readiness=screen.getByRole('heading',{name:'Match readiness'});
  expect(result.compareDocumentPosition(readiness)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(container.querySelector('.mx-match-lead .match-scoreboard')).toHaveTextContent('Alpha FC');
  expect(container.querySelector('.mx-match-lead .match-scoreboard')).toHaveTextContent('Beta FC');
});

it('places the proposal form in the opening group for an eligible visiting squad', async () => {
  const open={...match,can_arrange:false,opponent_name:null,opponent_club_id:null,listing_status:'OPEN' as const};
  vi.mocked(useLoad).mockImplementation((path:string)=>({data:path==='/match-exchange/12'?open:path==='/match-exchange/squads'?[{id:2,club_id:11,club_name:'Beta FC',name:'U16'}]:[],error:'',reload:vi.fn()}));
  const {container}=render(<MemoryRouter initialEntries={['/match-exchange/12']}><Routes><Route path="/match-exchange/:eventId" element={<MatchDetailPage/>}/></Routes></MemoryRouter>);
  expect(await screen.findByText('Opponent to be confirmed')).toBeInTheDocument();
  expect(container.querySelector('.mx-match-lead')).toContainElement(screen.getByRole('button',{name:'Send proposal'}));
  expect(screen.queryByText('Match broadcast')).not.toBeInTheDocument();
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
