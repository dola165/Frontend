import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import type { Match } from '../../matchExchange/api';
import type { CoachData } from './CoachWorkspace';
import { NextMatchCard } from './NextMatchCard';
import type { MatchCard } from './squadApi';

vi.mock('../../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));

const data = { clubId: 1, clubName: 'FC Dinamo Tbilisi Academy', clubLogo: null, now: Date.parse('2026-10-29T10:00:00+04:00'),
    link: (tab: string, context: Record<string, string> = {}) => `/my-squads?${new URLSearchParams({ tab, ...context })}` } as unknown as CoachData;
const match = { event_id: 5730, squad_id: 105, club_id: 1, club_name: 'FC Dinamo Tbilisi Academy', opponent_name: 'Kutaisi City Academy', venue_preference: 'AWAY',
    title: 'U16 Boys v Kutaisi City Academy', starts_at_iso: '2026-11-07T11:00:00+04:00', ends_at_iso: '2026-11-07T12:45:00+04:00', location_name: 'Ramaz Shengelia Stadium',
    referee_required: true, referee_status: 'ACCEPTED', venue_status: 'BOOKED' } as unknown as Match;
// Nobody answering is expected (step 6): only "can't come" is an answer.
const callUps = [{ id: 1, name: 'Giorgi Mikadze', selected: true, response: 'UNANSWERED', revision: 1, canRespond: false },
    { id: 2, name: 'Saba Kiteishvili', selected: true, response: 'UNANSWERED', revision: 1, canRespond: false },
    { id: 3, name: 'Luka Beridze', selected: true, response: 'NOT_GOING', revision: 2, canRespond: false }];
const card = (can: MatchCard['can']): MatchCard => ({ squadId: 105, squadName: 'U16 Boys', match, callUps, expected: 2, notComing: 1, fitness: { fit: 11, doubtful: 1, out: 0, notAssessed: 0, players: [] }, preparation: null, trip: null, can });
const nothing = { callUps: false, checklist: false, bus: false };
const show = (value: MatchCard, compact = false) => render(<MemoryRouter><NextMatchCard card={value} data={data} compact={compact} onChanged={vi.fn()} /></MemoryRouter>);

afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('gives a team manager call-ups, the checklist and the bus, and counts who is expected, with nobody to chase', () => {
    show(card({ callUps: true, checklist: true, bus: true }));
    expect(screen.getByRole('link', { name: 'Call-ups' })).toHaveAttribute('href', '/matches/5730?from=squad%3A105');
    expect(screen.queryByRole('button', { name: 'Remind' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Checklist' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Book the bus' })).toBeInTheDocument();
    expect(screen.getAllByText('2 expected · 1 not coming').length).toBeGreaterThan(0);
    expect(screen.queryByText(/answered/)).not.toBeInTheDocument();
    // Fitness leaves its drawer only as Fit, Doubtful or Out.
    expect(screen.getByText('11 fit')).toBeInTheDocument();
    expect(screen.getByText('1 doubtful')).toBeInTheDocument();
});

it('shows a goalkeeper coach the same card, with only Open the match', () => {
    show(card(nothing));
    expect(screen.getByRole('link', { name: 'Open the match' })).toHaveAttribute('href', '/matches/5730?from=squad%3A105');
    expect(screen.queryByRole('button', { name: 'Checklist' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Book the bus' })).not.toBeInTheDocument();
    expect(screen.getByText('11 fit')).toBeInTheDocument();
});

it('names an opponent that is not in GrassKickZ as it was typed', () => {
    show({ ...card(nothing), match: { ...match, opponent_name: null, outside_opponent: 'Gori Juniors' } as unknown as Match });
    expect(screen.getAllByText('Gori Juniors').length).toBeGreaterThan(0);
});

it('puts the match on a squad’s card as one line to Matches, with no buttons', () => {
    show(card({ callUps: true, checklist: true, bus: true }), true);
    const line = screen.getByRole('link');
    expect(line).toHaveAttribute('href', '/my-squads?tab=matches&squad=105');
    expect(line).toHaveTextContent('v Kutaisi City Academy');
    expect(line).toHaveTextContent('2 expected · 1 not coming');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

it('says nothing about players with no participation information, while call-ups and attendance stay usable', () => {
    const value = card({ ...nothing, callUps: true });
    value.callUps = callUps.slice(0, 2).map(p => ({ ...p, response: 'UNANSWERED' }));
    value.expected = 2; value.notComing = 0;
    value.fitness = { fit: 0, doubtful: 0, out: 0, notAssessed: 2, players: value.callUps.map(p => ({ id: p.id, state: 'NOT_ASSESSED' })) };
    show(value);
    expect(screen.queryByText(/participation information/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+ (fit|doubtful|out)$/)).not.toBeInTheDocument();
    expect(screen.getAllByText('2 expected').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Call-ups' })).toHaveAttribute('href', '/matches/5730?from=squad%3A105');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(/medical assessment|assessment required|review required/i)).not.toBeInTheDocument();
});

it('shows only what there is to say: a consented clearance, a review and a restriction, never the players without information', () => {
    const value = card(nothing);
    value.fitness = { fit: 1, doubtful: 1, out: 1, notAssessed: 2, players: [] };
    show(value);
    for (const text of ['1 fit', '1 doubtful', '1 out']) expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.queryByText(/participation information/i)).not.toBeInTheDocument();
});

const preparationCard = (status: string): MatchCard => ({
    ...card(nothing),
    match: { ...match, referee_status: 'NEEDED', external_referee_name: null, venue_status: 'NEEDS_ATTENTION' } as unknown as Match,
    preparation: { recordId: 501, status, revision: 3, referees: 'A saved referee note', pitch: 'The old pitch', medical: 'Mariam', bring: ['Blue kit'] },
});

it.each(['DRAFT', 'REVIEW_DUE', 'UNKNOWN'])('does not present saved %s preparation text as completed arrangements', status => {
    show(preparationCard(status));
    const steps = within(screen.getByRole('list', { name: 'Checklist' })).getAllByRole('listitem');
    for (const step of steps.slice(1)) expect(step).toHaveAttribute('data-state', 'todo');
    expect(screen.queryByText('First-aider: Mariam')).not.toBeInTheDocument();
    expect(screen.getByText('Checklist notes (not confirmed)')).toBeInTheDocument();
    expect(screen.getByText('Blue kit')).toBeInTheDocument();
});

it('keeps actual match confirmations when a preparation checklist needs review', () => {
    const value = preparationCard('REVIEW_DUE');
    value.match = match;
    show(value);
    const steps = within(screen.getByRole('list', { name: 'Checklist' })).getAllByRole('listitem');
    expect(steps[1]).toHaveAttribute('data-state', 'done');
    expect(steps[2]).toHaveAttribute('data-state', 'done');
    expect(steps[3]).toHaveAttribute('data-state', 'todo');
    expect(screen.getByText('Checklist needs review')).toBeInTheDocument();
});

it('does not turn even ready free-text notes into a confirmed referee or pitch reservation', () => {
    show(preparationCard('READY'));
    const steps = within(screen.getByRole('list', { name: 'Checklist' })).getAllByRole('listitem');
    expect(steps[1]).toHaveAttribute('data-state', 'todo');
    expect(steps[2]).toHaveAttribute('data-state', 'todo');
    expect(steps[3]).toHaveAttribute('data-state', 'done');
    expect(screen.getByText('First-aider: Mariam')).toBeInTheDocument();
    expect(screen.getByText('Bring')).toBeInTheDocument();
});

it('gives an authorized preparer the canonical review action without asking players to confirm attendance', () => {
    const value = preparationCard('REVIEW_DUE');
    value.can = { ...nothing, checklist: true };
    show(value);
    const link = screen.getByRole('link', { name: 'Review preparation' });
    const url = new URL(link.getAttribute('href')!, 'http://localhost');
    expect(url.pathname).toBe('/clubs/1/office');
    for (const [key, expected] of Object.entries({ tool: 'preparation', record: '501', squad: '105', coachReturn: 'my-squads', coachClub: '1' }))
        expect(url.searchParams.get(key)).toBe(expected);
    expect(screen.queryByRole('button', { name: /coming|remind/i })).not.toBeInTheDocument();
});

it('does not offer preparation review to a reader without the checklist action', () => {
    show(preparationCard('REVIEW_DUE'));
    expect(screen.getByText('Checklist needs review')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Review preparation' })).not.toBeInTheDocument();
});
